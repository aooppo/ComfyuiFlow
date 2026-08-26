import { randomUUID } from "node:crypto";
import {
  AuthorizationConsumptionV3Schema,
  GenerationAttemptV3Schema,
  MaterializedGraphSnapshotV3Schema,
  type AttemptArtifactV3,
  type MaterializedGraphSnapshotV3,
} from "@comfyuiflow/contracts";
import type { Prisma } from "./generated/client/index.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export interface CapabilityV3McpTransport {
  submit(identity: {
    attemptId: string;
    authorizationConsumptionId: string;
    referencePlanDigest: string;
    materializedGraphSha256: string;
    capabilityEnvelopeDigest: string;
    runtimeContractDigest: string;
  }): Promise<{ promptId: string }>;
  status(
    attemptId: string,
  ): Promise<"PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN">;
  retain(attemptId: string): Promise<
    Array<{
      path: string;
      sha256: string;
      byteSize: number;
      mimeType: string;
    }>
  >;
}

export interface CapabilityArtifactPipelineV3 {
  process(input: {
    projectId: string;
    attemptId: string;
    retained: Awaited<ReturnType<CapabilityV3McpTransport["retain"]>>;
    snapshot: MaterializedGraphSnapshotV3;
  }): Promise<AttemptArtifactV3>;
}

export interface CapabilityV3McpToolClient {
  callTool<T = unknown>(name: string, input: Record<string, unknown>): Promise<T>;
}

export class CapabilityV3McpTransportClient implements CapabilityV3McpTransport {
  constructor(private readonly mcp: CapabilityV3McpToolClient) {}

  async submit(identity: Parameters<CapabilityV3McpTransport["submit"]>[0]) {
    const result = await this.mcp.callTool<Record<string, unknown>>(
      "comfyui_submit_capability_v3_attempt",
      identity,
    );
    if (typeof result?.promptId !== "string") throw new Error("SUBMISSION_AMBIGUOUS");
    return { promptId: result.promptId };
  }

