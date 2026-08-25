import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import type { VideoQaProvider } from "@comfyuiflow/ai-providers";
import { AiQaRequestV1Schema, AiQaResultV1Schema, type AiQaResultV1 } from "@comfyuiflow/contracts";
import type { Prisma } from "./generated/client/index.js";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { GenerationExecutionService } from "./generation-execution-service.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export class GenerationQaService {
  constructor(
    private readonly provider: VideoQaProvider,
    private readonly client: ProjectPrisma = prisma,
    private readonly sourceStorage: StorageProvider = new LocalContentStorage(),
    private readonly generatedStorage: StorageProvider = new LocalContentStorage({
      root: process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
      maxBytes: Number(process.env.PROJECT_GENERATED_MAX_BYTES || 500 * 1024 * 1024),
    }),
    private readonly execution = new GenerationExecutionService(client, sourceStorage),
  ) {}

  async review(artifactId: string): Promise<AiQaResultV1> {
    const artifact = await this.client.generatedArtifact.findUnique({
      where: { id: artifactId },
      include: {
        technicalChecks: { where: { status: "PASS" }, orderBy: { checkedAt: "desc" } },
        reviewFrames: { orderBy: { role: "asc" } },
        generationJob: {
          include: {
            generationBatch: true,
            generationBatchTarget: {
              include: {
                generationSpec: {
                  include: {
                    references: { include: { projectAsset: { include: { storedObject: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!artifact || artifact.technicalChecks.length !== 1 || artifact.reviewFrames.length !== 3)
      throw new ProjectAssetError("QA_NOT_READY", "Artifact QA inputs are incomplete", 409);
    const job = artifact.generationJob;
    const target = job.generationBatchTarget;
    const spec = target.generationSpec;
    const frameVersion = artifact.reviewFrames[0]!.extractorVersion;
    if (artifact.reviewFrames.some((frame) => frame.extractorVersion !== frameVersion))
      throw new ProjectAssetError("QA_NOT_READY", "Review frames are not one immutable set", 409);

    const referenceImages = await Promise.all(
      (target.slotManifestJson as any[]).map(async (slot) => {
        if (slot.sourceKind === "KEYFRAME_ARTIFACT" && slot.keyframeArtifactId) {
          const keyframe = await this.client.keyframeArtifact.findUnique({
            where: { id: slot.keyframeArtifactId },
          });
          if (!keyframe || keyframe.sha256 !== slot.sha256)
            throw new ProjectAssetError("QA_NOT_READY", "Start keyframe changed", 409);
          const absolutePath = await this.sourceStorage.resolveVerified(
            keyframe.storageKey,
            keyframe.sha256,
            Number(keyframe.byteSize),
          );
          return {
            role: slot.role,
            mimeType: keyframe.detectedMimeType,
            sha256: keyframe.sha256,
            content: new Uint8Array(await this.readBytes(absolutePath)),
          };
        }
        const reference = spec.references.find(
          (item) => item.projectAssetId === slot.projectAssetId,
        );
        if (!reference) throw new ProjectAssetError("QA_NOT_READY", "Reference changed", 409);
        const stored = reference.projectAsset.storedObject;
        const absolutePath = await this.sourceStorage.resolveVerified(
          stored.storageKey,
          slot.sha256,
          Number(stored.byteSize),
        );
        return {
          role: slot.role,
          mimeType: stored.detectedMimeType,
          sha256: slot.sha256,
          content: new Uint8Array(await this.readBytes(absolutePath)),
        };
      }),
    );
    const reviewFrames = await Promise.all(
      artifact.reviewFrames.map(async (frame) => {
        const absolutePath = await this.generatedStorage.resolveVerified(
          frame.storageKey,
          frame.sha256,
          Number(frame.byteSize),
        );
        return {
          role: frame.role,
          mimeType: frame.mimeType,
          sha256: frame.sha256,
          content: new Uint8Array(await this.readBytes(absolutePath)),
        };
      }),
    );
    const technical = artifact.technicalChecks[0]!;
    const request = AiQaRequestV1Schema.parse({
      schemaVersion: "ai-qa-request-v1",
      artifactId: artifact.id,
      generationSpecId: spec.id,
      generationSpecHash: spec.outputHash,
      referenceSlots: target.slotManifestJson,
      modelRef: { providerId: this.provider.providerId, modelId: this.provider.modelId },
      referenceImages,
      reviewFrames,
      technicalFacts: {
        container: technical.container,
        videoCodec: technical.videoCodec,
        audioCodec: technical.audioCodec,
        width: technical.width,
        height: technical.height,
        fps: technical.fps,
        durationSeconds: technical.durationSeconds,
      },
      expectedFacts: {
        positivePrompt: spec.positivePrompt,
        executionPrompt: target.compiledPrompt,
        startBoundaryHash: target.startBoundaryHash,
        endBoundaryHash: target.endBoundaryHash,
        startKeyframeHash: target.startKeyframeHash,
        endKeyframeHash: target.endKeyframeHash,
        endKeyframeSoftTarget: target.endKeyframeSoftTarget,
      },
    });
    const inputHash = canonicalSha256({
      artifactSha256: artifact.sha256,
      references: referenceImages.map(({ role, sha256 }) => ({ role, sha256 })),
      frames: reviewFrames.map(({ role, sha256 }) => ({
        role,
        sha256,
      })),
      technicalFacts: request.technicalFacts,
      expectedFacts: request.expectedFacts,
    });
    const requestHash = canonicalSha256({ inputHash, modelRef: request.modelRef });
    await this.execution.consume(job.id, "AI_QA_REVIEW", requestHash);
    const run = await this.client.aiQaRun.create({
      data: {
        id: randomUUID(),
        projectId: artifact.projectId,
        generatedArtifactId: artifact.id,
        providerId: this.provider.providerId,
        requestedModelId: this.provider.modelId,
        requestHash,
        inputHash,
        status: "RUNNING",
        safeResultCode: "AI_QA_RUNNING",
      },
    });
    const providerCallsBefore = this.provider.externalCallCount;
    try {
      const result = AiQaResultV1Schema.parse(await this.provider.reviewVideoFrames(request));
      const outputHash = canonicalSha256(result);
      await this.client.$transaction([
        this.client.aiQaResult.create({
          data: {
            id: randomUUID(),
            aiQaRunId: run.id,
            contractVersion: result.schemaVersion,
            promptVersion: "video-frame-qa-v1",
            overallStatus: result.overallStatus,
            summary: result.summary,
            limitationsJson: result.limitations,
            criteriaJson: result.criteria,
            outputHash,
          },
        }),
        this.client.aiQaRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            safeResultCode: "AI_QA_COMPLETED",
            resolvedModelId: result.resolvedModelId,
            responseId: result.responseId,
            providerCallCount: this.provider.externalCallCount - providerCallsBefore,
            ...(result.usage ? { usageJson: result.usage as Prisma.InputJsonValue } : {}),
            finishedAt: new Date(),
          },
        }),
        this.client.generationJob.update({
          where: { id: job.id },
          data: { status: "AWAITING_HUMAN_QA", safeResultCode: "AWAITING_OWNER_QA" },
        }),
      ]);
      return result;
    } catch (error) {
      await this.client.aiQaRun.update({
        where: { id: run.id },
        data: {
          status: "AMBIGUOUS",
          safeResultCode: "AI_QA_RESULT_AMBIGUOUS",
          providerCallCount: this.provider.externalCallCount - providerCallsBefore,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async readBytes(absolutePath: string) {
    const chunks: Buffer[] = [];
    for await (const chunk of createReadStream(absolutePath)) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
}
