import { randomUUID } from "node:crypto";
import type { GenerationImplementation, GenerationRegistry } from "@comfyuiflow/contracts";
import { ExecutionInputSnapshotSchema } from "@comfyuiflow/contracts";
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
