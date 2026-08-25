import { randomUUID } from "node:crypto";
import type { VideoQaProvider } from "@comfyuiflow/ai-providers";
import type { GenerationExecutionSlotV1 } from "@comfyuiflow/contracts";
import { Prisma } from "./generated/client/index.js";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import type { MaterializedGenerationSlot } from "./comfyui-mcp-generation-provider.js";
import { GeneratedArtifactService } from "./generated-artifact-service.js";
import { GenerationExecutionService } from "./generation-execution-service.js";
import type { GenerationProvider } from "./generation-provider.js";
import { GenerationQaService } from "./generation-qa-service.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const LEASE_MS = 2 * 60_000;

export class GenerationWorker {
  private readonly execution: GenerationExecutionService;
  private readonly artifacts: GeneratedArtifactService;
  private readonly qa: GenerationQaService;

  constructor(
    private readonly provider: GenerationProvider,
    private readonly qaProvider: VideoQaProvider,
    private readonly client: ProjectPrisma = prisma,
    private readonly sourceStorage: StorageProvider = new LocalContentStorage(),
    private readonly generatedStorage: StorageProvider = new LocalContentStorage({
      root: process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
      maxBytes: Number(process.env.PROJECT_GENERATED_MAX_BYTES || 500 * 1024 * 1024),
    }),
  ) {
    this.execution = new GenerationExecutionService(client, sourceStorage);
    this.artifacts = new GeneratedArtifactService(client, generatedStorage);
    this.qa = new GenerationQaService(
      qaProvider,
      client,
      sourceStorage,
      generatedStorage,
      this.execution,
    );
  }

