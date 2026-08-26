import {
  GenerationPlanV3Schema,
  GenerationSpecV3Schema,
  ShotRequirementSpecV2Schema,
  WorkflowPlanningRequestV3Schema,
  WorkflowPlanningRequestSchema,
  type GenerationImplementationV2,
  type GenerationSpecV3,
  type RequirementPurposeV3Schema,
  type ShotRequirementSpecV2,
  type VersionRefV2,
} from "@comfyuiflow/contracts";
import type { z } from "zod";
import { AssetCandidateService } from "../asset-candidate-service.js";
import { assetCandidateRequirementSchema } from "../asset-candidate-contracts.js";
import { GenerationAdapterRegistry } from "../generation-adapter.js";
import { canonicalSha256 } from "../canonical-json.js";
import { ProjectAssetError } from "../contracts.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { computeShotRequirementHash } from "./requirement-analyzer.js";
import {
  CapabilityPlanRepository,
  evaluateGenerationSpecDependenciesV3,
  ExecutionPlanService,
} from "./execution-plan-service.js";
import { CapabilityRegistryLoader } from "./capability-registry.js";
import { resolveCapabilityCandidatesV2 } from "./capability-resolver-v2.js";
import { CapabilityCompilerRegistry } from "./compiler-registry.js";
import { selectCapabilityImplementationV2 } from "./implementation-selector-v2.js";
import { gatherPlanningInputCandidates } from "./planning-input-service.js";
import { createPlanningInputSnapshotV3 } from "./planning-snapshot-service.js";
import {
  analyzeShotRequirementsV3,
  type NormalizedShotSemanticsV3,
} from "./requirement-analyzer-v3.js";
import { GenerationRegistryLoader } from "./registry.js";
import { WorkflowAgentService } from "./workflow-agent-service.js";
import { validateGenerationSpecV3Handoff } from "./validator.js";
import {
  TrialScopeApprovalService,
  type ActiveTrialScopeItem,
} from "./trial-scope-approval-service.js";

type PlanningPreference = ReturnType<
  typeof WorkflowPlanningRequestSchema.parse
>["shotPreferences"][number];

const versionInclude = {
  generationPlan: { include: { project: true, storyboard: true } },
  specs: {
    include: {
      references: {
        include: {
          productionAssetVersion: { include: { productionAsset: true } },
          assetVersionFile: true,
        },
      },
    },
    orderBy: { ordinal: "asc" as const },
  },
} as const;

