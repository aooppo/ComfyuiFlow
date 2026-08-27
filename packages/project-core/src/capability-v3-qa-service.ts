import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { VideoQaProvider } from "@comfyuiflow/ai-providers";
import { AiQaRequestV1Schema, AiQaResultV1Schema } from "@comfyuiflow/contracts";
import type { Prisma } from "./generated/client/index.js";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

/**
 * V3 deliberately keeps QA in a separate append-only projection. Artifact bytes and technical
 * evidence never change because QA completed, failed, or could not be contacted.
 */
export class CapabilityV3QaService {
  constructor(
    private readonly provider: VideoQaProvider,
    private readonly client: ProjectPrisma = prisma,
    private readonly sourceStorage: StorageProvider = new LocalContentStorage(),
    private readonly generatedStorage: StorageProvider = new LocalContentStorage({
      root: process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
      maxBytes: Number(process.env.PROJECT_GENERATED_MAX_BYTES || 500 * 1024 * 1024),
    }),
  ) {}

  async reviewAttempt(attemptId: string) {
    const readiness = await this.provider.validateConfiguration();
    if (!readiness.configured)
      throw new ProjectAssetError(
        "QA_PROVIDER_NOT_READY",
        readiness.reason ?? "V3 AI QA provider is unavailable",
        409,
      );
    const existing = await this.client.aiQaRunV3Record.findUnique({ where: { attemptId } });
    if (existing) return this.view(existing);
    const attempt = await this.client.generationAttemptV3Record.findUnique({
      where: { id: attemptId },
    });
    const artifact = await this.client.generationArtifactV3Record.findUnique({
      where: { attemptId },
    });
    if (!attempt || !artifact || artifact.technicalStatus !== "VERIFIED")
      throw new ProjectAssetError("QA_NOT_READY", "V3 QA requires a technical artifact", 409);
    const target = await this.client.generationBatchTargetV3Record.findUnique({
      where: { id: attempt.generationBatchTargetId },
      include: { generationBatch: { include: { authorization: true } } },
    });
    const reference = await this.client.referencePlanV3Record.findFirst({
      where: { generationSpecId: attempt.generationSpecId },
    });
    if (!target || !reference)
      throw new ProjectAssetError("QA_NOT_READY", "V3 QA lineage is incomplete", 409);
    const authorization = target.generationBatch.authorization;
    if (
      authorization.maximumAiQaCalls !== 1 ||
      !authorization.aiQaProviderId ||
      !authorization.aiQaModelId ||
      !authorization.aiQaPricingJson ||
      authorization.aiQaProviderId !== this.provider.providerId ||
      authorization.aiQaModelId !== this.provider.modelId
    )
      throw new ProjectAssetError(
        "QA_NOT_AUTHORIZED",
        "This Batch has no matching V3 AI QA authority",
        409,
      );
    const plan = reference.payloadJson as any;
    const bindings = Array.isArray(plan.bindings) ? plan.bindings : [];
    const referenceImages = await Promise.all(
      bindings
        .filter((binding: any) => binding.modality === "IMAGE")
        .map(async (binding: any) => {
          const asset = await this.client.asset.findUnique({
            where: { id: String(binding.sourceRef?.id ?? "") },
            include: { storedObject: true },
          });
          if (!asset || asset.storedObject.sha256 !== binding.sha256)
            throw new ProjectAssetError("QA_NOT_READY", "A V3 reference image changed", 409);
          const path = await this.sourceStorage.resolveVerified(
            asset.storedObject.storageKey,
            asset.storedObject.sha256,
            Number(asset.storedObject.byteSize),
          );
          return {
            role: String(binding.role),
            mimeType: asset.storedObject.detectedMimeType,
            sha256: asset.storedObject.sha256,
            content: new Uint8Array(await readFile(path)),
          };
        }),
    );
    const frames = Array.isArray((artifact.payloadJson as any).reviewFrames)
      ? (artifact.payloadJson as any).reviewFrames
      : [];
    if (frames.length !== 3)
      throw new ProjectAssetError(
        "QA_NOT_READY",
        "V3 QA requires exactly three review frames",
        409,
      );
    const reviewFrames = await Promise.all(
      frames.map(async (frame: any) => ({
        role: frame.role,
        mimeType: "image/png",
        sha256: frame.sha256,
        content: new Uint8Array(
          await readFile(
            await this.generatedStorage.resolveVerified(
              frame.storageKey,
              frame.sha256,
              frame.bytes,
            ),
          ),
        ),
      })),
    );
    const request = AiQaRequestV1Schema.parse({
      schemaVersion: "ai-qa-request-v1",
      artifactId: artifact.id,
      generationSpecId: attempt.generationSpecId,
      generationSpecHash: attempt.materializedGraphSha256,
      referenceSlots: bindings.map((binding: any) => ({
        role: binding.role,
        sha256: binding.sha256,
      })),
      modelRef: { providerId: this.provider.providerId, modelId: this.provider.modelId },
      referenceImages,
      reviewFrames,
      technicalFacts: artifact.ffprobeJson,
      expectedFacts: { prompt: plan.prompt, referencePlanDigest: attempt.referencePlanDigest },
    });
    const inputHash = canonicalSha256({
      attemptId,
      artifact: artifact.sha256,
      referencePlanDigest: attempt.referencePlanDigest,
      references: referenceImages.map((item) => [item.role, item.sha256]),
      frames: reviewFrames.map((item) => [item.role, item.sha256]),
      technicalFacts: request.technicalFacts,
    });
    const requestHash = canonicalSha256({ inputHash, modelRef: request.modelRef });
    const consumptionId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await this.client.$transaction(async (tx) => {
      const alreadyConsumed = await tx.authorizationConsumptionV3Record.findFirst({
        where: { attemptId, operation: "AI_QA" },
      });
      if (alreadyConsumed)
        throw new ProjectAssetError("QA_ALREADY_STARTED", "V3 AI QA was already consumed", 409);
      const current = await tx.generationAuthorizationV3Record.updateMany({
        where: {
          id: authorization.id,
          state: { in: ["ACTIVE", "CONSUMED"] },
          consumedAiQaCalls: 0,
          maximumAiQaCalls: 1,
          expiresAt: { gt: now },
        },
        data: { consumedAiQaCalls: { increment: 1 } },
      });
      if (current.count !== 1)
        throw new ProjectAssetError(
          "QA_AUTHORIZATION_CONCURRENTLY_CONSUMED",
          "V3 QA authority is unavailable",
          409,
        );
      const sequence = await tx.authorizationConsumptionV3Record.count({
        where: { authorizationId: authorization.id },
      });
      await tx.authorizationConsumptionV3Record.create({
        data: {
          id: consumptionId,
          projectId: attempt.projectId,
          authorizationId: authorization.id,
          generationBatchTargetId: target.id,
          attemptId,
          operation: "AI_QA",
          sequence: sequence + 1,
          consumedCalls: 1,
          consumedCostMicros: authorization.maximumAiQaCostMicros,
          payloadJson: {
            schemaVersion: "authorization-consumption-v3",
            operation: "AI_QA",
            requestHash,
          },
        },
      });
      await tx.generationBatchV3Record.update({
        where: { id: target.generationBatchId },
        data: { consumedAiQaCalls: { increment: 1 } },
      });
      await tx.aiQaRunV3Record.create({
        data: {
          id: runId,
          projectId: attempt.projectId,
          attemptId,
          artifactId: artifact.id,
          authorizationConsumptionId: consumptionId,
          providerId: this.provider.providerId,
          requestedModelId: this.provider.modelId,
          requestHash,
          inputHash,
          status: "RUNNING",
          safeResultCode: "AI_QA_RUNNING",
        },
      });
    });
    const before = this.provider.externalCallCount;
    try {
      const result = AiQaResultV1Schema.parse(await this.provider.reviewVideoFrames(request));
      await this.client.$transaction([
        this.client.aiQaResultV3Record.create({
          data: {
            id: randomUUID(),
            aiQaRunId: runId,
            contractVersion: result.schemaVersion,
            overallStatus: result.overallStatus,
            summary: result.summary,
            limitationsJson: result.limitations as Prisma.InputJsonValue,
            criteriaJson: result.criteria as Prisma.InputJsonValue,
            outputHash: canonicalSha256(result),
            payloadJson: result as Prisma.InputJsonValue,
          },
        }),
        this.client.aiQaRunV3Record.update({
          where: { id: runId },
          data: {
            status: "COMPLETED",
            safeResultCode: "AI_QA_COMPLETED",
            resolvedModelId: result.resolvedModelId,
            responseId: result.responseId,
            providerCallCount: this.provider.externalCallCount - before,
            ...(result.usage ? { usageJson: result.usage as Prisma.InputJsonValue } : {}),
            finishedAt: new Date(),
          },
        }),
      ]);
      return { id: runId, status: "COMPLETED" as const, advisory: result.overallStatus };
    } catch (error) {
      await this.client.aiQaRunV3Record.update({
        where: { id: runId },
        data: {
          status: "AMBIGUOUS",
          safeResultCode: "AI_QA_RESULT_AMBIGUOUS",
          providerCallCount: this.provider.externalCallCount - before,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async view(run: { id: string; status: string; safeResultCode: string }) {
    return {
      id: run.id,
      status: run.status,
      safeResultCode: run.safeResultCode,
      externalCalls: 0 as const,
    };
  }
}
