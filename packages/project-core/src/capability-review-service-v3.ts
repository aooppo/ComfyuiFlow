import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  AttemptArtifactV3Schema,
  GenerationAssemblyV3Schema,
  GenerationRetryAuthorizeRequestV3Schema,
  GenerationRetryPreviewV3Schema,
  GenerationSpecV3Schema,
  MaterializedGraphSnapshotV3Schema,
  OwnerDecisionCreateRequestV3Schema,
  type GenerationAssemblyV3,
} from "@comfyuiflow/contracts";
import type { Prisma } from "./generated/client/index.js";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";
import { CapabilityRegistryLoader } from "./workflow-agent/capability-registry.js";

const execute = promisify(execFile);

export class CapabilityReviewServiceV3 {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage({
      root: process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
      maxBytes: Number(process.env.PROJECT_GENERATED_MAX_BYTES || 500 * 1024 * 1024),
    }),
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async decide(artifactId: string, raw: unknown) {
    const request = OwnerDecisionCreateRequestV3Schema.parse(raw);
    const artifact = await this.client.generationArtifactV3Record.findUnique({
      where: { id: artifactId },
    });
    if (!artifact)
      throw new ProjectAssetError("ARTIFACT_INVALID", "Capability V3 artifact was not found", 404);
    const existing = await this.client.generationOwnerDecisionV3Record.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
    });
    if (existing) {
      if (existing.artifactId !== artifactId || existing.decision !== request.decision)
        throw new ProjectAssetError("IDEMPOTENCY_CONFLICT", "Decision key was already used", 409);
      return this.decisionView(existing);
    }
    const decision = await this.client.generationOwnerDecisionV3Record.create({
      data: {
        id: randomUUID(),
        projectId: artifact.projectId,
        artifactId,
        decision: request.decision,
        reasonCode: request.reasonCode ?? null,
        notes: request.notes ?? null,
        actorRef: request.actorRef,
        idempotencyKey: request.idempotencyKey,
      },
    });
    return this.decisionView(decision);
  }

  async getArtifactView(artifactId: string) {
    const record = await this.client.generationArtifactV3Record.findUnique({
      where: { id: artifactId },
    });
    if (!record)
      throw new ProjectAssetError("ARTIFACT_INVALID", "Capability V3 artifact was not found", 404);
    const artifact = AttemptArtifactV3Schema.parse(record.payloadJson);
    const decisions = await this.client.generationOwnerDecisionV3Record.findMany({
      where: { artifactId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return {
      ...artifact,
      storageKey: undefined,
      contentUrl: `/api/capability-v3-artifacts/${artifact.id}/content`,
      reviewFrames: artifact.reviewFrames.map((frame) => ({
        id: frame.id,
        role: frame.role,
        timestampSeconds: frame.timestampSeconds,
        sha256: frame.sha256,
        bytes: frame.bytes,
        contentUrl: `/api/capability-v3-artifacts/${artifact.id}/review-frames/${frame.role}`,
      })),
      decisions: decisions.map((decision) => this.decisionView(decision)),
    };
  }

  async resolveArtifactPath(artifactId: string) {
    const artifact = await this.client.generationArtifactV3Record.findUnique({
      where: { id: artifactId },
    });
    if (!artifact)
      throw new ProjectAssetError("ARTIFACT_INVALID", "Capability V3 artifact was not found", 404);
    return this.storage.resolveVerified(
      artifact.storageKey,
      artifact.sha256,
      Number(artifact.byteSize),
    );
  }

  async resolveReviewFramePath(artifactId: string, role: "FIRST" | "MIDDLE" | "LAST") {
    const artifact = await this.client.generationArtifactV3Record.findUnique({
      where: { id: artifactId },
    });
    if (!artifact)
      throw new ProjectAssetError("ARTIFACT_INVALID", "Capability V3 artifact was not found", 404);
    const frame = AttemptArtifactV3Schema.parse(artifact.payloadJson).reviewFrames.find(
      (item) => item.role === role,
    );
    if (!frame) throw new ProjectAssetError("QA_NOT_READY", "Review frame was not found", 404);
    return this.storage.resolveVerified(frame.storageKey, frame.sha256, frame.bytes);
  }

  async previewRetry(artifactId: string) {
    const artifact = await this.client.generationArtifactV3Record.findUnique({
      where: { id: artifactId },
    });
    if (!artifact)
      throw new ProjectAssetError("ARTIFACT_INVALID", "Capability V3 artifact was not found", 404);
    const ownerFail = await this.client.generationOwnerDecisionV3Record.findFirst({
      where: { artifactId, decision: "FAIL" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!ownerFail)
      throw new ProjectAssetError("OWNER_FAIL_REQUIRED", "Retry requires Owner FAIL", 409);
    const attempt = await this.client.generationAttemptV3Record.findUniqueOrThrow({
      where: { id: artifact.attemptId },
    });
    const target = await this.client.generationBatchTargetV3Record.findUniqueOrThrow({
      where: { id: attempt.generationBatchTargetId },
      include: { generationBatch: true, generationSpec: true },
    });
    const perCallCost =
      target.generationBatch.maximumCostMicros === null
        ? null
        : Math.ceil(
            Number(target.generationBatch.maximumCostMicros) / target.generationBatch.maximumCalls,
          );
    const nextAttemptNumber = attempt.attemptNumber + 1;
    const core = {
      schemaVersion: "generation-retry-preview-v3" as const,
      projectId: artifact.projectId,
      failedAttemptId: attempt.id,
      nextAttemptNumber,
      generationSpecRef: { id: target.generationSpec.id, version: target.generationSpec.version },
      materializedGraphSha256: attempt.materializedGraphSha256,
      expectedCalls: 1 as const,
      maximumCalls: 1 as const,
      maximumCostMicros: perCallCost,
      externalCalls: 0 as const,
      generationAuthorized: false as const,
    };
    const previewDigest = canonicalSha256(core);
    const preview = GenerationRetryPreviewV3Schema.parse({
      id: this.deterministicUuid({ kind: "generation-retry-preview-v3", previewDigest }),
      ...core,
      previewDigest,
    });
    await this.client.generationRetryPreviewV3Record.upsert({
      where: { previewDigest },
      create: {
        id: preview.id,
        projectId: preview.projectId,
        failedAttemptId: preview.failedAttemptId,
        nextAttemptNumber: preview.nextAttemptNumber,
        generationSpecId: preview.generationSpecRef.id,
        materializedGraphSha256: preview.materializedGraphSha256,
        expectedCalls: 1,
        maximumCalls: 1,
        maximumCostMicros: preview.maximumCostMicros,
        previewDigest,
        payloadJson: preview as Prisma.InputJsonValue,
      },
      update: {},
    });
    return preview;
  }

  async authorizeRetry(retryPreviewId: string, raw: unknown) {
    const request = GenerationRetryAuthorizeRequestV3Schema.parse(raw);
    const retry = await this.client.generationRetryPreviewV3Record.findUnique({
      where: { id: retryPreviewId },
    });
    if (!retry || retry.previewDigest !== request.previewDigest)
      throw new ProjectAssetError("PREVIEW_STALE", "Retry preview changed", 409);
    const existing = await this.client.generationBatchV3Record.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
      include: { authorization: true, targets: true },
    });
    if (existing) {
      if (existing.previewHash !== retry.previewDigest)
        throw new ProjectAssetError(
          "IDEMPOTENCY_CONFLICT",
          "Retry authorization key was already used for another preview",
          409,
        );
      return this.retryAuthorizationView(existing);
    }
    if (this.environment.PROJECT_GENERATION_LIVE_ENABLED !== "true")
      throw new ProjectAssetError("LIVE_DISABLED", "LIVE generation is disabled", 409);
    const failedAttempt = await this.client.generationAttemptV3Record.findUniqueOrThrow({
      where: { id: retry.failedAttemptId },
    });
    const originalTarget = await this.client.generationBatchTargetV3Record.findUniqueOrThrow({
      where: { id: failedAttempt.generationBatchTargetId },
      include: { generationBatch: true, generationSpec: true },
    });
    const generationSpec = GenerationSpecV3Schema.parse(originalTarget.generationSpec.payloadJson);
    const graphRecord = await this.client.materializedGraphSnapshotV3Record.findUnique({
      where: { generationSpecId: generationSpec.id },
    });
    const storyboardVersion = await this.client.storyboardVersion.findUnique({
      where: { id: originalTarget.generationSpec.storyboardVersionId },
      include: { storyboard: true, project: true },
    });
    const implementation = (await new CapabilityRegistryLoader().load()).resolveExact(
      generationSpec.implementationRef,
    );
    const currentMaximumCostMicros =
      implementation.costPolicy.kind === "MONETARY"
        ? implementation.costPolicy.maximumCostMicros
        : null;
    let graphSnapshot: ReturnType<typeof MaterializedGraphSnapshotV3Schema.parse> | null = null;
    try {
      graphSnapshot = graphRecord
        ? MaterializedGraphSnapshotV3Schema.parse(graphRecord.payloadJson)
        : null;
    } catch {
      graphSnapshot = null;
    }
    const pricingIsCurrent =
      implementation.costPolicy.kind !== "MONETARY" ||
      (Date.parse(implementation.costPolicy.effectiveAt) <= Date.now() &&
        Date.parse(implementation.costPolicy.expiresAt) > Date.now());
    if (
      failedAttempt.generationSpecId !== retry.generationSpecId ||
      failedAttempt.materializedGraphSha256 !== retry.materializedGraphSha256 ||
      !graphSnapshot ||
      graphSnapshot.materializedGraphSha256 !== retry.materializedGraphSha256 ||
      graphSnapshot.validation.status !== "VALID" ||
      !storyboardVersion ||
      storyboardVersion.storyboard.headVersionId !== storyboardVersion.id ||
      storyboardVersion.storyboard.status !== "ACTIVE" ||
      storyboardVersion.project.status !== "ACTIVE" ||
      (retry.maximumCostMicros === null
        ? currentMaximumCostMicros !== null
        : Number(retry.maximumCostMicros) !== currentMaximumCostMicros) ||
      !pricingIsCurrent
    )
      throw new ProjectAssetError(
        "PREVIEW_STALE",
        "Retry inputs, graph, implementation, pricing, or Storyboard head changed",
        409,
      );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.expiresInSeconds * 1_000);
    const authorizationId = randomUUID();
    const batchId = randomUUID();
    const targetId = randomUUID();
    const scopeHash = canonicalSha256({
      kind: "generation-retry-authorization-v3",
      retryPreviewId: retry.id,
      previewDigest: retry.previewDigest,
      failedAttemptId: retry.failedAttemptId,
      generationSpecId: retry.generationSpecId,
      materializedGraphSha256: retry.materializedGraphSha256,
      maximumCalls: 1,
      maximumCostMicros: retry.maximumCostMicros === null ? null : Number(retry.maximumCostMicros),
      expiresAt: expiresAt.toISOString(),
    });
    await this.client.$transaction(async (tx) => {
      await tx.generationAuthorizationV3Record.create({
        data: {
          id: authorizationId,
          projectId: retry.projectId,
          generationPlanId: originalTarget.generationBatch.generationPlanId,
          planDigest: originalTarget.generationBatch.planDigest,
          scopeJson: {
            retryPreviewId: retry.id,
            failedAttemptId: retry.failedAttemptId,
            materializedGraphSha256: retry.materializedGraphSha256,
          },
          scopeHash,
          expectedCalls: 1,
          maximumCalls: 1,
          consumedCalls: 0,
          maximumCostMicros: retry.maximumCostMicros,
          expiresAt,
          noRetry: true,
          noFallback: true,
          state: "ACTIVE",
        },
      });
      await tx.generationBatchV3Record.create({
        data: {
          id: batchId,
          projectId: retry.projectId,
          generationPlanId: originalTarget.generationBatch.generationPlanId,
          generationAuthorizationId: authorizationId,
          planDigest: originalTarget.generationBatch.planDigest,
          previewHash: retry.previewDigest,
          scopeHash,
          selectedShotIdsJson: [originalTarget.shotId],
          expectedCalls: 1,
          maximumCalls: 1,
          maximumAiQaCalls: 0,
          costPolicyDigest: originalTarget.generationBatch.costPolicyDigest,
          maximumCostMicros: retry.maximumCostMicros,
          currency: originalTarget.generationBatch.currency,
          idempotencyKey: request.idempotencyKey,
          state: "QUEUED",
          safeResultCode: "RETRY_AUTHORIZED_NOT_STARTED",
        },
      });
      await tx.generationBatchTargetV3Record.create({
        data: {
          id: targetId,
          projectId: retry.projectId,
          generationBatchId: batchId,
          shotId: originalTarget.shotId,
          generationSpecId: retry.generationSpecId,
          ordinal: originalTarget.ordinal,
          targetDigest: canonicalSha256({
            retryPreviewDigest: retry.previewDigest,
            generationSpecId: retry.generationSpecId,
            attemptNumber: retry.nextAttemptNumber,
          }),
          implementationKey: originalTarget.implementationKey,
          implementationVersion: originalTarget.implementationVersion,
          adapterKey: originalTarget.adapterKey,
          adapterVersion: originalTarget.adapterVersion,
          compilerKey: originalTarget.compilerKey,
          compilerVersion: originalTarget.compilerVersion,
          state: "QUEUED",
          safeResultCode: "RETRY_AUTHORIZED_NOT_STARTED",
        },
      });
    });
    return this.retryAuthorizationView(
      await this.client.generationBatchV3Record.findUniqueOrThrow({
        where: { id: batchId },
        include: { authorization: true, targets: true },
      }),
    );
  }

  async assemble(storyboardVersionId: string, idempotencyKey: string) {
    const existing = await this.client.generationAssemblyV3Record.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return GenerationAssemblyV3Schema.parse(existing.payloadJson);
    const storyboard = await this.client.storyboardVersion.findUnique({
      where: { id: storyboardVersionId },
      include: { shots: { orderBy: { ordinal: "asc" } } },
    });
    if (!storyboard)
      throw new ProjectAssetError("STORYBOARD_VERSION_NOT_FOUND", "Storyboard was not found", 404);
    const decisions = await this.client.generationOwnerDecisionV3Record.findMany({
      where: { projectId: storyboard.projectId, decision: { in: ["PASS", "RISK_ACCEPTED"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const sources: Array<{ artifactId: string; sha256: string; shotId: string; ordinal: number }> =
      [];
    for (const shot of storyboard.shots) {
      let selected: { artifactId: string; sha256: string } | null = null;
      for (const decision of decisions) {
        const artifact = await this.client.generationArtifactV3Record.findUnique({
          where: { id: decision.artifactId },
        });
        if (!artifact) continue;
        const attempt = await this.client.generationAttemptV3Record.findUnique({
          where: { id: artifact.attemptId },
        });
        if (!attempt) continue;
        const target = await this.client.generationBatchTargetV3Record.findUnique({
          where: { id: attempt.generationBatchTargetId },
        });
        if (target?.shotId === shot.id) {
          selected = { artifactId: artifact.id, sha256: artifact.sha256 };
          break;
        }
      }
      if (!selected)
        throw new ProjectAssetError(
          "OWNER_DECISION_REQUIRED",
          "Every Shot requires an Owner PASS or RISK_ACCEPTED artifact",
          409,
        );
      sources.push({ ...selected, shotId: shot.id, ordinal: shot.ordinal });
    }
    const inputDigest = canonicalSha256(sources);
    const id = this.deterministicUuid({ kind: "generation-assembly-v3", inputDigest });
    const core: GenerationAssemblyV3 = GenerationAssemblyV3Schema.parse({
      schemaVersion: "generation-assembly-v3",
      id,
      projectId: storyboard.projectId,
      storyboardVersionId,
      inputDigest,
      idempotencyKey,
      state: "ASSEMBLING",
      sources,
      outputStorageKey: null,
      outputSha256: null,
      outputBytes: null,
    });
    await this.client.$transaction(async (tx) => {
      await tx.generationAssemblyV3Record.create({
        data: {
          id,
          projectId: storyboard.projectId,
          storyboardVersionId,
          inputDigest,
          idempotencyKey,
          state: "ASSEMBLING",
          payloadJson: core as Prisma.InputJsonValue,
        },
      });
      await tx.generationAssemblySourceV3Record.createMany({
        data: sources.map((source) => ({
          id: randomUUID(),
          assemblyId: id,
          artifactId: source.artifactId,
          ordinal: source.ordinal,
          sha256: source.sha256,
        })),
      });
    });
    const directory = await mkdtemp(path.join(tmpdir(), "comfyuiflow-assembly-v3-"));
    try {
      const paths = await Promise.all(
        sources.map(async (source) => {
          const artifact = await this.client.generationArtifactV3Record.findUniqueOrThrow({
            where: { id: source.artifactId },
          });
          return this.storage.resolveVerified(
            artifact.storageKey,
            artifact.sha256,
            Number(artifact.byteSize),
          );
        }),
      );
      const manifest = path.join(directory, "concat.txt");
      await writeFile(
        manifest,
        paths.map((item) => `file '${item.replaceAll("'", "'\\''")}'`).join("\n"),
        { mode: 0o600 },
      );
      const output = path.join(directory, "assembled.mp4");
      await execute("ffmpeg", [
        "-v",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        manifest,
        "-c",
        "copy",
        "-y",
        output,
      ]);
      const preserved = await this.storage.preserve(createReadStream(output));
      const completed = GenerationAssemblyV3Schema.parse({
        ...core,
        state: "COMPLETED",
        outputStorageKey: preserved.storageKey,
        outputSha256: preserved.sha256,
        outputBytes: preserved.byteSize,
      });
      await this.client.generationAssemblyV3Record.update({
        where: { id },
        data: {
          state: "COMPLETED",
          outputStorageKey: preserved.storageKey,
          outputSha256: preserved.sha256,
          outputByteSize: preserved.byteSize,
          payloadJson: completed as Prisma.InputJsonValue,
        },
      });
      return completed;
    } catch (error) {
      await this.client.generationAssemblyV3Record.update({
        where: { id },
        data: { state: "FAILED" },
      });
      throw error;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async resolveAssemblyPath(assemblyId: string) {
    const assembly = await this.client.generationAssemblyV3Record.findUnique({
      where: { id: assemblyId },
    });
    if (!assembly?.outputStorageKey || !assembly.outputSha256 || assembly.outputByteSize === null)
      throw new ProjectAssetError("ASSEMBLY_NOT_READY", "Assembly is not ready", 409);
    return this.storage.resolveVerified(
      assembly.outputStorageKey,
      assembly.outputSha256,
      Number(assembly.outputByteSize),
    );
  }

  private decisionView(record: {
    id: string;
    artifactId: string;
    decision: string;
    reasonCode: string | null;
    notes: string | null;
    actorRef: string;
    createdAt: Date;
  }) {
    return { ...record, createdAt: record.createdAt.toISOString(), externalCalls: 0 as const };
  }

  private retryAuthorizationView(batch: {
    id: string;
    authorization: { id: string; expiresAt: Date; maximumCalls: number; consumedCalls: number };
    targets: Array<{ id: string }>;
  }) {
    return {
      schemaVersion: "generation-retry-authorization-v3" as const,
      batchId: batch.id,
      authorizationId: batch.authorization.id,
      targetId: batch.targets[0]?.id,
      maximumCalls: batch.authorization.maximumCalls,
      consumedCalls: batch.authorization.consumedCalls,
      expiresAt: batch.authorization.expiresAt.toISOString(),
      externalCalls: 0 as const,
      generationAuthorized: true as const,
      executionStarted: false as const,
    };
  }

  private deterministicUuid(value: unknown) {
    const hash = canonicalSha256(value);
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(
      17,
      20,
    )}-${hash.slice(20, 32)}`;
  }
}