export class WorkflowPlanningApplicationService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly registryLoader = new GenerationRegistryLoader(),
    private readonly adapters = new GenerationAdapterRegistry(),
  ) {}

  async previewAndPersist(versionId: string, rawRequest: unknown) {
    const request = WorkflowPlanningRequestSchema.parse(rawRequest);
    const version = await this.client.generationPlanVersion.findUnique({
      where: { id: versionId },
      include: versionInclude,
    });
    if (!version)
      throw new ProjectAssetError(
        "GENERATION_PLAN_VERSION_NOT_FOUND",
        "Generation plan version was not found",
        404,
      );
    if (version.generationPlan.project.status !== "ACTIVE")
      throw new ProjectAssetError("PROJECT_ARCHIVED", "Restore this project before planning", 409);
    if (version.generationPlan.storyboard.status !== "ACTIVE")
      throw new ProjectAssetError(
        "STORYBOARD_ARCHIVED",
        "Restore this storyboard before planning",
        409,
      );
    if (version.generationPlan.headVersionId !== version.id)
      throw new ProjectAssetError(
        "GENERATION_PLAN_STALE",
        "Workflow planning requires the current Shot Plan version",
        409,
      );

    const preferences = new Map(request.shotPreferences.map((item) => [item.shotKey, item]));
    const knownShotKeys = new Set(version.specs.map((spec) => spec.shotKey));
    if ([...preferences.keys()].some((key) => !knownShotKeys.has(key)))
      throw new ProjectAssetError(
        "GENERATION_TARGET_INVALID",
        "A planning preference references an unknown Shot",
        422,
      );

    const registry = await this.registryLoader.load();
    const persistence = new ExecutionPlanService(this.client);
    const implementationRecords = await persistence.syncRegistry(registry);
    const recordIds = [...implementationRecords.values()].flatMap((record) =>
      record ? [record.id] : [],
    );
    const evidence =
      recordIds.length > 0
        ? await this.client.generationImplementationEvidence.findMany({
            where: { implementationId: { in: recordIds } },
            orderBy: [{ implementationId: "asc" }, { recordedAt: "asc" }],
          })
        : [];
    const runtimeFacts = new Map();
    const compilationFacts = new Map();
    for (const [identity, record] of implementationRecords) {
      if (!record) continue;
      const ownEvidence = evidence.filter((item) => item.implementationId === record.id);
      const real = ownEvidence.filter((item) =>
        ["REAL_GENERATION_JOB", "LEGACY_REAL_ARTIFACT"].includes(item.sourceType),
      );
      let adapterImplemented = true;
      try {
        this.adapters.resolveIdentity(record.adapterId, record.adapterVersion);
      } catch {
        adapterImplemented = false;
      }
      const readinessPassed = ownEvidence.some(
        (item) => item.sourceType === "READINESS" && item.technicalResult === "TECHNICALLY_VALID",
      );
      const staticValidationPassed = ownEvidence.some(
        (item) =>
          item.sourceType === "STATIC_VALIDATION" && item.technicalResult === "TECHNICALLY_VALID",
      );
      runtimeFacts.set(identity, {
        lifecycleStatus: record.status,
        providerConfigured: readinessPassed,
        readinessPassed,
        adapterImplemented,
        evidence: {
          passes: real.filter((item) => item.technicalResult === "TECHNICALLY_VALID").length,
          attempts: real.length,
        },
      });
      compilationFacts.set(identity, {
        catalogReady: staticValidationPassed,
        staticValidationPassed,
        preprocessingReady: staticValidationPassed,
      });
    }

    const planningShots = version.specs.map((stored) => ({
      generationSpecId: stored.id,
      spec: this.toRequirementSpec(version, stored, preferences.get(stored.shotKey)),
    }));
    const preview = new WorkflowAgentService(registry, this.adapters).plan({
      shots: planningShots,
      runtimeFacts,
      compilationFacts,
      now: new Date(),
    });
    const persisted: Array<{ id: string }> = [];
    for (const shot of preview.shots) {
      const implementationDatabaseId = shot.implementationIdentity
        ? (implementationRecords.get(shot.implementationIdentity)?.id ?? null)
        : null;
      persisted.push(
        await persistence.persistDraft(
          {
            projectId: version.projectId,
            generationPlanVersionId: version.id,
            generationSpecId: shot.generationSpecId,
            implementationIdentity: shot.implementationIdentity,
            planningInputHash: shot.planningInputHash,
            requirementsHash: shot.requirementsHash,
            capabilitySnapshotHash: shot.capabilitySnapshotHash,
            payload: shot.payload,
            planTemplateSha256: shot.planTemplateSha256,
            estimatedCostMicros: shot.estimatedCostMicros,
            maximumCostMicros: shot.maximumCostMicros,
            currency: shot.currency,
            planningOutcome: shot.planningOutcome,
            blockerCode: shot.blockerCodes[0] ?? null,
          },
          implementationDatabaseId,
        ),
      );
    }
    const executable = preview.shots.filter(
      (shot) => shot.planningOutcome === "READY" || shot.planningOutcome === "TRIAL",
    );
    const currencies = new Set(
      executable.flatMap((shot) => (shot.currency ? [shot.currency] : [])),
    );
    const priceExpiries = executable.flatMap((shot) =>
      shot.pricingExpiresAt ? [shot.pricingExpiresAt] : [],
    );
    const estimatedCostBigInt = executable.reduce(
      (sum, shot) => sum + BigInt(shot.estimatedCostMicros ?? 0),
      0n,
    );
    const maximumCostBigInt = executable.reduce(
      (sum, shot) => sum + BigInt(shot.maximumCostMicros ?? 0),
      0n,
    );
    const costCore =
      executable.length === preview.shots.length &&
      executable.every(
        (shot) =>
          shot.estimatedCostMicros !== null &&
          shot.maximumCostMicros !== null &&
          shot.currency &&
          shot.pricingExpiresAt,
      ) &&
      currencies.size === 1 &&
      estimatedCostBigInt <= BigInt(Number.MAX_SAFE_INTEGER) &&
      maximumCostBigInt <= BigInt(Number.MAX_SAFE_INTEGER)
        ? {
            schemaVersion: "batch-cost-snapshot-v1" as const,
            currency: [...currencies][0]!,
            estimatedCostMicros: Number(estimatedCostBigInt),
            maximumCostMicros: Number(maximumCostBigInt),
            generationCalls: executable.length,
            qaCalls: executable.length,
            pricingExpiresAt: [...priceExpiries].sort()[0]!,
            retryPolicy: "NO_RETRY_NO_FALLBACK" as const,
          }
        : null;
    const costSnapshot = costCore ? { ...costCore, snapshotHash: canonicalSha256(costCore) } : null;
    const continuationCore = {
      schemaVersion: "qa-continuation-policy-v1" as const,
      mode: version.generationPlan.project.continuationMode,
      hardCriteria: [
        "IDENTITY",
        "PRODUCT_STRUCTURE",
        "VISUAL_DAMAGE",
        "UNEXPECTED_OBJECTS",
        "CROSS_FRAME_CONTINUITY",
      ] as const,
      hardFailConfidence: "HIGH" as const,
    };
    const continuationPolicy = {
      ...continuationCore,
      policyHash: canonicalSha256(continuationCore),
    };
    const confirmationTargets = preview.shots.map((shot, index) => ({
      shotExecutionPlanId: persisted[index]!.id,
      planTemplateSha256: shot.planTemplateSha256,
      executionDisposition: "EXECUTE" as const,
    }));
    const confirmationCore = {
      engineVersion: "WORKFLOW_AGENT_V1" as const,
      generationPlanVersionId: version.id,
      dependencyPolicyHash: preview.dependencyPolicyHash,
      targets: confirmationTargets,
      costSnapshot,
      continuationPolicy,
    };
    const confirmationPreviewHash = canonicalSha256(confirmationCore);
    return {
      schemaVersion: preview.schemaVersion,
      projectId: version.projectId,
      generationPlanVersionId: version.id,
      registrySha256: preview.registrySha256,
      dependencyPolicyHash: preview.dependencyPolicyHash,
      counts: preview.counts,
      shots: preview.shots.map((shot, index) => ({
        planId: persisted[index]?.id,
        shotKey: shot.shotKey,
        ordinal: shot.ordinal,
        planningOutcome: shot.planningOutcome,
        blockerCodes: shot.blockerCodes,
        implementationId:
          typeof shot.payload.implementationId === "string" ? shot.payload.implementationId : null,
        modelProfileId:
          typeof shot.payload.modelProfileId === "string" ? shot.payload.modelProfileId : null,
        executorType:
          typeof shot.payload.executorType === "string" ? shot.payload.executorType : null,
        estimatedCostMicros: shot.estimatedCostMicros,
        currency: shot.currency,
        pricingExpiresAt: shot.pricingExpiresAt,
        planTemplateSha256: shot.planTemplateSha256,
      })),
      targets: confirmationTargets,
      costSnapshot,
      continuationPolicy,
      canConfirm:
        preview.counts.blocked === 0 && preview.counts.waiting === 0 && costSnapshot !== null,
      previewHash: confirmationPreviewHash,
      planningPreviewHash: preview.previewHash,
      externalCalls: 0 as const,
      generationAuthorized: false as const,
    };
  }

  private toRequirementSpec(
    version: Awaited<ReturnType<ProjectPrisma["generationPlanVersion"]["findUnique"]>> & {
      generationPlan: any;
      specs: any[];
    },
    stored: any,
    preference?: PlanningPreference,
  ): ShotRequirementSpecV2 {
    if (stored.contractVersion === "shot-requirement-spec-v2" && stored.requirementSpecJson) {
      const parsed = ShotRequirementSpecV2Schema.parse(stored.requirementSpecJson);
      return preference
        ? ShotRequirementSpecV2Schema.parse({
            ...parsed,
            modelSelection: preference.modelSelection,
            requirementHash: computeShotRequirementHash({
              ...parsed,
              modelSelection: preference.modelSelection,
            }),
          })
        : parsed;
    }
    const references = stored.references
      .map((reference: any) => ({
        assetVersionFileId: reference.assetVersionFileId,
        sha256: reference.expectedSha256,
        semanticRole: this.semanticRole(reference),
      }))
      .sort((left: any, right: any) =>
        `${left.semanticRole}:${left.assetVersionFileId}`.localeCompare(
          `${right.semanticRole}:${right.assetVersionFileId}`,
        ),
      );
    const capability =
      stored.capabilityRequirements && typeof stored.capabilityRequirements === "object"
        ? (stored.capabilityRequirements as Record<string, unknown>)
        : {};
    const aspectRatio = ["PORTRAIT_9_16", "LANDSCAPE_16_9", "SQUARE_1_1", "PORTRAIT_4_5"].includes(
      String(capability.aspectRatio),
    )
      ? (capability.aspectRatio as ShotRequirementSpecV2["aspectRatio"])
      : version.generationPlan.project.targetAspectRatio;
    const unhashed = {
      schemaVersion: "shot-requirement-spec-v2" as const,
      projectId: version.projectId,
      storyboardId: version.generationPlan.storyboardId,
      storyboardVersionId: version.generationPlan.storyboardVersionId,
      generationPlanVersionId: version.id,
      storyboardShotId: stored.storyboardShotId,
      shotKey: stored.shotKey,
      ordinal: stored.ordinal,
      startState: stored.startState,
      action: stored.action,
      endState: stored.endState,
      camera: stored.camera,
      composition: stored.composition,
      durationSeconds: stored.durationSeconds,
      aspectRatio,
      references,
      dependencies: [],
      modelSelection: preference?.modelSelection ?? { mode: "AUTO" as const },
    };
    return ShotRequirementSpecV2Schema.parse({
      ...unhashed,
      requirementHash: computeShotRequirementHash(unhashed),
    });
  }

  private semanticRole(reference: any): string {
    const type = reference.productionAssetVersion?.productionAsset?.type;
    const usage = reference.referenceUsage;
    const viewpoint = reference.assetVersionFile?.viewpoint;
    if (type === "SCENE" && usage === "SCENE_STYLE") return "scene";
    if (type === "PROP" && usage === "PROP_DETAIL") return "product";
    if (type === "CHARACTER" && usage === "FACE") return "character_face";
    if (
      type === "CHARACTER" &&
      ["FULL_BODY", "IDENTITY"].includes(usage) &&
      ["REAR", "REAR_THREE_QUARTER"].includes(viewpoint)
    )
      return "character_rear";
    if (type === "CHARACTER" && usage === "FULL_BODY") return "character_full_body";
    return String(usage).toLowerCase();
  }
}

