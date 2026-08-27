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
    private readonly options: {
      v3QaReadiness?: () => Promise<{ configured: boolean; reason?: string }>;
    } = {},
  ) {}

  private async v3QaPricing() {
    const providerId = this.environment.VIDEO_QA_PROVIDER_PROFILE ?? "";
    const modelId = this.environment.VIDEO_QA_MODEL_ID ?? "";
    const billingChannel = this.environment.VIDEO_QA_BILLING_CHANNEL ?? "";
    const effectiveAt = this.environment.VIDEO_QA_PRICE_EFFECTIVE_AT ?? "";
    const expiresAt = this.environment.VIDEO_QA_PRICE_EXPIRES_AT ?? "";
    const maximumCostMicros = Number(this.environment.VIDEO_QA_MAX_COST_MICROS ?? "");
    const current =
      Number.isSafeInteger(maximumCostMicros) &&
      maximumCostMicros >= 0 &&
      Date.parse(effectiveAt) <= Date.now() &&
      Date.parse(expiresAt) > Date.now();
    const staticallyConfigured =
      this.environment.VIDEO_QA_LIVE_ENABLED === "true" &&
      providerId === "codexmanager-local" &&
      modelId === "gpt-5.4" &&
      Boolean(billingChannel) &&
      current &&
      Boolean(this.environment.CODEX_MANAGER_API_KEY);
    const readiness = staticallyConfigured
      ? await (this.options.v3QaReadiness?.() ??
          Promise.resolve({ configured: false, reason: "V3 QA health check is unavailable" }))
      : { configured: false, reason: "V3 QA configuration is incomplete" };
    const configured = staticallyConfigured && readiness.configured;
    return {
      configured,
      maximumCostMicros: current ? maximumCostMicros : null,
      pricing: configured ? { providerId, modelId, billingChannel, effectiveAt, expiresAt } : null,
    };
  }

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
    const effective = await this.client.generationOwnerDecisionV3Record.findFirst({
      where: { artifactId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (effective)
      throw new ProjectAssetError(
        "OWNER_DECISION_ALREADY_FINAL",
        "This Artifact already has an effective terminal Owner decision",
        409,
      );
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
    const qaRuns = await this.client.aiQaRunV3Record.findMany({
      where: { artifactId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const qaResults = await this.client.aiQaResultV3Record.findMany({
      where: { aiQaRunId: { in: qaRuns.map((run) => run.id) } },
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
      aiQa: qaRuns.map((run) => ({
        id: run.id,
        status: run.status,
        safeResultCode: run.safeResultCode,
        providerId: run.providerId,
        requestedModelId: run.requestedModelId,
        result: qaResults.find((result) => result.aiQaRunId === run.id)
          ? {
              overallStatus: qaResults.find((result) => result.aiQaRunId === run.id)!.overallStatus,
              summary: qaResults.find((result) => result.aiQaRunId === run.id)!.summary,
              limitations: qaResults.find((result) => result.aiQaRunId === run.id)!.limitationsJson,
            }
          : null,
      })),
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
    const lineage = await this.client.generationAttemptV3Record.aggregate({
      where: { projectId: attempt.projectId, generationSpecId: attempt.generationSpecId },
      _max: { attemptNumber: true },
    });
    const nextAttemptNumber = (lineage._max.attemptNumber ?? 0) + 1;
    const qa = await this.v3QaPricing();
    if (!qa.configured)
      throw new ProjectAssetError(
        "V3_AI_QA_NOT_READY",
        "Current V3 AI QA configuration, health, or price is unavailable",
        409,
      );
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
      maximumAiQaCalls: 1 as const,
      maximumAiQaCostMicros: qa.maximumCostMicros,
      maximumTotalCostMicros:
        perCallCost === null || qa.maximumCostMicros === null
          ? null
          : perCallCost + qa.maximumCostMicros,
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
        maximumAiQaCalls: preview.maximumAiQaCalls,
        maximumAiQaCostMicros: preview.maximumAiQaCostMicros,
        maximumTotalCostMicros: preview.maximumTotalCostMicros,
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
    const qa = await this.v3QaPricing();
    if (
      !qa.configured ||
      (retry.maximumAiQaCostMicros === null ? null : Number(retry.maximumAiQaCostMicros)) !==
        qa.maximumCostMicros
    )
      throw new ProjectAssetError(
        "V3_AI_QA_NOT_READY",
        "Current V3 AI QA configuration or price is unavailable",
        409,
      );
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
      maximumAiQaCalls: 1,
      maximumAiQaCostMicros:
        retry.maximumAiQaCostMicros === null ? null : Number(retry.maximumAiQaCostMicros),
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
          maximumAiQaCalls: 1,
          consumedAiQaCalls: 0,
          maximumCostMicros: retry.maximumCostMicros,
          maximumAiQaCostMicros: retry.maximumAiQaCostMicros,
          maximumTotalCostMicros: retry.maximumTotalCostMicros,
          aiQaProviderId: qa.pricing!.providerId,
          aiQaModelId: qa.pricing!.modelId,
          aiQaPricingJson: qa.pricing as Prisma.InputJsonValue,
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
          maximumAiQaCalls: 1,
          costPolicyDigest: originalTarget.generationBatch.costPolicyDigest,
          maximumCostMicros: retry.maximumCostMicros,
          maximumAiQaCostMicros: retry.maximumAiQaCostMicros,
          maximumTotalCostMicros: retry.maximumTotalCostMicros,
          aiQaProviderId: qa.pricing!.providerId,
          aiQaModelId: qa.pricing!.modelId,
          aiQaPricingJson: qa.pricing as Prisma.InputJsonValue,
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
          retryOfAttemptId: failedAttempt.id,
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
      outputFfprobe: null,
    });
    try {
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
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const sameSources = await this.client.generationAssemblyV3Record.findUnique({
        where: { inputDigest },
      });
      if (!sameSources) throw error;
      return GenerationAssemblyV3Schema.parse(sameSources.payloadJson);
    }
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
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "24",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-y",
        output,
      ]);
      const preserved = await this.storage.preserve(createReadStream(output));
      const outputFfprobe = await this.probeAssemblyOutput(output);
      const completed = GenerationAssemblyV3Schema.parse({
        ...core,
        state: "COMPLETED",
        outputStorageKey: preserved.storageKey,
        outputSha256: preserved.sha256,
        outputBytes: preserved.byteSize,
        outputFfprobe,
      });
      await this.client.generationAssemblyV3Record.update({
        where: { id },
        data: {
          state: "COMPLETED",
          outputStorageKey: preserved.storageKey,
          outputSha256: preserved.sha256,
          outputByteSize: preserved.byteSize,
          outputFfprobeJson: outputFfprobe as Prisma.InputJsonValue,
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

  private async probeAssemblyOutput(output: string) {
    const { stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      output,
    ]);
    const raw = JSON.parse(stdout) as Record<string, any>;
    const video = raw.streams?.find((stream: any) => stream.codec_type === "video");
    const [numerator, denominator] = String(video?.avg_frame_rate ?? "0/1")
      .split("/")
      .map(Number);
    return {
      durationSeconds: Number(raw.format?.duration ?? video?.duration ?? 0),
      width: Number(video?.width ?? 0),
      height: Number(video?.height ?? 0),
      fps: denominator ? numerator! / denominator : 0,
      codec: String(video?.codec_name ?? "unknown"),
      container: String(raw.format?.format_name ?? "unknown").split(",")[0]!,
      probeVersion: "ffprobe-capability-v3" as const,
    };
  }

  private isUniqueViolation(error: unknown) {
    return (
      (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") ||
      (error instanceof Error && /P2002|unique/i.test(error.message))
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
