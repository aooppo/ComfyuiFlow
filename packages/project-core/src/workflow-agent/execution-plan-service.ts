import { randomUUID } from "node:crypto";
import type {
  GenerationAuthorizationV3,
  GenerationImplementation,
  GenerationPlanV3,
  GenerationRegistry,
  GenerationSpecV3,
  MaterializedGraphSnapshotV3,
  PlanningInputSnapshotV3,
  ReferencePlanV3,
  ShotRequirementSpecV3,
} from "@comfyuiflow/contracts";
import {
  ExecutionInputSnapshotSchema,
  GenerationAuthorizationV3Schema,
  GenerationPlanV3Schema,
  GenerationSpecV3Schema,
  MaterializedGraphSnapshotV3Schema,
  PlanningInputSnapshotV3Schema,
  ReferencePlanV3Schema,
  ShotRequirementSpecV3Schema,
} from "@comfyuiflow/contracts";
import type { Prisma } from "../generated/client/index.js";
import { canonicalSha256 } from "../canonical-json.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import type { LoadedGenerationRegistry } from "./registry.js";

function implementationIdentity(implementation: GenerationImplementation) {
  return `${implementation.implementationId}@${implementation.version}`;
}

function implementationSnapshots(implementation: GenerationImplementation, registrySha256: string) {
  return {
    registrySha256,
    capabilitySnapshotHash: canonicalSha256({ capabilities: implementation.capabilities }),
    constraintsSnapshotHash: canonicalSha256(implementation.constraints),
    patternSnapshotHash: canonicalSha256({
      referenceWorkflowIds: implementation.referenceWorkflowIds,
      referenceWorkflowSha256: implementation.referenceWorkflowSha256 ?? null,
      patternIds: implementation.patternIds,
      nodeClasses: implementation.nodeClasses,
    }),
    runtimeSnapshotHash: canonicalSha256({
      status: implementation.defaultStatus,
      selectable: implementation.selectable,
      availabilityCode: implementation.availabilityCode,
      pricing: implementation.pricing,
    }),
    compilerSnapshotHash: canonicalSha256({
      executorType: implementation.executorType,
      adapterId: implementation.adapterId,
      adapterVersion: implementation.adapterVersion,
    }),
  };
}

export interface DraftExecutionPlanInput {
  projectId: string;
  generationPlanVersionId: string;
  generationSpecId: string;
  implementationIdentity: string | null;
  planningInputHash: string;
  requirementsHash: string;
  capabilitySnapshotHash: string;
  payload: Record<string, unknown>;
  planTemplateSha256: string;
  estimatedCostMicros: number | null;
  maximumCostMicros: number | null;
  currency: string | null;
  planningOutcome: "READY" | "TRIAL" | "BLOCKED" | "WAITING_FOR_UPSTREAM_REPAIR";
  blockerCode: string | null;
}