type RequirementPurposeV3 = z.infer<typeof RequirementPurposeV3Schema>;

interface UnorderedPlanningBindingV3 {
  id: string;
  purpose: RequirementPurposeV3;
  sourceKind: "SEMANTIC_ASSET_VERSION" | "CHARACTER_STATE_VERSION";
  sourceRef: VersionRefV2;
  sha256: string;
  modality: "IMAGE" | "VIDEO" | "AUDIO";
  roleLabel: string;
  necessity: "REQUIRED" | "OPTIONAL";
}

const capabilityVersionInclude = {
  project: true,
  storyboard: true,
  shots: {
    include: {
      requirements: {
        include: {
          bindings: {
            include: {
              productionAssetVersion: { include: { productionAsset: true } },
              characterStateVersion: true,
              assetVersionFile: {
                include: { projectAsset: { include: { storedObject: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { ordinal: "asc" as const },
  },
} as const;

const capabilityRefKey = (reference: VersionRefV2) => `${reference.id}@${reference.version}`;

function deterministicUuid(value: unknown) {
  const hash = canonicalSha256(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(
    17,
    20,
  )}-${hash.slice(20, 32)}`;
}

function requirementPurpose(requirement: any): RequirementPurposeV3 {
  const assetType = String(
    requirement.inputJson && typeof requirement.inputJson === "object"
      ? (requirement.inputJson.assetType ?? "")
      : "",
  ).toUpperCase();
  if (assetType === "CHARACTER") return "CHARACTER";
  if (assetType === "PROP" || assetType === "PRODUCT") return "PRODUCT";
  if (assetType === "SCENE" || assetType === "ENVIRONMENT") return "ENVIRONMENT";
  if (assetType === "STYLE") return "STYLE";
  if (assetType === "CONTINUITY") return "CONTINUITY";
  if (assetType === "MOTION") return "MOTION";
  if (assetType === "AUDIO") return "AUDIO";
  return "OTHER";
}

function normalizedSemantics(shot: any): NormalizedShotSemanticsV3 {
  const purposes = new Set<RequirementPurposeV3>(shot.requirements.map(requirementPurpose));
  const hasCharacterState = shot.requirements.some((requirement: any) =>
    requirement.bindings.some((binding: any) => Boolean(binding.characterStateVersionId)),
  );
  const hasAudioBinding = shot.requirements.some((requirement: any) =>
    requirement.bindings.some(
      (binding: any) => binding.assetVersionFile.projectAsset.mediaType === "AUDIO",
    ),
  );
  return {
    personPresent: purposes.has("CHARACTER"),
    explicitCharacterIdentityRequired: purposes.has("CHARACTER"),
    appearanceContinuityRequired: hasCharacterState,
    productIdentityRequired: purposes.has("PRODUCT"),
    environmentIdentityRequired: purposes.has("ENVIRONMENT"),
    styleReferenceDesired: purposes.has("STYLE"),
    previousFinalFrameRequired: purposes.has("CONTINUITY"),
    motionReferenceRequired: purposes.has("MOTION"),
    audioReferenceRequired: purposes.has("AUDIO") || hasAudioBinding,
  };
}

function outputDimensions(aspectRatio: string) {
  if (aspectRatio === "LANDSCAPE_16_9") return { width: 1920, height: 1080 };
  if (aspectRatio === "SQUARE_1_1") return { width: 1080, height: 1080 };
  if (aspectRatio === "PORTRAIT_4_5") return { width: 1080, height: 1350 };
  return { width: 1080, height: 1920 };
}

/**
 * Feature 016 planning path. It starts from a saved current Storyboard head and creates immutable
 * per-Shot lineage. It deliberately has no Storyboard/Shot-Plan approval or execution authority.
 */
export class CapabilityWorkflowPlanningApplicationService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly registryLoader = new CapabilityRegistryLoader(),
    private readonly compilerRegistry = new CapabilityCompilerRegistry(),
  ) {}

  private async automaticPlanningBindings(
    storedRequirement: any,
    purpose: RequirementPurposeV3,
    necessity: "REQUIRED" | "OPTIONAL",
  ): Promise<UnorderedPlanningBindingV3[]> {
    const parsed = assetCandidateRequirementSchema.safeParse(storedRequirement.inputJson);
    if (!parsed.success) return [];
    let preview: Awaited<ReturnType<AssetCandidateService["preview"]>>;
    try {
      preview = await new AssetCandidateService(this.client).preview(parsed.data);
    } catch {
      return [];
    }
    if (preview.gaps.length > 0 || preview.eligible.length === 0) return [];
    const eligibleOrder = new Map(
      preview.eligible.map((candidate, index) => [candidate.bindingId, index]),
    );
    const rows = await this.client.assetVersionFile.findMany({
      where: { id: { in: preview.eligible.map((candidate) => candidate.bindingId) } },
      include: {
        productionAssetVersion: true,
        projectAsset: { include: { storedObject: true } },
      },
    });
    rows.sort(
      (left, right) =>
        (eligibleOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (eligibleOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
    const selectedRows = parsed.data.referenceUsages.flatMap((usage) => {
      const selected = rows.find((row) => row.referenceUsage === usage);
      return selected ? [selected] : [];
    });
    if (selectedRows.length !== parsed.data.referenceUsages.length) return [];
    const characterState = parsed.data.characterStateVersionId
      ? await this.client.characterStateVersion.findUnique({
          where: { id: parsed.data.characterStateVersionId },
        })
      : null;
    if (parsed.data.characterStateVersionId && !characterState) return [];
    const candidates = selectedRows.map((row) => {
      const sourceKind = characterState
        ? ("CHARACTER_STATE_VERSION" as const)
        : ("SEMANTIC_ASSET_VERSION" as const);
      const sourceRef = characterState
        ? { id: characterState.id, version: String(characterState.versionNumber) }
        : {
            id: row.productionAssetVersion.id,
            version: String(row.productionAssetVersion.versionNumber),
          };
      return {
        id: deterministicUuid({
          kind: "automatic-planning-binding-v3",
          requirementId: storedRequirement.id,
          assetVersionFileId: row.id,
          characterStateVersionId: characterState?.id ?? null,
        }),
        semanticIdentityRef: sourceRef,
        purpose,
        sourceKind,
        sourceRef,
        sha256: row.projectAsset.storedObject.sha256,
        modality: row.projectAsset.mediaType as "IMAGE" | "VIDEO" | "AUDIO",
        displayFilename: row.projectAsset.displayName,
        approved: row.approvalStatus === "ACCEPTED",
        ready: row.status === "ACTIVE" && row.projectAsset.status === "READY",
        hashVerified:
          row.projectAsset.storedObject.verificationStatus === "VERIFIED" &&
          /^[a-f0-9]{64}$/.test(row.projectAsset.storedObject.sha256),
        roleLabel: `${storedRequirement.requirementKey}:${row.referenceUsage.toLowerCase()}`,
        necessity,
      };
    });
    const eligible = gatherPlanningInputCandidates({ requiredPurposes: [purpose], candidates });
    const completeById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    return eligible.map((candidate) => {
      const complete = completeById.get(candidate.id)!;
      return {
        id: complete.id,
        purpose: complete.purpose,
        sourceKind: complete.sourceKind,
        sourceRef: complete.sourceRef,
        sha256: complete.sha256,
        modality: complete.modality,
        roleLabel: complete.roleLabel,
        necessity: complete.necessity,
      };
    });
  }

  async previewAndPersistStoryboard(versionId: string, rawRequest: unknown) {
    const request = WorkflowPlanningRequestV3Schema.parse(rawRequest);
    const version = await this.client.storyboardVersion.findUnique({
      where: { id: versionId },
      include: capabilityVersionInclude,
    });
    if (!version)
      throw new ProjectAssetError(
        "STORYBOARD_VERSION_NOT_FOUND",
        "Storyboard version was not found",
        404,
      );
    if (version.projectId !== request.projectId)
      throw new ProjectAssetError(
        "CROSS_PROJECT",
        "Storyboard version belongs to another project",
        409,
      );
    if (version.project.status !== "ACTIVE")
      throw new ProjectAssetError("PROJECT_ARCHIVED", "Restore this project before planning", 409);
    if (version.storyboard.status !== "ACTIVE")
      throw new ProjectAssetError(
        "STORYBOARD_ARCHIVED",
        "Restore this storyboard before planning",
        409,
      );
    if (version.storyboard.headVersionId !== version.id)
      throw new ProjectAssetError(
        "STORYBOARD_VERSION_STALE",
        "Workflow planning requires the current saved Storyboard head",
        409,
      );
    const expectedRevisionRef = { id: version.id, version: version.contentHash };
    if (
      request.storyboardRevisionRefs.length !== 1 ||
      capabilityRefKey(request.storyboardRevisionRefs[0]!) !== capabilityRefKey(expectedRevisionRef)
    )
      throw new ProjectAssetError(
        "STORYBOARD_REVISION_MISMATCH",
        "Planning requires the exact current Storyboard revision",
        409,
      );

    const selectedShotIds = new Set(request.shotIds);
    const shots = version.shots.filter((shot) => selectedShotIds.has(shot.id));
    if (shots.length !== request.shotIds.length)
      throw new ProjectAssetError(
        "GENERATION_TARGET_INVALID",
        "A selected Shot does not belong to this Storyboard revision",
        422,
      );
    const constraints = new Map<string, RequirementPurposeV3[]>();
    for (const constraint of request.optionalOwnerConstraints) {
      const current = constraints.get(constraint.shotId) ?? [];
      current.push(constraint.purpose);
      constraints.set(constraint.shotId, current);
    }

    const registry = await this.registryLoader.load();
    const activeTrialItemsByShot = await new TrialScopeApprovalService(
      this.client,
      this.registryLoader,
    ).activeItemsByShot(version.id, registry);
    const repository = new CapabilityPlanRepository(this.client);
    const results: Array<{
      shot: (typeof shots)[number];
      implementation: GenerationImplementationV2;
      generationSpec: GenerationSpecV3;
      planningOutcome: "READY" | "TRIAL" | "BLOCKED";
      blockerCodes: string[];
      requirement: ReturnType<typeof analyzeShotRequirementsV3>;
      snapshot: ReturnType<typeof createPlanningInputSnapshotV3>;
    }> = [];

    for (const shot of shots) {
      const semantics = normalizedSemantics(shot);
      const selectedEvidencePurposes = constraints.get(shot.id) ?? [];
      const requirementVersion = canonicalSha256({
        shotId: shot.id,
        storyboardRevisionRef: expectedRevisionRef,
        semantics,
        selectedEvidencePurposes: [...selectedEvidencePurposes].sort(),
      });
      const requirement = analyzeShotRequirementsV3({
        specId: deterministicUuid({ kind: "requirement-v3", shotId: shot.id, requirementVersion }),
        version: requirementVersion,
        shotId: shot.id,
        storyboardRevisionRef: expectedRevisionRef,
        semantics,
        selectedEvidencePurposes,
      });

      const rawBindings: UnorderedPlanningBindingV3[] = [];
      for (const storedRequirement of shot.requirements) {
        const purpose = requirementPurpose(storedRequirement);
        const necessity =
          requirement.purposes.find((item) => item.purpose === purpose)?.necessity === "REQUIRED"
            ? ("REQUIRED" as const)
            : ("OPTIONAL" as const);
        const explicitBindings = storedRequirement.bindings.flatMap((binding) => {
          const mediaType = binding.assetVersionFile.projectAsset.mediaType;
          if (!(["IMAGE", "VIDEO", "AUDIO"] as const).includes(mediaType as any)) return [];
          const semanticVersion = String(binding.productionAssetVersion.versionNumber);
          const sourceKind = binding.characterStateVersion
            ? ("CHARACTER_STATE_VERSION" as const)
            : ("SEMANTIC_ASSET_VERSION" as const);
          const sourceRef = binding.characterStateVersion
            ? {
                id: binding.characterStateVersion.id,
                version: String(binding.characterStateVersion.versionNumber),
              }
            : { id: binding.productionAssetVersion.id, version: semanticVersion };
          return [
            {
              id: binding.id,
              purpose,
              sourceKind,
              sourceRef,
              sha256: binding.assetVersionFile.projectAsset.storedObject.sha256,
              modality: mediaType as "IMAGE" | "VIDEO" | "AUDIO",
              roleLabel: storedRequirement.requirementKey,
              necessity,
            },
          ];
        });
        if (explicitBindings.length > 0) rawBindings.push(...explicitBindings);
        else
          rawBindings.push(
            ...(await this.automaticPlanningBindings(storedRequirement, purpose, necessity)),
          );
      }
      const requiredCapability = semantics.previousFinalFrameRequired
        ? ("PREVIOUS_FINAL_FRAME_TO_VIDEO" as const)
        : requirement.purposes.some((item) => item.necessity === "REQUIRED") ||
            rawBindings.length > 0
          ? ("ORDERED_REFERENCE_TO_VIDEO" as const)
          : ("TEXT_TO_VIDEO" as const);
      const shotTrialItems =
        activeTrialItemsByShot.get(shot.id) ?? new Map<string, ActiveTrialScopeItem[]>();
      const resolution = resolveCapabilityCandidatesV2(registry, {
        bindings: rawBindings.map((binding, order) => ({ ...binding, order })),
        requiredCapability,
        allowedTrialRefs: new Set(shotTrialItems.keys()),
      });
      const fallback = registry.document.implementations
        .filter(
          (candidate) =>
            !candidate.testOnly &&
            !["DISCOVERED", "DEPRECATED", "DISABLED"].includes(candidate.lifecycle) &&
            candidate.capabilityCodes.includes(requiredCapability),
        )
        .sort((left, right) =>
          `${left.id}@${left.version}`.localeCompare(`${right.id}@${right.version}`),
        )[0];
      const implementation = selectCapabilityImplementationV2(resolution.compatible) ?? fallback;
      if (!implementation)
        throw new ProjectAssetError(
          "CAPABILITY_IMPLEMENTATION_NOT_FOUND",
          "No reviewed implementation can represent this Shot",
          422,
        );
      const boundPurposes = new Set(rawBindings.map((binding) => binding.purpose));
      const unresolvedRequirementCodes = requirement.purposes
        .filter((item) => item.necessity === "REQUIRED" && !boundPurposes.has(item.purpose))
        .map((item) => `UNRESOLVED_${item.purpose}`)
        .sort();
      const omittedRequirementCodes = requirement.purposes
        .filter((item) => item.necessity === "OMITTED")
        .map((item) => item.reasonCode)
        .sort();
      const snapshotVersion = canonicalSha256({
        requirementHash: requirement.requirementHash,
        implementationRef: { id: implementation.id, version: implementation.version },
        compilerRef: implementation.compilerRef,
        bindings: rawBindings,
      });
      const snapshot = createPlanningInputSnapshotV3({
        snapshotId: deterministicUuid({ kind: "snapshot-v3", shotId: shot.id, snapshotVersion }),
        version: snapshotVersion,
        requirementSpecRef: { id: requirement.id, version: requirement.version },
        implementationRef: { id: implementation.id, version: implementation.version },
        compilerRef: implementation.compilerRef,
        bindings: rawBindings,
        omittedRequirementCodes,
        unresolvedRequirementCodes,
      });
      const generationIntent = {
        prompt: [
          `Start state: ${shot.startState.trim()}`,
          `Action: ${shot.action.trim()}`,
          `End state: ${shot.endState.trim()}`,
          `Camera: ${shot.camera.trim()}`,
          `Composition: ${shot.composition.trim()}`,
        ].join("\n"),
        durationSeconds: shot.durationSeconds,
      };
      const compilerProfile = registry.compilersByRef.get(
        capabilityRefKey(implementation.compilerRef),
      );
      if (!compilerProfile)
        throw new ProjectAssetError(
          "COMPILER_VERSION_UNKNOWN",
          "The exact compiler version is unavailable",
          409,
        );
      const resolutionBlockers =
        resolution.rejected.find(
          (item) => capabilityRefKey(item.implementationRef) === capabilityRefKey(implementation),
        )?.reasonCodes ?? [];
      let compiledRequestDigest: string;
      let compilerBlocker: string | null = null;
      try {
        compiledRequestDigest = this.compilerRegistry.compile(compilerProfile, {
          compilerRef: implementation.compilerRef,
          prompt: generationIntent.prompt,
          durationSeconds: generationIntent.durationSeconds,
          bindings: snapshot.bindings.map(
            ({ sourceRef, sha256, modality, order, roleLabel, necessity }) => ({
              sourceRef,
              sha256,
              modality,
              order,
              roleLabel,
              necessity,
            }),
          ),
        }).compiledRequestDigest;
      } catch {
        compilerBlocker = "INPUT_CONTRACT_UNSATISFIED";
        compiledRequestDigest = canonicalSha256({
          compilerRef: implementation.compilerRef,
          generationIntent,
          snapshotHash: snapshot.snapshotHash,
          blockerCode: compilerBlocker,
        });
      }
      const inputHash = canonicalSha256({
        requirementHash: requirement.requirementHash,
        snapshotHash: snapshot.snapshotHash,
        generationIntent,
      });
      const dependencyHash = canonicalSha256({
        storyboardRevisionRef: expectedRevisionRef,
        continuityRequirements: shot.continuityRequirements,
      });
      const versionDigest = canonicalSha256({
        inputHash,
        dependencyHash,
        implementationRef: { id: implementation.id, version: implementation.version },
        compiledRequestDigest,
      });
      const withoutOutputHash = {
        id: deterministicUuid({ kind: "generation-spec-v3", shotId: shot.id, versionDigest }),
        version: versionDigest,
        shotId: shot.id,
        storyboardRevisionRef: expectedRevisionRef,
        requirementSpecRef: { id: requirement.id, version: requirement.version },
        planningInputSnapshotRef: { id: snapshot.id, version: snapshot.version },
        implementationRef: { id: implementation.id, version: implementation.version },
        runtimeRef: implementation.runtimeRef,
        providerRef: implementation.providerRef,
        modelRef: implementation.modelRef,
        adapterRef: implementation.adapterRef,
        compilerRef: implementation.compilerRef,
        generationIntent,
        compiledRequestDigest,
        expectedOutput: {
          mediaType: "video/mp4" as const,
          ...outputDimensions(version.project.targetAspectRatio),
          fps: 30,
        },
        inputHash,
        dependencyHash,
      };
      const generationSpec = validateGenerationSpecV3Handoff(
        GenerationSpecV3Schema.parse({
          ...withoutOutputHash,
          outputHash: canonicalSha256(withoutOutputHash),
        }),
      );
      const matchingTrialScope =
        implementation.lifecycle !== "TRIAL" ||
        (shotTrialItems.get(capabilityRefKey(implementation)) ?? []).some(
          (item) =>
            item.generationSpecRef.id === generationSpec.id &&
            item.generationSpecRef.version === generationSpec.version &&
            item.compiledRequestDigest === generationSpec.compiledRequestDigest,
        );
      await repository.persistRequirement({
        projectId: version.projectId,
        storyboardVersionId: version.id,
        storyboardShotId: shot.id,
        spec: requirement,
      });
      await repository.persistSnapshot({ projectId: version.projectId, snapshot });
      await repository.persistGenerationSpec({
        projectId: version.projectId,
        storyboardVersionId: version.id,
        spec: generationSpec,
      });
      const blockerCodes = [
        ...new Set([
          ...unresolvedRequirementCodes,
          ...evaluateGenerationSpecDependenciesV3({
            continuityRequired: semantics.previousFinalFrameRequired,
            bindings: snapshot.bindings,
          }),
          ...resolutionBlockers,
          ...(!matchingTrialScope ? ["TRIAL_SCOPE_REQUIRED"] : []),
          ...(compilerBlocker ? [compilerBlocker] : []),
        ]),
      ].sort();
      const planningOutcome =
        blockerCodes.length > 0
          ? ("BLOCKED" as const)
          : implementation.lifecycle === "READY"
            ? ("READY" as const)
            : ("TRIAL" as const);
      results.push({
        shot,
        implementation,
        generationSpec,
        planningOutcome,
        blockerCodes,
        requirement,
        snapshot,
      });
    }

    const generationSpecRefs = results.map(({ generationSpec }) => ({
      id: generationSpec.id,
      version: generationSpec.version,
    }));
    const planCore = {
      storyboardRevisionRefs: [expectedRevisionRef],
      generationSpecRefs,
      shotIds: results.map(({ shot }) => shot.id),
      expectedCalls: results.filter(({ planningOutcome }) => planningOutcome !== "BLOCKED").length,
      costPolicyDigest: canonicalSha256(
        results.map(({ implementation }) => ({
          implementationRef: { id: implementation.id, version: implementation.version },
          costPolicy: implementation.costPolicy,
        })),
      ),
      state: results.some(({ planningOutcome }) => planningOutcome === "BLOCKED")
        ? ("BLOCKED" as const)
        : ("VALID" as const),
    };
    const planDigest = canonicalSha256(planCore);
    const plan = GenerationPlanV3Schema.parse({
      id: deterministicUuid({
        kind: "generation-plan-v3",
        projectId: version.projectId,
        planDigest,
      }),
      version: planDigest,
      ...planCore,
      planDigest,
    });
    const persistedPlan = await repository.persistPlan(version.projectId, plan);
    return {
      schemaVersion: "workflow-planning-preview-v3" as const,
      projectId: version.projectId,
      storyboardVersionId: version.id,
      planId: persistedPlan.id,
      planDigest: plan.planDigest,
      state: plan.state,
      registrySha256: registry.registrySha256,
      counts: {
        ready: results.filter(({ planningOutcome }) => planningOutcome === "READY").length,
        trial: results.filter(({ planningOutcome }) => planningOutcome === "TRIAL").length,
        blocked: results.filter(({ planningOutcome }) => planningOutcome === "BLOCKED").length,
      },
      shots: results.map(
        ({
          shot,
          implementation,
          generationSpec,
          planningOutcome,
          blockerCodes,
          requirement,
          snapshot,
        }) => ({
          shotId: shot.id,
          shotKey: shot.shotKey,
          ordinal: shot.ordinal,
          planningOutcome,
          blockerCodes,
          requirements: requirement.purposes,
          bindings: snapshot.bindings,
          omittedRequirementCodes: snapshot.omittedRequirementCodes,
          unresolvedRequirementCodes: snapshot.unresolvedRequirementCodes,
          implementationRef: { id: implementation.id, version: implementation.version },
          implementationLifecycle: implementation.lifecycle,
          generationSpecRef: { id: generationSpec.id, version: generationSpec.version },
          compiledRequestDigest: generationSpec.compiledRequestDigest,
        }),
      ),
      externalCalls: 0 as const,
      generationAuthorized: false as const,
    };
  }

  async getPlan(planId: string) {
    const record = await this.client.generationPlanV3Record.findUnique({ where: { id: planId } });
    if (!record)
      throw new ProjectAssetError(
        "GENERATION_PLAN_NOT_FOUND",
        "Generation plan was not found",
        404,
      );
    return {
      schemaVersion: "workflow-plan-detail-v3" as const,
      ...GenerationPlanV3Schema.parse(record.payloadJson),
      state: record.state,
      stateReasonCode: record.stateReasonCode,
      createdAt: record.createdAt.toISOString(),
      externalCalls: 0 as const,
      generationAuthorized: record.state === "AUTHORIZED",
    };
  }
}
