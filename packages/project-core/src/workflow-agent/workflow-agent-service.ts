import type { ShotRequirementSpecV2 } from "@comfyuiflow/contracts";
import type { RepairProposal } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";
import type { GenerationAdapterRegistry } from "../generation-adapter.js";
import { analyzeShotRequirements, computeShotRequirementHash } from "./requirement-analyzer.js";
import { validateDependencyGraph, propagateWaitingShots } from "./dependency-graph.js";
import {
  resolveImplementationCandidates,
  type CapabilityResolution,
  type ImplementationRuntimeFacts,
} from "./capability-resolver.js";
import {
  selectStoryboardImplementations,
  type SelectedShotImplementation,
} from "./implementation-selector.js";
import {
  resolveExecutionPattern,
  type CompilationReadinessFacts,
  type PatternResolution,
} from "./pattern-resolver.js";
import { validatePlanningCandidate } from "./validator.js";
import type { LoadedGenerationRegistry } from "./registry.js";

export const WORKFLOW_AGENT_POLICY_VERSION = "workflow-agent-policy-v1" as const;
export const WORKFLOW_AGENT_COMPILER_VERSION = "workflow-agent-compiler-v1" as const;

export interface WorkflowPlanningShotInput {
  generationSpecId: string;
  spec: ShotRequirementSpecV2;
}

export interface PlannedShotDraft {
  shotKey: string;
  ordinal: number;
  generationSpecId: string;
  planningOutcome: "READY" | "TRIAL" | "BLOCKED" | "WAITING_FOR_UPSTREAM_REPAIR";
  blockerCodes: string[];
  implementationIdentity: string | null;
  planningInputHash: string;
  requirementsHash: string;
  capabilitySnapshotHash: string;
  planTemplateSha256: string;
  estimatedCostMicros: number | null;
  maximumCostMicros: number | null;
  currency: string | null;
  pricingExpiresAt: string | null;
  payload: Record<string, unknown>;
}

export interface WorkflowPlanningResult {
  schemaVersion: "workflow-planning-preview-v1";
  registrySha256: string;
  dependencyPolicyHash: string;
  counts: { ready: number; trial: number; blocked: number; waiting: number };
  shots: PlannedShotDraft[];
  previewHash: string;
  externalCalls: 0;
  generationAuthorized: false;
}

function identity(selected: SelectedShotImplementation) {
  return `${selected.implementation.implementationId}@${selected.implementation.version}`;
}

export class WorkflowAgentService {
  constructor(
    private readonly registry: LoadedGenerationRegistry,
    private readonly adapters: GenerationAdapterRegistry,
  ) {}