  async status(attemptId: string) {
    const result = await this.mcp.callTool<Record<string, unknown>>(
      "comfyui_get_capability_v3_attempt_status",
      { attemptId },
    );
    const status = String(result?.status ?? "UNKNOWN").toUpperCase();
    if (status === "IN_PROGRESS") return "RUNNING" as const;
    if (["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "UNKNOWN"].includes(status))
      return status as Awaited<ReturnType<CapabilityV3McpTransport["status"]>>;
    return "UNKNOWN" as const;
  }

  async retain(attemptId: string) {
    const result = await this.mcp.callTool<Record<string, unknown>>(
      "comfyui_retain_capability_v3_artifacts",
      { attemptId },
    );
    if (!Array.isArray(result?.artifacts)) return [];
    return result.artifacts.map((item) => {
      const value = item as Record<string, unknown>;
      return {
        path: String(value.path),
        sha256: String(value.sha256),
        byteSize: Number(value.byteSize),
        mimeType: String(value.mimeType),
      };
    });
  }
}

export class CapabilityGenerationWorkerV3 {
  constructor(
    private readonly transport: CapabilityV3McpTransport,
    private readonly artifacts: CapabilityArtifactPipelineV3,
    private readonly client: ProjectPrisma = prisma,
  ) {}

  async runOnce() {
    const submitted = await this.client.generationAttemptV3Record.findFirst({
      where: { state: { in: ["SUBMITTED", "RECONCILING"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (submitted) return this.reconcile(submitted.id);

    const target = await this.client.generationBatchTargetV3Record.findFirst({
      where: { state: "QUEUED", generationBatch: { state: { in: ["QUEUED", "RUNNING"] } } },
      include: { generationBatch: { include: { authorization: true } }, generationSpec: true },
      orderBy: [{ createdAt: "asc" }, { ordinal: "asc" }, { id: "asc" }],
    });
    if (!target) return null;
    const authorization = target.generationBatch.authorization;
    const snapshotRecord = await this.client.materializedGraphSnapshotV3Record.findUnique({
      where: { generationSpecId: target.generationSpecId },
    });
    if (!snapshotRecord) return this.blockTarget(target.id, "MATERIALIZED_GRAPH_NOT_FROZEN");
    const snapshot = MaterializedGraphSnapshotV3Schema.parse(snapshotRecord.payloadJson);
    if (snapshot.validation.status !== "VALID")
      return this.blockTarget(target.id, "MATERIALIZED_GRAPH_VALIDATION_BLOCKED");
    if (authorization.state !== "ACTIVE" || authorization.expiresAt.getTime() <= Date.now())
      return this.blockTarget(target.id, "AUTHORIZATION_EXPIRED");
    if (authorization.consumedCalls >= authorization.maximumCalls)
      return this.blockTarget(target.id, "AUTHORIZATION_CALL_LIMIT_EXCEEDED");

    const attemptId = randomUUID();
    const consumptionId = randomUUID();
    const providerTaskId = randomUUID();
    const attemptNumber =
      (await this.client.generationAttemptV3Record.count({
        where: { generationBatchTargetId: target.id },
      })) + 1;
    const now = new Date();
    const consumption = AuthorizationConsumptionV3Schema.parse({
      id: consumptionId,
      authorizationId: authorization.id,
      generationBatchTargetId: target.id,
      attemptId,
      operation: "SUBMIT",
      sequence: authorization.consumedCalls + 1,
      consumedCalls: 1,
      consumedCostMicros:
        target.generationBatch.maximumCostMicros === null
          ? null
          : Math.ceil(
              Number(target.generationBatch.maximumCostMicros) /
                target.generationBatch.maximumCalls,
            ),
      createdAt: now.toISOString(),
    });
    const attempt = GenerationAttemptV3Schema.parse({
      id: attemptId,
      generationBatchTargetId: target.id,
      generationSpecRef: { id: target.generationSpec.id, version: target.generationSpec.version },
      authorizationConsumptionId: consumptionId,
      referencePlanDigest: snapshot.referencePlanDigest,
      materializedGraphSha256: snapshot.materializedGraphSha256,
      compilerRef: snapshot.compilerRef,
      validatorRef: snapshot.validatorRef,
      capabilityEnvelopeDigest: snapshot.capabilityEnvelopeDigest,
      runtimeContractDigest: snapshot.runtimeContractDigest,
      attemptNumber,
      idempotencyKey: `capability-v3:${target.id}:${attemptNumber}`,
      state: "SUBMITTING",
      providerTaskId,
      providerCallCount: 1,
      safeResultCode: "AUTHORIZATION_CONSUMED",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await this.client.$transaction(async (tx) => {
      const updated = await tx.generationAuthorizationV3Record.updateMany({
        where: {
          id: authorization.id,
          state: "ACTIVE",
          consumedCalls: authorization.consumedCalls,
          expiresAt: { gt: now },
        },
        data: {
          consumedCalls: { increment: 1 },
          ...(authorization.consumedCalls + 1 >= authorization.maximumCalls
            ? { state: "CONSUMED" as const }
            : {}),
        },
      });
      if (updated.count !== 1) throw new Error("AUTHORIZATION_CONCURRENTLY_CONSUMED");
      await tx.authorizationConsumptionV3Record.create({
        data: {
          id: consumption.id,
          projectId: target.projectId,
          authorizationId: consumption.authorizationId,
          generationBatchTargetId: consumption.generationBatchTargetId,
          attemptId: consumption.attemptId,
          operation: consumption.operation,
          sequence: consumption.sequence,
          consumedCalls: consumption.consumedCalls,
          consumedCostMicros: consumption.consumedCostMicros,
          payloadJson: consumption as Prisma.InputJsonValue,
          createdAt: now,
        },
      });
      await tx.generationAttemptV3Record.create({
        data: {
          id: attempt.id,
          projectId: target.projectId,
          generationBatchTargetId: attempt.generationBatchTargetId,
          generationSpecId: attempt.generationSpecRef.id,
          authorizationConsumptionId: attempt.authorizationConsumptionId,
          referencePlanDigest: attempt.referencePlanDigest,
          materializedGraphSha256: attempt.materializedGraphSha256,
          compilerKey: attempt.compilerRef.id,
          compilerVersion: attempt.compilerRef.version,
          validatorKey: attempt.validatorRef.id,
          validatorVersion: attempt.validatorRef.version,
          capabilityEnvelopeDigest: attempt.capabilityEnvelopeDigest,
          runtimeContractDigest: attempt.runtimeContractDigest,
          attemptNumber: attempt.attemptNumber,
          idempotencyKey: attempt.idempotencyKey,
          state: attempt.state,
          providerTaskId,
          providerCallCount: 1,
          safeResultCode: attempt.safeResultCode,
          payloadJson: attempt as Prisma.InputJsonValue,
          createdAt: now,
        },
      });
      await tx.generationBatchTargetV3Record.update({
        where: { id: target.id },
        data: {
          state: "RUNNING",
          safeResultCode: "AUTHORIZATION_CONSUMED",
          providerTaskId,
          providerCallCount: { increment: 1 },
          callConsumedAt: now,
        },
      });
      await tx.generationBatchV3Record.update({
        where: { id: target.generationBatchId },
        data: { state: "RUNNING", safeResultCode: "SUBMISSION_STARTED" },
      });
    });

    try {
      const result = await this.transport.submit({
        attemptId,
        authorizationConsumptionId: consumptionId,
        referencePlanDigest: snapshot.referencePlanDigest,
        materializedGraphSha256: snapshot.materializedGraphSha256,
        capabilityEnvelopeDigest: snapshot.capabilityEnvelopeDigest,
        runtimeContractDigest: snapshot.runtimeContractDigest,
      });
      if (result.promptId !== providerTaskId) throw new Error("SUBMISSION_IDENTITY_MISMATCH");
      await this.client.$transaction([
        this.client.generationAttemptV3Record.update({
          where: { id: attemptId },
          data: { state: "SUBMITTED", safeResultCode: "SUBMITTED" },
        }),
        this.client.generationBatchTargetV3Record.update({
          where: { id: target.id },
          data: { state: "SUBMITTED", safeResultCode: "SUBMITTED" },
        }),
      ]);
      return { attemptId, state: "SUBMITTED" as const, providerCallCount: 1 };
    } catch (error) {
      await this.markAmbiguous(attemptId, target.id, "SUBMISSION_AMBIGUOUS");
      return {
        attemptId,
        state: "AMBIGUOUS" as const,
        providerCallCount: 1,
        reason: error instanceof Error ? error.message : "Submission result is unknown",
      };
    }
  }

  private async reconcile(attemptId: string) {
    const attempt = await this.client.generationAttemptV3Record.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) return null;
    const status = await this.transport.status(attempt.id);
    if (status === "UNKNOWN") {
      await this.markAmbiguous(attempt.id, attempt.generationBatchTargetId, "RECONCILE_UNKNOWN");
      return { attemptId, state: "AMBIGUOUS" as const, providerCallCount: 0 };
    }
    if (status === "PENDING" || status === "RUNNING") {
      await this.client.generationAttemptV3Record.update({
        where: { id: attempt.id },
        data: { state: "RECONCILING", safeResultCode: status },
      });
      return { attemptId, state: "RECONCILING" as const, providerCallCount: 0 };
    }
    if (status !== "COMPLETED") {
      await this.finishAttempt(attempt, "FAILED", `PROVIDER_${status}`);
      return { attemptId, state: "FAILED" as const, providerCallCount: 0 };
    }
    const snapshotRecord = await this.client.materializedGraphSnapshotV3Record.findUniqueOrThrow({
      where: { materializedGraphSha256: attempt.materializedGraphSha256 },
    });
    const artifact = await this.artifacts.process({
      projectId: attempt.projectId,
      attemptId: attempt.id,
      retained: await this.transport.retain(attempt.id),
      snapshot: MaterializedGraphSnapshotV3Schema.parse(snapshotRecord.payloadJson),
    });
    const valid = artifact.technicalStatus === "VERIFIED";
    await this.finishAttempt(
      attempt,
      valid ? "COMPLETED" : "FAILED",
      valid ? "ARTIFACT_TECHNICAL_PASS" : (artifact.technicalResultCode ?? "ARTIFACT_INVALID"),
    );
    return { attemptId, state: valid ? ("SUCCEEDED" as const) : ("FAILED" as const), artifact };
  }

  private async finishAttempt(
    attempt: { id: string; generationBatchTargetId: string; projectId: string },
    targetState: "COMPLETED" | "FAILED",
    resultCode: string,
  ) {
    const target = await this.client.generationBatchTargetV3Record.findUniqueOrThrow({
      where: { id: attempt.generationBatchTargetId },
      select: { generationBatchId: true },
    });
    await this.client.$transaction([
      this.client.generationAttemptV3Record.update({
        where: { id: attempt.id },
        data: {
          state: targetState === "COMPLETED" ? "SUCCEEDED" : "FAILED",
          safeResultCode: resultCode,
        },
      }),
      this.client.generationBatchTargetV3Record.update({
        where: { id: attempt.generationBatchTargetId },
        data: { state: targetState, safeResultCode: resultCode },
      }),
    ]);
    const targets = await this.client.generationBatchTargetV3Record.findMany({
      where: { generationBatchId: target.generationBatchId },
      select: { state: true },
    });
    if (
      targets.every((item) =>
        ["COMPLETED", "FAILED", "CANCELLED", "AMBIGUOUS"].includes(item.state),
      )
    ) {
      const successful = targets.every((item) => item.state === "COMPLETED");
      await this.client.generationBatchV3Record.update({
        where: { id: target.generationBatchId },
        data: {
          state: successful ? "COMPLETED" : "FAILED",
          safeResultCode: successful ? "ALL_TARGETS_COMPLETED" : "TARGET_REVIEW_REQUIRED",
        },
      });
    }
  }

  private async markAmbiguous(attemptId: string, targetId: string, resultCode: string) {
    const target = await this.client.generationBatchTargetV3Record.findUniqueOrThrow({
      where: { id: targetId },
      select: { generationBatchId: true },
    });
    await this.client.$transaction([
      this.client.generationAttemptV3Record.update({
        where: { id: attemptId },
        data: { state: "AMBIGUOUS", safeResultCode: resultCode },
      }),
      this.client.generationBatchTargetV3Record.update({
        where: { id: targetId },
        data: { state: "AMBIGUOUS", safeResultCode: resultCode },
      }),
      this.client.generationBatchV3Record.update({
        where: { id: target.generationBatchId },
        data: { state: "FAILED", safeResultCode: "AMBIGUOUS_ATTEMPT_REVIEW_REQUIRED" },
      }),
    ]);
  }

  private async blockTarget(targetId: string, code: string) {
    await this.client.generationBatchTargetV3Record.update({
      where: { id: targetId },
      data: { state: "FAILED", safeResultCode: code },
    });
    return { targetId, state: "FAILED" as const, safeResultCode: code, providerCallCount: 0 };
  }
}
