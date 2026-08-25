import { createHash } from "node:crypto";
import type { AiModelProvider } from "@comfyuiflow/ai-providers";
import { AssetUnderstandingProviderResultSchema } from "@comfyuiflow/contracts";
import { Prisma } from "./generated/client/index.js";
import { readAnalysisContent } from "./analysis-content.js";
import { analysisConfig, type AnalysisConfig } from "./analysis-config.js";
import { ProjectAssetError } from "./contracts.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export class AnalysisWorker {
  constructor(
    private readonly provider: AiModelProvider,
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage(),
    private readonly config: AnalysisConfig = analysisConfig(),
  ) {}

  async runOnce(workerId = "project-worker") {
    await this.recoverExpired();
    const leaseExpiresAt = new Date(Date.now() + this.config.leaseMs);
    const claimed = await this.client.$transaction((tx) =>
      tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        WITH candidate AS (
          SELECT "id"
          FROM "AssetUnderstandingRun"
          WHERE "status" = 'QUEUED'
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE "AssetUnderstandingRun" AS run
        SET "status" = 'RUNNING',
            "claimedBy" = ${workerId},
            "startedAt" = CURRENT_TIMESTAMP,
            "leaseExpiresAt" = ${leaseExpiresAt}
        FROM candidate
        WHERE run."id" = candidate."id"
        RETURNING run."id"
      `),
    );
    const runId = claimed[0]?.id;
    if (!runId) return null;
    return this.execute(runId);
  }

  async recoverExpired() {
    const expired = await this.client.assetUnderstandingRun.findMany({
      where: { status: "RUNNING", leaseExpiresAt: { lt: new Date() } },
      include: { attempt: true },
    });
    for (const run of expired) {
      await this.client.assetUnderstandingRun.update({
        where: { id: run.id },
        data: run.attempt
          ? {
              status: "AMBIGUOUS",
              resultCode: "LEASE_EXPIRED_AFTER_ATTEMPT",
              finishedAt: new Date(),
            }
          : { status: "QUEUED", claimedBy: null, leaseExpiresAt: null, startedAt: null },
      });
    }
  }

  private async execute(runId: string) {
    const run = await this.client.assetUnderstandingRun.findUnique({
      where: { id: runId },
      include: {
        manifest: {
          include: {
            items: {
              include: { asset: { include: { storedObject: true } } },
              orderBy: { position: "asc" },
            },
          },
        },
        attempt: true,
      },
    });
    if (!run || run.status !== "RUNNING") return null;
    if (run.attempt) return this.markAmbiguous(runId, "ATTEMPT_ALREADY_EXISTS");
    try {
      const images = [];
      for (const item of run.manifest.items) {
        images.push(await readAnalysisContent(item, this.storage));
      }
      const requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            manifestHash: run.manifest.manifestHash,
            slots: run.manifest.items.map((item) => item.slot),
          }),
        )
        .digest("hex");
      const attempt = await this.client.aiProviderAttempt.create({
        data: {
          runId,
          providerId: run.manifest.providerId,
          requestedModelId: run.manifest.modelId,
          requestHash,
          status: "STARTED",
        },
      });
      if (!this.provider.understandAssets)
        return this.fail(runId, "ANALYSIS_PROVIDER_UNSUPPORTED", attempt.id);
      const result = AssetUnderstandingProviderResultSchema.parse(
        await this.provider.understandAssets({
          taskType: "ASSET_UNDERSTANDING",
          contractVersion: "asset-understanding-v1",
          modelRef: { providerId: run.manifest.providerId, modelId: run.manifest.modelId },
          promptVersion: "asset-understanding-v1",
          schemaVersion: "asset-understanding-v1",
          images,
          context: "Return only bounded structured observations for each anonymous image slot.",
        }),
      );
      const expectedSlots = run.manifest.items.map((item) => item.slot).sort();
      const actualSlots = result.results.map((item) => item.slot).sort();
      if (JSON.stringify(expectedSlots) !== JSON.stringify(actualSlots)) {
        return this.fail(runId, "ANALYSIS_RESULT_SLOT_MISMATCH", attempt.id);
      }
      await this.client.$transaction(async (tx) => {
        for (const item of run.manifest.items) {
          const resultItem = result.results.find((value) => value.slot === item.slot)!;
          const aggregate = await tx.assetUnderstandingRevision.aggregate({
            where: { projectAssetId: item.assetId },
            _max: { ordinal: true },
          });
          await tx.assetUnderstandingRevision.create({
            data: {
              projectAssetId: item.assetId,
              runId,
              attemptId: attempt.id,
              ordinal: (aggregate._max.ordinal ?? 0) + 1,
              authorType: "MACHINE",
              schemaVersion: "asset-understanding-v1",
              factsJson: resultItem.facts,
            },
          });
        }
        await tx.aiProviderAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "SUCCEEDED",
            resolvedModelId: result.resolvedModelId,
            responseId: result.responseId,
            ...(result.usage ? { usageJson: result.usage } : {}),
            finishedAt: new Date(),
          },
        });
        await tx.assetUnderstandingRun.update({
          where: { id: runId },
          data: {
            status: "COMPLETED",
            resultCode: "ANALYSIS_COMPLETED",
            finishedAt: new Date(),
            leaseExpiresAt: null,
          },
        });
      });
      return { id: runId, status: "COMPLETED" as const };
    } catch (error) {
      if (error instanceof ProjectAssetError) return this.fail(runId, error.code);
      return this.markAmbiguous(runId, "ANALYSIS_ATTEMPT_AMBIGUOUS");
    }
  }

  private async fail(runId: string, code: string, attemptId?: string) {
    await this.client.$transaction(async (tx) => {
      if (attemptId) {
        await tx.aiProviderAttempt.update({
          where: { id: attemptId },
          data: { status: "FAILED", safeErrorCode: code, finishedAt: new Date() },
        });
      }
      await tx.assetUnderstandingRun.update({
        where: { id: runId },
        data: { status: "FAILED", resultCode: code, finishedAt: new Date(), leaseExpiresAt: null },
      });
    });
    return { id: runId, status: "FAILED" as const, resultCode: code };
  }

  private async markAmbiguous(runId: string, code: string) {
    await this.client.assetUnderstandingRun.update({
      where: { id: runId },
      data: { status: "AMBIGUOUS", resultCode: code, finishedAt: new Date(), leaseExpiresAt: null },
    });
    return { id: runId, status: "AMBIGUOUS" as const, resultCode: code };
  }
}