export class ExecutionPlanService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async syncRegistry(registry: LoadedGenerationRegistry) {
    const records = new Map<
      string,
      Awaited<ReturnType<ProjectPrisma["generationImplementation"]["findUnique"]>>
    >();
    for (const implementation of registry.document.implementations) {
      const snapshots = implementationSnapshots(implementation, registry.registrySha256);
      const where = {
        implementationKey_version: {
          implementationKey: implementation.implementationId,
          version: implementation.version,
        },
      };
      let record = await this.client.generationImplementation.findUnique({ where });
      if (!record) {
        try {
          record = await this.client.generationImplementation.create({
            data: {
              id: randomUUID(),
              implementationKey: implementation.implementationId,
              version: implementation.version,
              providerProfileId: implementation.providerId,
              modelProfileId: implementation.modelProfileId,
              executorType: implementation.executorType,
              adapterId: implementation.adapterId,
              adapterVersion: implementation.adapterVersion,
              ...snapshots,
              status: implementation.defaultStatus,
              statusReasonCode: implementation.availabilityCode,
            },
          });
        } catch (error) {
          if (!(
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          ))
            throw error;
          record = await this.client.generationImplementation.findUnique({ where });
          if (!record) throw error;
        }
      } else {
        const expected = {
          implementationKey: implementation.implementationId,
          version: implementation.version,
          providerProfileId: implementation.providerId,
          modelProfileId: implementation.modelProfileId,
          executorType: implementation.executorType,
          adapterId: implementation.adapterId,
          adapterVersion: implementation.adapterVersion,
          ...snapshots,
        };
        for (const [key, value] of Object.entries(expected)) {
          if (record[key as keyof typeof record] !== value)
            throw new Error(
              `IMPLEMENTATION_VERSION_CONFLICT:${implementationIdentity(implementation)}:${key}`,
            );
        }
      }
      records.set(implementationIdentity(implementation), record);
    }
    return records;
  }

  async appendEvidence(input: {
    implementationDatabaseId: string;
    sourceType: "REAL_GENERATION_JOB" | "LEGACY_REAL_ARTIFACT" | "STATIC_VALIDATION" | "READINESS";
    sourceId: string;
    runtimeSnapshotHash: string;
    catalogSnapshotHash: string;
    technicalResult: "TECHNICALLY_VALID" | "TECHNICAL_FAILED" | "AMBIGUOUS";
    providerCallCount: number;
    planTemplateSha256?: string;
    jobId?: string;
    artifactId?: string;
  }) {
    const unique = {
      implementationId_sourceType_sourceId: {
        implementationId: input.implementationDatabaseId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    };
    const existing = await this.client.generationImplementationEvidence.findUnique({
      where: unique,
    });
    if (existing) return existing;
    try {
      return await this.client.generationImplementationEvidence.create({
        data: {
          id: randomUUID(),
          implementationId: input.implementationDatabaseId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          runtimeSnapshotHash: input.runtimeSnapshotHash,
          catalogSnapshotHash: input.catalogSnapshotHash,
          technicalResult: input.technicalResult,
          providerCallCount: input.providerCallCount,
          ...(input.planTemplateSha256 ? { planTemplateSha256: input.planTemplateSha256 } : {}),
          ...(input.jobId ? { jobId: input.jobId } : {}),
          ...(input.artifactId ? { artifactId: input.artifactId } : {}),
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const winner = await this.client.generationImplementationEvidence.findUnique({
          where: unique,
        });
        if (winner) return winner;
      }
      throw error;
    }
  }

  async persistDraft(input: DraftExecutionPlanInput, implementationDatabaseId: string | null) {
    const where = {
      generationPlanVersionId_generationSpecId_planningInputHash: {
        generationPlanVersionId: input.generationPlanVersionId,
        generationSpecId: input.generationSpecId,
        planningInputHash: input.planningInputHash,
      },
    };
    const existing = await this.client.shotExecutionPlan.findUnique({ where });
    if (existing) {
      if (existing.planTemplateSha256 !== input.planTemplateSha256)
        throw new Error("EXECUTION_PLAN_SHA_MISMATCH");
      return existing;
    }
    try {
      return await this.client.shotExecutionPlan.create({
        data: {
          id: randomUUID(),
          projectId: input.projectId,
          generationPlanVersionId: input.generationPlanVersionId,
          generationSpecId: input.generationSpecId,
          implementationId: implementationDatabaseId,
          executorType:
            typeof input.payload.executorType === "string"
              ? (input.payload.executorType as "COMFYUI_GRAPH" | "DIRECT_PROVIDER_API")
              : null,
          adapterId: typeof input.payload.adapterId === "string" ? input.payload.adapterId : null,
          adapterVersion:
            typeof input.payload.adapterVersion === "string" ? input.payload.adapterVersion : null,
          planningInputHash: input.planningInputHash,
          requirementsHash: input.requirementsHash,
          capabilitySnapshotHash: input.capabilitySnapshotHash,
          payloadJson: input.payload as Prisma.InputJsonValue,
          planTemplateSha256: input.planTemplateSha256,
          estimatedCostMicros: input.estimatedCostMicros,
          maximumCostMicros: input.maximumCostMicros,
          currency: input.currency,
          estimatedGenerationCalls:
            input.planningOutcome === "READY" || input.planningOutcome === "TRIAL" ? 1 : 0,
          estimatedQaCalls:
            input.planningOutcome === "READY" || input.planningOutcome === "TRIAL" ? 1 : 0,
          planningOutcome: input.planningOutcome,
          blockerCode: input.blockerCode,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const winner = await this.client.shotExecutionPlan.findUnique({ where });
        if (winner?.planTemplateSha256 === input.planTemplateSha256) return winner;
      }
      throw error;
    }
  }

  async freeze(planId: string, expectedPlanTemplateSha256: string) {
    const updated = await this.client.shotExecutionPlan.updateMany({
      where: {
        id: planId,
        lifecycleStatus: "DRAFT",
        planTemplateSha256: expectedPlanTemplateSha256,
        planningOutcome: { in: ["READY", "TRIAL"] },
      },
      data: { lifecycleStatus: "FROZEN", frozenAt: new Date() },
    });
    if (updated.count !== 1) throw new Error("EXECUTION_PLAN_SHA_MISMATCH");
    return this.client.shotExecutionPlan.findUniqueOrThrow({ where: { id: planId } });
  }

  async invalidate(planIds: readonly string[], invalidationCode: string) {
    if (planIds.length === 0) return { count: 0 };
    return this.client.shotExecutionPlan.updateMany({
      where: { id: { in: [...planIds] }, lifecycleStatus: { in: ["DRAFT", "FROZEN"] } },
      data: { lifecycleStatus: "INVALIDATED", invalidatedAt: new Date(), invalidationCode },
    });
  }

  async materializeTargetInputs(targetId: string) {
    const target = await this.client.generationBatchTarget.findUnique({
      where: { id: targetId },
      include: {
        shotExecutionPlan: true,
        generationBatch: {
          include: {
            targets: {
              include: {
                shotExecutionPlan: true,
                sourceArtifact: { include: { reviewFrames: true } },
                job: { include: { artifacts: { include: { reviewFrames: true } } } },
              },
            },
          },
        },
      },
    });
    if (!target?.shotExecutionPlan) throw new Error("PRE_DISPATCH_BLOCKED");
    const payload = target.shotExecutionPlan.payloadJson as Record<string, any>;
    const inputBindings = Array.isArray(payload.inputBindings) ? payload.inputBindings : [];
    const bindings: Array<{
      sourceArtifactSha256: string;
      frameSha256?: string;
      extractorVersion?: string;
    }> = [];
    for (const binding of inputBindings) {
      if (binding?.type === "ASSET_VERSION") {
        if (typeof binding.sha256 !== "string") throw new Error("MATERIALIZED_INPUT_SHA_MISMATCH");
        bindings.push({ sourceArtifactSha256: binding.sha256 });
        continue;
      }
      if (
        binding?.type !== "PREVIOUS_SHOT_FINAL_FRAME" ||
        typeof binding.sourceShotExecutionPlanSha256 !== "string"
      )
        throw new Error("MATERIALIZED_INPUT_SHA_MISMATCH");
      const upstream = target.generationBatch.targets.find(
        (candidate) =>
          candidate.shotExecutionPlan?.planTemplateSha256 === binding.sourceShotExecutionPlanSha256,
      );
      if (!upstream) throw new Error("UPSTREAM_ARTIFACT_NOT_READY");
      const artifacts =
        upstream.executionDisposition === "REUSE_ARTIFACT"
          ? upstream.sourceArtifact
            ? [upstream.sourceArtifact]
            : []
          : (upstream.job?.artifacts.filter(
              (artifact) => artifact.status === "TECHNICALLY_VALID",
            ) ?? []);
      if (artifacts.length !== 1 || artifacts[0]?.status !== "TECHNICALLY_VALID")
        throw new Error("UPSTREAM_ARTIFACT_NOT_READY");
      const artifact = artifacts[0];
      const frames = artifact.reviewFrames.filter(
        (frame) => frame.role === "FINAL" && frame.extractorVersion === "dependency-final-frame-v1",
      );
      if (
        frames.length !== 1 ||
        frames[0]?.frameIndex === null ||
        frames[0]?.pts === null ||
        frames[0]?.timeBaseNumerator === null ||
        frames[0]?.timeBaseDenominator === null
      )
        throw new Error("UPSTREAM_ARTIFACT_NOT_READY");
      const frame = frames[0];
      if (!frame) throw new Error("UPSTREAM_ARTIFACT_NOT_READY");
      bindings.push({
        sourceArtifactSha256: artifact.sha256,
        frameSha256: frame.sha256,
        extractorVersion: frame.extractorVersion,
      });
    }
    const materializedInputHash = canonicalSha256(bindings);
    const materializedExecutionSha256 = canonicalSha256({
      planTemplateSha256: target.shotExecutionPlan.planTemplateSha256,
      materializedInputHash,
    });
    const snapshot = ExecutionInputSnapshotSchema.parse({
      schemaVersion: "execution-input-snapshot-v1",
      planTemplateSha256: target.shotExecutionPlan.planTemplateSha256,
      bindings,
      materializedInputHash,
      materializedExecutionSha256,
    });
    if (target.materializedExecutionSha256) {
      if (
        target.materializedInputHash !== materializedInputHash ||
        target.materializedExecutionSha256 !== materializedExecutionSha256
      ) {
        await this.invalidateBatchPlanClosure(
          target.generationBatchId,
          target.shotExecutionPlan.planTemplateSha256,
          "MATERIALIZED_INPUT_SHA_MISMATCH",
        );
        throw new Error("MATERIALIZED_INPUT_SHA_MISMATCH");
      }
      return snapshot;
    }
    const updated = await this.client.generationBatchTarget.updateMany({
      where: { id: target.id, materializedExecutionSha256: null },
      data: {
        executionInputSnapshotJson: snapshot as Prisma.InputJsonValue,
        materializedInputHash,
        materializedExecutionSha256,
      },
    });
    if (updated.count !== 1) {
      const winner = await this.client.generationBatchTarget.findUniqueOrThrow({
        where: { id: target.id },
      });
      if (
        winner.materializedInputHash !== materializedInputHash ||
        winner.materializedExecutionSha256 !== materializedExecutionSha256
      )
        throw new Error("MATERIALIZED_INPUT_SHA_MISMATCH");
    }
    return snapshot;
  }

  private async invalidateBatchPlanClosure(
    batchId: string,
    sourcePlanTemplateSha256: string,
    code: string,
  ) {
    const targets = await this.client.generationBatchTarget.findMany({
      where: { generationBatchId: batchId, shotExecutionPlanId: { not: null } },
      include: { shotExecutionPlan: true },
    });
    const affectedHashes = new Set([sourcePlanTemplateSha256]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const target of targets) {
        if (
          !target.shotExecutionPlan ||
          affectedHashes.has(target.shotExecutionPlan.planTemplateSha256)
        )
          continue;
        const payload = target.shotExecutionPlan.payloadJson as Record<string, any>;
        const dependsOnAffected = (
          Array.isArray(payload.inputBindings) ? payload.inputBindings : []
        ).some(
          (binding: any) =>
            binding?.type === "PREVIOUS_SHOT_FINAL_FRAME" &&
            affectedHashes.has(binding.sourceShotExecutionPlanSha256),
        );
        if (dependsOnAffected) {
          affectedHashes.add(target.shotExecutionPlan.planTemplateSha256);
          changed = true;
        }
      }
    }
    await this.client.shotExecutionPlan.updateMany({
      where: {
        id: {
          in: targets.flatMap((target) =>
            target.shotExecutionPlan &&
            affectedHashes.has(target.shotExecutionPlan.planTemplateSha256)
              ? [target.shotExecutionPlan.id]
              : [],
          ),
        },
        lifecycleStatus: { in: ["DRAFT", "FROZEN"] },
      },
      data: { lifecycleStatus: "INVALIDATED", invalidatedAt: new Date(), invalidationCode: code },
    });
  }
}

export function registryDocumentHash(document: GenerationRegistry) {
  return canonicalSha256(document);
}

export function evaluateGenerationSpecDependenciesV3(input: {
  continuityRequired: boolean;
  bindings: Array<{
    sourceKind: string;
    sourceRef: { id: string; version: string };
    sha256: string;
  }>;
}) {
  if (!input.continuityRequired) return [];
  const upstream = input.bindings.find((binding) => binding.sourceKind === "UPSTREAM_FINAL_FRAME");
  if (!upstream) return ["UPSTREAM_FINAL_FRAME_NOT_MATERIALIZED"];
  if (!/^[a-f0-9]{64}$/.test(upstream.sourceRef.version) || !/^[a-f0-9]{64}$/.test(upstream.sha256))
    return ["UPSTREAM_FINAL_FRAME_LINEAGE_INVALID"];
  return [];
}

const capabilityJson = (value: unknown) => value as Prisma.InputJsonValue;

function deterministicUuid(value: unknown) {
  const hash = canonicalSha256(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(
    17,
    20,
  )}-${hash.slice(20, 32)}`;
}

export class CapabilityPlanRepository {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async persistRequirement(input: {
    projectId: string;
    storyboardVersionId: string;
    storyboardShotId: string;
    spec: ShotRequirementSpecV3;
  }) {
    const spec = ShotRequirementSpecV3Schema.parse(input.spec);
    const existing = await this.client.shotRequirementSpecV3Record.findUnique({
      where: { shotId_version: { shotId: spec.shotId, version: spec.version } },
    });
    if (existing) {
      if (existing.requirementHash !== spec.requirementHash)
        throw new Error("REQUIREMENT_SPEC_VERSION_CONFLICT");
      return existing;
    }
    return this.client.shotRequirementSpecV3Record.create({
      data: {
        id: spec.id,
        projectId: input.projectId,
        storyboardVersionId: input.storyboardVersionId,
        storyboardShotId: input.storyboardShotId,
        shotId: spec.shotId,
        version: spec.version,
        payloadJson: capabilityJson(spec),
        requirementHash: spec.requirementHash,
      },
    });
  }

  async persistSnapshot(input: { projectId: string; snapshot: PlanningInputSnapshotV3 }) {
    const snapshot = PlanningInputSnapshotV3Schema.parse(input.snapshot);
    const existing = await this.client.planningInputSnapshotV3Record.findUnique({
      where: {
        requirementSpecId_version: {
          requirementSpecId: snapshot.requirementSpecRef.id,
          version: snapshot.version,
        },
      },
    });
    if (existing) {
      if (existing.snapshotHash !== snapshot.snapshotHash)
        throw new Error("PLANNING_SNAPSHOT_VERSION_CONFLICT");
      return existing;
    }
    return this.client.planningInputSnapshotV3Record.create({
      data: {
        id: snapshot.id,
        projectId: input.projectId,
        requirementSpecId: snapshot.requirementSpecRef.id,
        version: snapshot.version,
        implementationKey: snapshot.implementationRef.id,
        implementationVersion: snapshot.implementationRef.version,
        compilerKey: snapshot.compilerRef.id,
        compilerVersion: snapshot.compilerRef.version,
        payloadJson: capabilityJson(snapshot),
        sourceDigest: snapshot.sourceDigest,
        capabilityDigest: snapshot.capabilityDigest,
        snapshotHash: snapshot.snapshotHash,
      },
    });
  }

  async persistGenerationSpec(input: {
    projectId: string;
    storyboardVersionId: string;
    spec: GenerationSpecV3;
  }) {
    const spec = GenerationSpecV3Schema.parse(input.spec);
    const existing = await this.client.generationSpecV3Record.findUnique({
      where: { shotId_version: { shotId: spec.shotId, version: spec.version } },
    });
    if (existing) {
      if (existing.outputHash !== spec.outputHash)
        throw new Error("GENERATION_SPEC_VERSION_CONFLICT");
      return existing;
    }
    return this.client.generationSpecV3Record.create({
      data: {
        id: spec.id,
        projectId: input.projectId,
        shotId: spec.shotId,
        storyboardVersionId: input.storyboardVersionId,
        requirementSpecId: spec.requirementSpecRef.id,
        planningInputSnapshotId: spec.planningInputSnapshotRef.id,
        implementationKey: spec.implementationRef.id,
        implementationVersion: spec.implementationRef.version,
        runtimeKey: spec.runtimeRef.id,
        runtimeVersion: spec.runtimeRef.version,
        providerKey: spec.providerRef.id,
        providerVersion: spec.providerRef.version,
        modelKey: spec.modelRef.id,
        modelVersion: spec.modelRef.version,
        adapterKey: spec.adapterRef.id,
        adapterVersion: spec.adapterRef.version,
        compilerKey: spec.compilerRef.id,
        compilerVersion: spec.compilerRef.version,
        version: spec.version,
        payloadJson: capabilityJson(spec),
        compiledRequestDigest: spec.compiledRequestDigest,
        inputHash: spec.inputHash,
        dependencyHash: spec.dependencyHash,
        outputHash: spec.outputHash,
      },
    });
  }

  async persistDynamicGraph(input: {
    projectId: string;
    storyboardVersionId: string;
    referencePlan: ReferencePlanV3;
    snapshot: MaterializedGraphSnapshotV3;
  }) {
    const referencePlan = ReferencePlanV3Schema.parse(input.referencePlan);
    const snapshot = MaterializedGraphSnapshotV3Schema.parse(input.snapshot);
    if (
      referencePlan.generationSpecId !== snapshot.generationSpecRef.id ||
      referencePlan.referencePlanDigest !== snapshot.referencePlanDigest
    )
      throw new Error("DYNAMIC_GRAPH_LINEAGE_MISMATCH");
    const existingReference = await this.client.referencePlanV3Record.findUnique({
      where: { generationSpecId: referencePlan.generationSpecId },
    });
    if (
      existingReference &&
      existingReference.referencePlanDigest !== referencePlan.referencePlanDigest
    )
      throw new Error("REFERENCE_PLAN_GENERATION_SPEC_CONFLICT");
    const existingGraph = await this.client.materializedGraphSnapshotV3Record.findUnique({
      where: { generationSpecId: referencePlan.generationSpecId },
    });
    if (existingGraph && existingGraph.materializedGraphSha256 !== snapshot.materializedGraphSha256)
      throw new Error("MATERIALIZED_GRAPH_GENERATION_SPEC_CONFLICT");
    if (!existingReference)
      await this.client.referencePlanV3Record.create({
        data: {
          id: deterministicUuid({
            kind: "reference-plan-record-v3",
            referencePlanDigest: referencePlan.referencePlanDigest,
          }),
          projectId: input.projectId,
          shotId: referencePlan.shotId,
          storyboardVersionId: input.storyboardVersionId,
          generationSpecId: referencePlan.generationSpecId,
          implementationKey: referencePlan.implementationRef.id,
          implementationVersion: referencePlan.implementationRef.version,
          compilerKey: referencePlan.compilerRef.id,
          compilerVersion: referencePlan.compilerRef.version,
          referencePlanDigest: referencePlan.referencePlanDigest,
          payloadJson: capabilityJson(referencePlan),
        },
      });
    if (!existingGraph)
      await this.client.materializedGraphSnapshotV3Record.create({
        data: {
          id: deterministicUuid({
            kind: "materialized-graph-snapshot-record-v3",
            materializedGraphSha256: snapshot.materializedGraphSha256,
          }),
          projectId: input.projectId,
          generationSpecId: referencePlan.generationSpecId,
          referencePlanDigest: snapshot.referencePlanDigest,
          implementationKey: snapshot.implementationRef.id,
          implementationVersion: snapshot.implementationRef.version,
          compilerKey: snapshot.compilerRef.id,
          compilerVersion: snapshot.compilerRef.version,
          validatorKey: snapshot.validatorRef.id,
          validatorVersion: snapshot.validatorRef.version,
          materializedGraphSha256: snapshot.materializedGraphSha256,
          capabilityEnvelopeDigest: snapshot.capabilityEnvelopeDigest,
          runtimeContractDigest: snapshot.runtimeContractDigest,
          payloadJson: capabilityJson(snapshot),
        },
      });
    return { referencePlanDigest: referencePlan.referencePlanDigest, snapshot };
  }

  async persistPlan(projectId: string, raw: GenerationPlanV3) {
    const plan = GenerationPlanV3Schema.parse(raw);
    const existing = await this.client.generationPlanV3Record.findUnique({
      where: { projectId_planDigest: { projectId, planDigest: plan.planDigest } },
    });
    if (existing) return existing;
    return this.client.generationPlanV3Record.create({
      data: {
        id: plan.id,
        projectId,
        version: plan.version,
        payloadJson: capabilityJson(plan),
        planDigest: plan.planDigest,
        state: plan.state,
      },
    });
  }

  async persistAuthorization(input: {
    projectId: string;
    generationPlanId: string;
    authorization: GenerationAuthorizationV3;
  }) {
    const authorization = GenerationAuthorizationV3Schema.parse(input.authorization);
    const scopeHash = canonicalSha256(authorization);
    const existing = await this.client.generationAuthorizationV3Record.findUnique({
      where: {
        generationPlanId_scopeHash: {
          generationPlanId: input.generationPlanId,
          scopeHash,
        },
      },
    });
    if (existing) return existing;
    return this.client.generationAuthorizationV3Record.create({
      data: {
        id: authorization.id,
        projectId: input.projectId,
        generationPlanId: input.generationPlanId,
        planDigest: authorization.planDigest,
        scopeJson: capabilityJson(authorization),
        scopeHash,
        expectedCalls: authorization.expectedCalls,
        maximumCalls: authorization.maximumCalls,
        consumedCalls: authorization.consumedCalls,
        maximumCostMicros: authorization.maximumCostMicros,
        expiresAt: new Date(authorization.expiresAt),
        noRetry: authorization.noRetry,
        noFallback: authorization.noFallback,
        state: authorization.state,
      },
    });
  }
}