  async runOnce(workerId = "generation-worker"): Promise<any> {
    await this.recoverExpired();
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
    const claimed = await this.client.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('comfyuiflow-generation-worker'))`,
      );
      return tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        WITH candidate AS (
          SELECT job."id"
          FROM "GenerationJob" job
          JOIN "GenerationBatch" batch ON batch."id" = job."generationBatchId"
          WHERE (
              job."status" IN ('QUEUED', 'SUBMITTED', 'RUNNING')
              OR (job."status" = 'AMBIGUOUS' AND job."safeResultCode" = 'RECONCILE_REQUESTED')
            )
            AND batch."status" IN ('QUEUED', 'RUNNING')
            AND (job."leaseExpiresAt" IS NULL OR job."leaseExpiresAt" < CURRENT_TIMESTAMP)
            AND NOT EXISTS (
              SELECT 1 FROM "GenerationJob" active
              WHERE active."claimOwner" IS NOT NULL
                AND active."leaseExpiresAt" >= CURRENT_TIMESTAMP
            )
          ORDER BY batch."createdAt", job."createdAt"
          FOR UPDATE OF job SKIP LOCKED
          LIMIT 1
        )
        UPDATE "GenerationJob" AS job
        SET "claimOwner" = ${workerId},
            "claimedAt" = CURRENT_TIMESTAMP,
            "leaseExpiresAt" = ${leaseExpiresAt}
        FROM candidate
        WHERE job."id" = candidate."id"
        RETURNING job."id"
      `);
    });
    if (!claimed[0]) return null;
    return this.execute(claimed[0].id);
  }

  async reconcile(jobId: string): Promise<any> {
    const job = await this.client.generationJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "AMBIGUOUS" || !job.providerTaskId)
      throw new Error("JOB_NOT_RECONCILABLE");
    const status = await this.provider.status(job.providerTaskId);
    if (status === "COMPLETED") {
      await this.client.$transaction([
        this.client.generationJob.update({
          where: { id: job.id },
          data: { status: "SUBMITTED", safeResultCode: "RECONCILED_COMPLETED" },
        }),
        this.client.generationBatch.update({
          where: { id: job.generationBatchId },
          data: { status: "RUNNING", rowVersion: { increment: 1 } },
        }),
      ]);
      return this.execute(job.id, true);
    }
    await this.execution.appendEvent(job.id, "RECONCILE_OBSERVED", { status });
    return { id: job.id, status: "AMBIGUOUS" as const, providerStatus: status };
  }

  async cancel(jobId: string): Promise<any> {
    const job = await this.client.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("GENERATION_TARGET_INVALID");
    if (job.status === "QUEUED") {
      await this.client.generationJob.update({
        where: { id: job.id },
        data: {
          status: "CANCELLED",
          safeResultCode: "CANCELLED_BEFORE_START",
          finishedAt: new Date(),
        },
      });
      return { cancelled: true, remoteTerminationConfirmed: false };
    }
    if (!job.providerTaskId) throw new Error("JOB_NOT_RECONCILABLE");
    const result = await this.provider.cancel(job.providerTaskId);
    await this.client.generationJob.update({
      where: { id: job.id },
      data: {
        status: result.cancelled ? "CANCELLED" : job.status,
        safeResultCode: result.cancelled ? "CANCEL_REQUEST_ACCEPTED" : "CANCEL_NOT_CONFIRMED",
        ...(result.cancelled ? { finishedAt: new Date() } : {}),
      },
    });
    if (result.cancelled) await this.finishCancelledBatch(job.generationBatchId);
    return result;
  }

  private async execute(jobId: string, reconciledOverride = false) {
    const job = await this.client.generationJob.findUnique({
      where: { id: jobId },
      include: { generationBatch: true, generationBatchTarget: true },
    });
    if (!job) return null;
    const reconciledAttempt = reconciledOverride || job.status === "AMBIGUOUS";
    try {
      if (job.safeResultCode === "CANCEL_REQUESTED" && job.providerTaskId) {
        const cancelled = await this.provider.cancel(job.providerTaskId);
        await this.client.generationJob.update({
          where: { id: job.id },
          data: {
            status: cancelled.cancelled ? "CANCELLED" : job.status,
            safeResultCode: cancelled.cancelled
              ? "CANCEL_REQUEST_ACCEPTED"
              : "CANCEL_NOT_CONFIRMED",
            ...(cancelled.cancelled ? { finishedAt: new Date() } : {}),
          },
        });
        if (cancelled.cancelled) await this.finishCancelledBatch(job.generationBatchId);
        return { id: job.id, status: cancelled.cancelled ? "CANCELLED" : job.status };
      }
      let providerTaskId = job.providerTaskId;
      if (job.status === "QUEUED") {
        const [generationReadiness, qaReadiness] = await Promise.all([
          this.provider.preflight(),
          this.qaProvider.validateConfiguration(),
        ]);
        if (!generationReadiness.ready || !qaReadiness.configured) {
          const code = !generationReadiness.ready ? "WORKFLOW_NOT_READY" : "QA_NOT_READY";
          await this.pausePreflight(job.id, job.generationBatchId, code);
          return { id: job.id, status: "QUEUED" as const, safeResultCode: code };
        }
        const requestHash = canonicalSha256({
          jobId: job.id,
          targetHash: job.generationBatchTarget.targetHash,
          workflowSha256: job.generationBatch.workflowSha256,
        });
        let consumption: { id: string };
        try {
          consumption = await this.execution.consume(job.id, "GENERATION_SUBMIT", requestHash);
        } catch (error) {
          if (error instanceof ProjectAssetError) {
            await this.pausePreflight(job.id, job.generationBatchId, error.code);
            return { id: job.id, status: "QUEUED" as const, safeResultCode: error.code };
          }
          throw error;
        }
        await this.client.$transaction([
          this.client.generationBatch.update({
            where: { id: job.generationBatchId },
            data: { status: "RUNNING", rowVersion: { increment: 1 } },
          }),
          this.client.generationJob.update({
            where: { id: job.id },
            data: {
              status: "RUNNING",
              safeResultCode: "GENERATION_PERMISSION_CONSUMED",
              providerCallCount: { increment: 1 },
            },
          }),
        ]);
        await this.execution.appendEvent(job.id, "GENERATION_PERMISSION_CONSUMED");
        const promptId = randomUUID();
        providerTaskId = promptId;
        await this.client.generationJob.update({
          where: { id: job.id },
          data: { providerTaskId: promptId, safeResultCode: "SUBMISSION_STARTED" },
        });
        try {
          const slots = await this.materializeSlots(
            job.generationBatchTarget.slotManifestJson as any[],
          );
          const submitted = await this.provider.submit({
            jobId: job.id,
            promptId,
            workflowId: job.generationBatch.workflowId,
            compiledPrompt: job.generationBatchTarget.compiledPrompt,
            slots,
            grantId: consumption.id,
          } as any);
          if (submitted.taskId !== promptId)
            throw new Error("Provider returned a task other than the preselected task ID");
          await this.client.generationJob.update({
            where: { id: job.id },
            data: {
              status: "SUBMITTED",
              providerTaskId,
              safeResultCode: "PROVIDER_TASK_SUBMITTED",
            },
          });
          await this.execution.appendEvent(job.id, "PROVIDER_TASK_SUBMITTED", {
            providerTaskId,
          });
        } catch {
          await this.pauseAmbiguous(job.id, job.generationBatchId, "SUBMISSION_RESULT_AMBIGUOUS");
          return { id: job.id, status: "AMBIGUOUS" as const };
        }
      }
      if (!providerTaskId) {
        await this.pauseAmbiguous(job.id, job.generationBatchId, "PROVIDER_TASK_ID_MISSING");
        return { id: job.id, status: "AMBIGUOUS" as const };
      }
      const providerStatus = await this.provider.status(providerTaskId);
      if (providerStatus === "PENDING" || providerStatus === "RUNNING") {
        await this.client.generationJob.update({
          where: { id: job.id },
          data: {
            status: "RUNNING",
            safeResultCode: "PROVIDER_TASK_RUNNING",
            claimOwner: null,
            leaseExpiresAt: null,
          },
        });
        return { id: job.id, status: "RUNNING" as const };
      }
      if (providerStatus === "UNKNOWN") {
        await this.pauseAmbiguous(job.id, job.generationBatchId, "PROVIDER_TASK_RESULT_UNKNOWN");
        return { id: job.id, status: "AMBIGUOUS" as const };
      }
      if (providerStatus !== "COMPLETED") {
        await this.pauseTechnical(job.id, job.generationBatchId, `PROVIDER_${providerStatus}`);
        return { id: job.id, status: "TECHNICAL_FAILED" as const };
      }
      const retained = await this.provider.retainArtifacts(providerTaskId, job.id);
      let validated;
      try {
        validated = await this.artifacts.retainAndValidate(job.id, retained, {
          requireH3Profile: this.provider.profileId === "minimax-h3-4s-v1",
        });
      } catch {
        await this.pauseTechnical(job.id, job.generationBatchId, "ARTIFACT_RETENTION_FAILED");
        return { id: job.id, status: "TECHNICAL_FAILED" as const };
      }
      if (!validated.valid || !("artifact" in validated)) return validated;
      await this.execution.appendEvent(job.id, "ARTIFACT_TECHNICAL_PASS", {
        artifactId: validated.artifact.id,
      });
      try {
        await this.qa.review(validated.artifact.id);
      } catch {
        await this.client.generationJob.update({
          where: { id: job.id },
          data: { status: "AWAITING_HUMAN_QA", safeResultCode: "AI_QA_UNAVAILABLE" },
        });
      }
      await this.releaseNextOrAwait(job.generationBatchId, reconciledAttempt);
      return { id: job.id, status: "AWAITING_HUMAN_QA" as const };
    } finally {
      await this.client.generationJob
        .update({
          where: { id: job.id },
          data: { claimOwner: null, leaseExpiresAt: null },
        })
        .catch(() => undefined);
    }
  }

  private async materializeSlots(slots: GenerationExecutionSlotV1[]) {
    return Promise.all(
      slots.map(async (slot): Promise<MaterializedGenerationSlot> => {
        const asset = await this.client.asset.findUnique({
          where: { id: slot.projectAssetId },
          include: { storedObject: true },
        });
        if (!asset) throw new Error("REFERENCE_NOT_READY");
        const localPath = await this.sourceStorage.resolveVerified(
          asset.storedObject.storageKey,
          slot.sha256,
          Number(asset.storedObject.byteSize),
        );
        return { ...slot, localPath };
      }),
    );
  }

  private async recoverExpired() {
    const expired = await this.client.generationJob.findMany({
      where: { status: "RUNNING", leaseExpiresAt: { lt: new Date() } },
    });
    for (const job of expired) {
      if (job.providerTaskId) {
        await this.client.generationJob.update({
          where: { id: job.id },
          data: { status: "SUBMITTED", claimOwner: null, leaseExpiresAt: null },
        });
      } else {
        const consumed = await this.client.authorizationConsumption.count({
          where: { generationJobId: job.id, operation: "GENERATION_SUBMIT" },
        });
        if (consumed)
          await this.pauseAmbiguous(job.id, job.generationBatchId, "LEASE_EXPIRED_AFTER_CONSUME");
        else
          await this.client.generationJob.update({
            where: { id: job.id },
            data: { status: "QUEUED", claimOwner: null, leaseExpiresAt: null },
          });
      }
    }
  }

  private async pauseAmbiguous(jobId: string, batchId: string, code: string) {
    await this.client.$transaction([
      this.client.generationJob.update({
        where: { id: jobId },
        data: { status: "AMBIGUOUS", safeResultCode: code },
      }),
      this.client.generationBatch.update({
        where: { id: batchId },
        data: { status: "PAUSED", rowVersion: { increment: 1 } },
      }),
    ]);
  }

  private async pausePreflight(jobId: string, batchId: string, code: string) {
    await this.client.$transaction([
      this.client.generationJob.update({
        where: { id: jobId },
        data: { safeResultCode: code },
      }),
      this.client.generationBatch.update({
        where: { id: batchId },
        data: { status: "PAUSED", rowVersion: { increment: 1 } },
      }),
    ]);
  }

  private async pauseTechnical(jobId: string, batchId: string, code: string) {
    await this.client.$transaction([
      this.client.generationJob.update({
        where: { id: jobId },
        data: { status: "TECHNICAL_FAILED", safeResultCode: code, finishedAt: new Date() },
      }),
      this.client.generationBatch.update({
        where: { id: batchId },
        data: { status: "PAUSED", rowVersion: { increment: 1 } },
      }),
    ]);
  }

  private async releaseNextOrAwait(batchId: string, reconciledAttempt: boolean) {
    const remaining = await this.client.generationJob.count({
      where: { generationBatchId: batchId, status: "QUEUED" },
    });
    await this.client.generationBatch.update({
      where: { id: batchId },
      data: {
        status: remaining ? (reconciledAttempt ? "PAUSED" : "RUNNING") : "AWAITING_HUMAN_QA",
        rowVersion: { increment: 1 },
      },
    });
  }

  private async finishCancelledBatch(batchId: string) {
    const jobs = await this.client.generationJob.findMany({
      where: { generationBatchId: batchId },
      select: { status: true },
    });
    const terminal = new Set(["QA_PASS", "QA_FAIL", "TECHNICAL_FAILED", "CANCELLED"]);
    if (jobs.length > 0 && jobs.every((job) => terminal.has(job.status)))
      await this.client.generationBatch.update({
        where: { id: batchId },
        data: {
          status: jobs.every((job) => job.status === "CANCELLED") ? "CANCELLED" : "COMPLETED",
          rowVersion: { increment: 1 },
        },
      });
  }
}
