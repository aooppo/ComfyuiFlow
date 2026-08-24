import { analysisConfig, type AnalysisConfig } from "./analysis-config.js";
import { ASSET_UNDERSTANDING_VERSION, manifestHash } from "./analysis-manifest.js";
import { ProjectAssetError } from "./contracts.js";
import type { z } from "zod";
import type { analysisPreviewSchema } from "./analysis-contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export interface AnalysisPreview {
  manifestHash: string;
  provider: { providerId: string; modelId: string; contractVersion: string };
  assets: Array<{
    slot: string;
    assetId: string;
    displayName: string;
    sha256: string;
    byteSize: number;
  }>;
  maxCalls: 1;
  externalCalls: 0;
  expiresAt: string;
}

export class AnalysisService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly config: AnalysisConfig = analysisConfig(),
  ) {}

  async preview(
    projectId: string,
    input: z.infer<typeof analysisPreviewSchema>,
  ): Promise<AnalysisPreview> {
    const project = await this.client.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    if (project.status !== "ACTIVE")
      throw new ProjectAssetError("PROJECT_ARCHIVED", "Restore this project before analysis", 409);
    const assets = await this.client.asset.findMany({
      where: { id: { in: input.assetIds }, projectId, status: "READY", mediaType: "IMAGE" },
      include: { storedObject: true },
    });
    if (assets.length !== input.assetIds.length) {
      throw new ProjectAssetError(
        "ANALYSIS_ASSET_NOT_READY",
        "Select ready image assets from this project",
        409,
      );
    }
    const inOrder = input.assetIds.map((id) => assets.find((asset) => asset.id === id)!);
    const totalByteSize = inOrder.reduce(
      (total, asset) => total + Number(asset.storedObject.byteSize),
      0,
    );
    if (inOrder.some((asset) => Number(asset.storedObject.byteSize) > this.config.maxImageBytes)) {
      throw new ProjectAssetError(
        "ANALYSIS_IMAGE_TOO_LARGE",
        "One selected image exceeds the analysis size limit",
        413,
      );
    }
    if (totalByteSize > this.config.maxBatchBytes) {
      throw new ProjectAssetError(
        "ANALYSIS_BATCH_TOO_LARGE",
        "Selected images exceed the analysis batch size limit",
        413,
      );
    }
    const hash = manifestHash({
      projectId,
      providerId: input.providerId,
      modelId: input.modelId,
      items: inOrder.map((asset) => ({
        assetId: asset.id,
        sha256: asset.storedObject.sha256,
        byteSize: Number(asset.storedObject.byteSize),
        mediaType: asset.mediaType,
      })),
    });
    const expiresAt = new Date(Date.now() + this.config.manifestTtlMs);
    await this.client.assetUnderstandingManifest.upsert({
      where: { manifestHash: hash },
      update: {},
      create: {
        projectId,
        manifestHash: hash,
        providerId: input.providerId,
        modelId: input.modelId,
        taskType: "ASSET_UNDERSTANDING",
        promptVersion: ASSET_UNDERSTANDING_VERSION,
        schemaVersion: ASSET_UNDERSTANDING_VERSION,
        maxCalls: 1,
        assetCount: inOrder.length,
        totalByteSize: BigInt(totalByteSize),
        expiresAt,
        items: {
          create: inOrder.map((asset, index) => ({
            position: index,
            slot: `A${index + 1}`,
            assetId: asset.id,
            sha256: asset.storedObject.sha256,
            byteSize: asset.storedObject.byteSize,
            mediaType: asset.mediaType,
          })),
        },
      },
    });
    return {
      manifestHash: hash,
      provider: {
        providerId: input.providerId,
        modelId: input.modelId,
        contractVersion: ASSET_UNDERSTANDING_VERSION,
      },
      assets: inOrder.map((asset, index) => ({
        slot: `A${index + 1}`,
        assetId: asset.id,
        displayName: asset.displayName,
        sha256: asset.storedObject.sha256,
        byteSize: Number(asset.storedObject.byteSize),
      })),
      maxCalls: 1,
      externalCalls: 0,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirm(projectId: string, input: { manifestHash: string; idempotencyKey: string }) {
    const manifest = await this.client.assetUnderstandingManifest.findUnique({
      where: { manifestHash: input.manifestHash },
    });
    if (!manifest || manifest.projectId !== projectId) {
      throw new ProjectAssetError(
        "ANALYSIS_MANIFEST_NOT_FOUND",
        "Analysis preview has expired or changed",
        409,
      );
    }
    if (manifest.expiresAt <= new Date()) {
      throw new ProjectAssetError(
        "ANALYSIS_MANIFEST_EXPIRED",
        "Analysis preview has expired; preview again",
        409,
      );
    }
    const isInternalFake = manifest.providerId === "fake" || manifest.providerId === "dry-run";
    if (!isInternalFake && !this.config.liveEnabled) {
      throw new ProjectAssetError(
        "ANALYSIS_LIVE_DISABLED",
        "External asset analysis is disabled",
        409,
      );
    }
    return this.client.$transaction(async (tx) => {
      const existing = await tx.assetUnderstandingRun.findUnique({
        where: { projectId_idempotencyKey: { projectId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return runDto(existing);
      const grant = await tx.aiCallGrant.create({
        data: {
          manifestId: manifest.id,
          operation: "ASSET_UNDERSTANDING",
          providerId: manifest.providerId,
          modelId: manifest.modelId,
          maxCalls: 1,
          idempotencyKey: input.idempotencyKey,
          status: "CONSUMED",
          expiresAt: manifest.expiresAt,
          consumedAt: new Date(),
        },
      });
      const run = await tx.assetUnderstandingRun.create({
        data: {
          projectId,
          manifestId: manifest.id,
          grantId: grant.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      return runDto(run);
    });
  }

  async getRun(runId: string) {
    const run = await this.client.assetUnderstandingRun.findUnique({
      where: { id: runId },
      include: { attempt: true },
    });
    if (!run)
      throw new ProjectAssetError("ANALYSIS_RUN_NOT_FOUND", "Analysis run was not found", 404);
    return { ...runDto(run), externalAttempts: run.attempt ? 1 : 0 };
  }
}

function runDto(run: {
  id: string;
  status: string;
  resultCode: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}) {
  return {
    id: run.id,
    status: run.status,
    resultCode: run.resultCode,
    externalAttempts: 0,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}