  plan(input: {
    shots: readonly WorkflowPlanningShotInput[];
    runtimeFacts?: ReadonlyMap<string, ImplementationRuntimeFacts>;
    compilationFacts?: ReadonlyMap<string, CompilationReadinessFacts>;
    now?: Date;
  }): WorkflowPlanningResult {
    const shotByKey = new Map(input.shots.map((shot) => [shot.spec.shotKey, shot]));
    if (shotByKey.size !== input.shots.length) throw new Error("DEPENDENCY_DUPLICATE_SHOT");
    const graph = validateDependencyGraph({
      shotKeys: input.shots.map((shot) => shot.spec.shotKey),
      dependencies: input.shots.flatMap((shot) => shot.spec.dependencies),
    });
    const requirementsByShot = new Map<string, ReturnType<typeof analyzeShotRequirements>>();
    const resolutions = new Map<string, CapabilityResolution>();
    const directBlocked = new Set<string>();

    for (const shotKey of graph.topologicalShotKeys) {
      const shot = shotByKey.get(shotKey);
      if (!shot) throw new Error("DEPENDENCY_SHOT_NOT_FOUND");
      const requirements = analyzeShotRequirements(shot.spec);
      if (computeShotRequirementHash(shot.spec) !== shot.spec.requirementHash) {
        requirements.blockers.push("REQUIREMENT_HASH_MISMATCH");
        requirements.blockers.sort();
      }
      requirementsByShot.set(shotKey, requirements);
      const resolution = resolveImplementationCandidates({
        spec: shot.spec,
        requirements,
        registry: this.registry,
        ...(input.runtimeFacts ? { runtimeFacts: input.runtimeFacts } : {}),
        ...(input.now ? { now: input.now } : {}),
      });
      resolutions.set(shotKey, resolution);
      if (resolution.candidateSet.candidates.length === 0) directBlocked.add(shotKey);
    }

    const selectableSets = graph.topologicalShotKeys
      .filter((shotKey) => !directBlocked.has(shotKey))
      .map((shotKey) => resolutions.get(shotKey)?.candidateSet)
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    const selectedByShot = new Map(
      selectStoryboardImplementations(selectableSets).map((selected) => [
        selected.shotKey,
        selected,
      ]),
    );
    const patternByShot = new Map<string, PatternResolution>();
    const validationBlockers = new Map<string, string[]>();
    for (const [shotKey, selected] of selectedByShot) {
      const facts = input.compilationFacts?.get(identity(selected)) ?? {
        catalogReady: false,
        staticValidationPassed: false,
        preprocessingReady: false,
      };
      const pattern = resolveExecutionPattern(selected, facts);
      patternByShot.set(shotKey, pattern);
      const validation = validatePlanningCandidate({
        implementation: selected.implementation,
        pattern,
        adapterRegistry: this.adapters,
        ...(input.now ? { now: input.now } : {}),
      });
      if (validation.blockerCodes.length > 0) {
        directBlocked.add(shotKey);
        validationBlockers.set(shotKey, validation.blockerCodes);
      }
    }
    const waiting = propagateWaitingShots(graph, directBlocked);
    for (const blocked of directBlocked) waiting.delete(blocked);

    const capabilitySnapshotHash = canonicalSha256({
      schemaVersion: "capability-snapshot-v1",
      registrySha256: this.registry.registrySha256,
      policyVersion: WORKFLOW_AGENT_POLICY_VERSION,
    });
    const dependencyPolicyHash = canonicalSha256({
      schemaVersion: "shot-dependency-policy-v1",
      graph: { shotKeys: graph.topologicalShotKeys, dependencies: graph.dependencies },
      compilerVersion: WORKFLOW_AGENT_COMPILER_VERSION,
    });
    const planHashByShot = new Map<string, string>();
    const shots: PlannedShotDraft[] = [];
    for (const shotKey of graph.topologicalShotKeys) {
      const source = shotByKey.get(shotKey);
      const requirements = requirementsByShot.get(shotKey);
      const resolution = resolutions.get(shotKey);
      if (!source || !requirements || !resolution) throw new Error("DEPENDENCY_SHOT_NOT_FOUND");
      const selected = selectedByShot.get(shotKey);
      const pattern = patternByShot.get(shotKey);
      const blockerCodes = directBlocked.has(shotKey)
        ? [
            ...new Set([...resolution.blockerCodes, ...(validationBlockers.get(shotKey) ?? [])]),
          ].sort()
        : [];
      const planningOutcome = directBlocked.has(shotKey)
        ? ("BLOCKED" as const)
        : waiting.has(shotKey)
          ? ("WAITING_FOR_UPSTREAM_REPAIR" as const)
          : selected?.lifecycleStatus === "TRIAL"
            ? ("TRIAL" as const)
            : ("READY" as const);
      const inputBindings = [
        ...source.spec.references.map((reference) => ({
          type: "ASSET_VERSION",
          assetVersionFileId: reference.assetVersionFileId,
          sha256: reference.sha256,
          inputSlot: reference.semanticRole,
        })),
        ...source.spec.dependencies.map((dependency) => ({
          type: "PREVIOUS_SHOT_FINAL_FRAME",
          sourceShotKey: dependency.sourceShotKey,
          sourceShotExecutionPlanSha256:
            planHashByShot.get(dependency.sourceShotKey) ?? "0".repeat(64),
          extractorVersion: "dependency-final-frame-v1",
          inputSlot: dependency.requiredInputSlot,
        })),
      ].sort((left, right) =>
        `${left.type}:${left.inputSlot}`.localeCompare(`${right.type}:${right.inputSlot}`),
      );
      const implementation = selected?.implementation;
      const payload = {
        schemaVersion: "shot-execution-plan-draft-v1",
        policyVersion: WORKFLOW_AGENT_POLICY_VERSION,
        compilerVersion: WORKFLOW_AGENT_COMPILER_VERSION,
        shotKey,
        ordinal: source.spec.ordinal,
        planningOutcome,
        blockerCodes,
        requirements,
        dependencyPolicyHash,
        inputBindings,
        rejectedCandidates: resolution.rejected,
        ...(implementation
          ? {
              implementationId: implementation.implementationId,
              implementationVersion: implementation.version,
              providerId: implementation.providerId,
              modelProfileId: implementation.modelProfileId,
              executorType: implementation.executorType,
              adapterId: implementation.adapterId,
              adapterVersion: implementation.adapterVersion,
              selectionReason: selected.selectionReason,
              pattern,
              pricing: implementation.pricing,
            }
          : {}),
      };
      const planTemplateSha256 = canonicalSha256(payload);
      planHashByShot.set(shotKey, planTemplateSha256);
      const pricing = implementation?.pricing ?? null;
      shots.push({
        shotKey,
        ordinal: source.spec.ordinal,
        generationSpecId: source.generationSpecId,
        planningOutcome,
        blockerCodes,
        implementationIdentity: selected ? identity(selected) : null,
        planningInputHash: canonicalSha256({
          requirementHash: source.spec.requirementHash,
          registrySha256: this.registry.registrySha256,
          capabilitySnapshotHash,
          dependencyPolicyHash,
          runtimeFacts: selected ? (input.runtimeFacts?.get(identity(selected)) ?? null) : null,
          compilationFacts: selected
            ? (input.compilationFacts?.get(identity(selected)) ?? null)
            : null,
        }),
        requirementsHash: requirements.requirementsHash,
        capabilitySnapshotHash,
        planTemplateSha256,
        estimatedCostMicros: pricing?.estimatedCostMicros ?? null,
        maximumCostMicros: pricing?.estimatedCostMicros ?? null,
        currency: pricing?.currency ?? null,
        pricingExpiresAt: pricing?.expiresAt ?? null,
        payload,
      });
    }
    const counts = {
      ready: shots.filter((shot) => shot.planningOutcome === "READY").length,
      trial: shots.filter((shot) => shot.planningOutcome === "TRIAL").length,
      blocked: shots.filter((shot) => shot.planningOutcome === "BLOCKED").length,
      waiting: shots.filter((shot) => shot.planningOutcome === "WAITING_FOR_UPSTREAM_REPAIR")
        .length,
    };
    const previewCore = {
      schemaVersion: "workflow-planning-preview-v1" as const,
      registrySha256: this.registry.registrySha256,
      dependencyPolicyHash,
      counts,
      shots,
    };
    return {
      ...previewCore,
      previewHash: canonicalSha256(previewCore),
      externalCalls: 0,
      generationAuthorized: false,
    };
  }

  applyLocalRepair(input: {
    proposal: RepairProposal;
    currentPreference?: {
      shotKey: string;
      modelSelection: ShotRequirementSpecV2["modelSelection"];
      promptOverride?: string | undefined;
      skip?: boolean | undefined;
      acceptedRelaxationRefs?: string[] | undefined;
    };
    modelSelection?: ShotRequirementSpecV2["modelSelection"];
  }) {
    return applyLocalRepair(input);
  }
}

export function applyLocalRepair(input: {
  proposal: RepairProposal;
  currentPreference?: {
    shotKey: string;
    modelSelection: ShotRequirementSpecV2["modelSelection"];
    promptOverride?: string | undefined;
    skip?: boolean | undefined;
    acceptedRelaxationRefs?: string[] | undefined;
  };
  modelSelection?: ShotRequirementSpecV2["modelSelection"];
}) {
  if (input.proposal.requiresAiDirector) throw new Error("DIRECTOR_CONFIRMATION_REQUIRED");
  const base = input.currentPreference ?? {
    shotKey: input.proposal.affectedShotKeys[0]!,
    modelSelection: { mode: "AUTO" as const },
    skip: false,
    acceptedRelaxationRefs: [],
  };
  if (input.proposal.action === "CHANGE_IMPLEMENTATION") {
    if (!input.modelSelection) throw new Error("MODEL_SELECTION_REQUIRED");
    return {
      kind: "PLANNING_PREFERENCE" as const,
      preference: { ...base, modelSelection: input.modelSelection },
    };
  }
  if (input.proposal.action === "RELAX_REQUIREMENT") {
    return {
      kind: "PLANNING_PREFERENCE" as const,
      preference: {
        ...base,
        acceptedRelaxationRefs: [
          ...new Set([...(base.acceptedRelaxationRefs ?? []), input.proposal.proposalHash]),
        ].sort(),
      },
    };
  }
  if (input.proposal.action === "REPLACE_ASSET") {
    return {
      kind: "ASSET_NAVIGATION" as const,
      shotKey: base.shotKey,
      blockerCode: input.proposal.blockerCode,
    };
  }
  throw new Error("DIRECTOR_CONFIRMATION_REQUIRED");
}
