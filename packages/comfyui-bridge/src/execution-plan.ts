import type { JobStatusResult } from "@comfyuiflow/contracts";
import { hashCanonical } from "@comfyuiflow/spike-core";
import type { ComfyUiExecutionService, StagedInputEvidence } from "./execution.js";

export type ExecutionPlanInputRole =
  "SCENE" | "PRODUCT" | "CHARACTER_FULL_BODY" | "CHARACTER_FACE" | "CHARACTER_REAR";

export interface FrozenComfyUiExecutionRecord {
  executionPlanId: string;
  executionPlanSha256: string;
  lifecycleStatus: "FROZEN" | "INVALIDATED" | "DRAFT" | "SUPERSEDED";
  executorType: "COMFYUI_GRAPH";
  generationJobId: string;
  generationJobStatus: string;
  authorizationConsumptionId: string;
  authorizationOperation: "GENERATION_SUBMIT";
  authorizationGenerationJobId: string;
  materializedExecutionSha256: string;
  authorizationMaterializedPlanSha256: string;
  workflowId: string;
  workflowSha256: string;
  providerTaskId: string;
  compiledPrompt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  outputPrefix: string;
  inputs: Array<{ role: ExecutionPlanInputRole; localPath: string; sha256: string }>;
}

export interface ExecutionPlanIdentity {
  executionPlanId: string;
  executionPlanSha256: string;
  generationJobId: string;
  authorizationConsumptionId: string;
  materializedExecutionSha256: string;
}

export interface ComfyUiExecutionPlanStore {
  loadForSubmission(identity: ExecutionPlanIdentity): Promise<FrozenComfyUiExecutionRecord | null>;
  loadSubmitted(generationJobId: string): Promise<FrozenComfyUiExecutionRecord | null>;
}

function roleName(role: ExecutionPlanInputRole): StagedInputEvidence["role"] {
  const names = {
    SCENE: "scene",
    PRODUCT: "product",
    CHARACTER_FULL_BODY: "character",
    CHARACTER_FACE: "characterFace",
    CHARACTER_REAR: "characterRear",
  } as const;
  return names[role];
}

function assertFrozenIdentity(
  record: FrozenComfyUiExecutionRecord,
  input: ExecutionPlanIdentity,
): void {
  if (
    record.executionPlanId !== input.executionPlanId ||
    record.executionPlanSha256 !== input.executionPlanSha256 ||
    record.generationJobId !== input.generationJobId ||
    record.authorizationConsumptionId !== input.authorizationConsumptionId ||
    record.materializedExecutionSha256 !== input.materializedExecutionSha256
  )
    throw new Error("EXECUTION_PLAN_IDENTITY_MISMATCH");
  if (record.lifecycleStatus !== "FROZEN" || record.executorType !== "COMFYUI_GRAPH") {
    throw new Error("EXECUTION_PLAN_NOT_FROZEN");
  }
  if (
    record.authorizationOperation !== "GENERATION_SUBMIT" ||
    record.authorizationGenerationJobId !== record.generationJobId ||
    record.authorizationMaterializedPlanSha256 !== record.materializedExecutionSha256
  )
    throw new Error("EXECUTION_AUTHORIZATION_MISMATCH");
  if (record.generationJobStatus !== "RUNNING") throw new Error("GENERATION_JOB_NOT_DISPATCHABLE");
  if (!record.compiledPrompt.trim()) throw new Error("EXECUTION_PROMPT_EMPTY");
  if (
    record.inputs.length === 0 ||
    new Set(record.inputs.map((item) => item.role)).size !== record.inputs.length
  ) {
    throw new Error("EXECUTION_INPUTS_INVALID");
  }
}

export class ComfyUiExecutionPlanService {
  constructor(
    private readonly dependencies: {
      store: ComfyUiExecutionPlanStore;
      execution: ComfyUiExecutionService;
      recheckReadiness(workflowId: string): Promise<{ ready: boolean; blockers: string[] }>;
    },
  ) {}

  async submit(input: ExecutionPlanIdentity) {
    const record = await this.dependencies.store.loadForSubmission(input);
    if (!record) throw new Error("EXECUTION_PLAN_NOT_FOUND");
    assertFrozenIdentity(record, input);
    this.dependencies.execution.assertLiveEnabled();
    const readiness = await this.dependencies.recheckReadiness(record.workflowId);
    if (!readiness.ready)
      throw new Error(`EXECUTION_READINESS_BLOCKED:${readiness.blockers.join(",")}`);
    const staged = await Promise.all(
      record.inputs.map(
        async (item) =>
          [
            item.role,
            await this.dependencies.execution.stageInput({
              workflowId: record.workflowId,
              role: roleName(item.role),
              localPath: item.localPath,
              expectedSha256: item.sha256,
            }),
          ] as const,
      ),
    );
    const byRole = new Map(staged);
    const character = byRole.get("CHARACTER_FULL_BODY");
    const scene = byRole.get("SCENE");
    if (!character || !scene) throw new Error("EXECUTION_INPUTS_INVALID");
    return this.dependencies.execution.submitPreauthorized({
      workflowId: record.workflowId,
      workflowSha256: record.workflowSha256,
      promptId: record.providerTaskId,
      runId: record.generationJobId,
      character,
      scene,
      ...(byRole.get("PRODUCT") ? { product: byRole.get("PRODUCT")! } : {}),
      ...(byRole.get("CHARACTER_FACE") ? { characterFace: byRole.get("CHARACTER_FACE")! } : {}),
      ...(byRole.get("CHARACTER_REAR") ? { characterRear: byRole.get("CHARACTER_REAR")! } : {}),
      shot: {
        positivePrompt: record.compiledPrompt,
        durationSeconds: record.durationSeconds,
        width: record.width,
        height: record.height,
        fps: record.fps,
        outputPrefix: record.outputPrefix,
      },
      authorizationScope: {
        workflowId: record.workflowId,
        workflowSha256: record.workflowSha256,
        materializedExecutionSha256: record.materializedExecutionSha256,
        assetHashes: record.inputs.map((item) => ({
          role: item.role === "CHARACTER_FULL_BODY" ? "CHARACTER" : item.role,
          sha256: item.sha256,
        })),
      },
    });
  }

  async status(generationJobId: string): Promise<JobStatusResult> {
    const record = await this.dependencies.store.loadSubmitted(generationJobId);
    if (!record) throw new Error("GENERATION_JOB_NOT_FOUND");
    return this.dependencies.execution.status(record.providerTaskId);
  }

  async retain(generationJobId: string) {
    const record = await this.dependencies.store.loadSubmitted(generationJobId);
    if (!record) throw new Error("GENERATION_JOB_NOT_FOUND");
    return this.dependencies.execution.retainArtifacts({
      promptId: record.providerTaskId,
      runId: record.generationJobId,
      workflowId: record.workflowId,
    });
  }

  async cancel(generationJobId: string) {
    const record = await this.dependencies.store.loadSubmitted(generationJobId);
    if (!record) throw new Error("GENERATION_JOB_NOT_FOUND");
    return this.dependencies.execution.cancel(record.providerTaskId);
  }
}

export interface FrozenCapabilityV3ExecutionRecord {
  attemptId: string;
  attemptState: string;
  authorizationConsumptionId: string;
  authorizationOperation: "SUBMIT";
  authorizationAttemptId: string;
  providerTaskId: string;
  referencePlanDigest: string;
  materializedGraphSha256: string;
  capabilityEnvelopeDigest: string;
  runtimeContractDigest: string;
  validationStatus: "VALID";
  materializedGraph: Record<string, unknown>;
  outputNodeId: string;
  outputMediaKey: "video";
  inputs: Array<{
    localPath: string;
    sha256: string;
    stagedInputName: string;
  }>;
}

export interface CapabilityV3ExecutionIdentity {
  attemptId: string;
  authorizationConsumptionId: string;
  referencePlanDigest: string;
  materializedGraphSha256: string;
  capabilityEnvelopeDigest: string;
  runtimeContractDigest: string;
}

export interface ComfyUiCapabilityV3ExecutionStore {
  loadForSubmission(
    identity: CapabilityV3ExecutionIdentity,
  ): Promise<FrozenCapabilityV3ExecutionRecord | null>;
  loadSubmitted(attemptId: string): Promise<FrozenCapabilityV3ExecutionRecord | null>;
}

function assertCapabilityV3Identity(
  record: FrozenCapabilityV3ExecutionRecord,
  identity: CapabilityV3ExecutionIdentity,
) {
  if (
    record.attemptId !== identity.attemptId ||
    record.authorizationConsumptionId !== identity.authorizationConsumptionId ||
    record.referencePlanDigest !== identity.referencePlanDigest ||
    record.materializedGraphSha256 !== identity.materializedGraphSha256 ||
    record.capabilityEnvelopeDigest !== identity.capabilityEnvelopeDigest ||
    record.runtimeContractDigest !== identity.runtimeContractDigest
  )
    throw new Error("CAPABILITY_V3_FROZEN_IDENTITY_MISMATCH");
  if (
    record.authorizationOperation !== "SUBMIT" ||
    record.authorizationAttemptId !== record.attemptId ||
    record.validationStatus !== "VALID" ||
    !["SUBMITTING", "SUBMITTED", "RECONCILING"].includes(record.attemptState)
  )
    throw new Error("CAPABILITY_V3_NOT_DISPATCHABLE");
  if (hashCanonical(record.materializedGraph) !== record.materializedGraphSha256)
    throw new Error("FROZEN_GRAPH_DIGEST_MISMATCH");
  if (
    record.inputs.length > 15 ||
    new Set(record.inputs.map((item) => item.stagedInputName)).size !== record.inputs.length
  )
    throw new Error("CAPABILITY_V3_FROZEN_INPUTS_INVALID");
}

export class ComfyUiCapabilityV3ExecutionService {
  constructor(
    private readonly dependencies: {
      store: ComfyUiCapabilityV3ExecutionStore;
      execution: ComfyUiExecutionService;
      recheckRuntimeContract(input: {
        capabilityEnvelopeDigest: string;
        runtimeContractDigest: string;
      }): Promise<{ ready: boolean; blockers: string[] }>;
    },
  ) {}

  async submit(identity: CapabilityV3ExecutionIdentity) {
    const record = await this.dependencies.store.loadForSubmission(identity);
    if (!record) throw new Error("CAPABILITY_V3_ATTEMPT_NOT_FOUND");
    assertCapabilityV3Identity(record, identity);
    this.dependencies.execution.assertLiveEnabled();
    const readiness = await this.dependencies.recheckRuntimeContract({
      capabilityEnvelopeDigest: record.capabilityEnvelopeDigest,
      runtimeContractDigest: record.runtimeContractDigest,
    });
    if (!readiness.ready)
      throw new Error(`CAPABILITY_V3_RUNTIME_BLOCKED:${readiness.blockers.join(",")}`);
    await Promise.all(
      record.inputs.map((item) =>
        this.dependencies.execution.stageFrozenInput({
          localPath: item.localPath,
          expectedSha256: item.sha256,
          expectedStagedInputName: item.stagedInputName,
        }),
      ),
    );
    const result = await this.dependencies.execution.submitFrozenGraph({
      promptId: record.providerTaskId,
      materializedGraph: record.materializedGraph,
      materializedGraphSha256: record.materializedGraphSha256,
    });
    if (result.promptId !== record.providerTaskId)
      throw new Error("CAPABILITY_V3_SUBMISSION_IDENTITY_MISMATCH");
    return result;
  }

  async status(attemptId: string): Promise<JobStatusResult> {
    const record = await this.dependencies.store.loadSubmitted(attemptId);
    if (!record) throw new Error("CAPABILITY_V3_ATTEMPT_NOT_FOUND");
    return this.dependencies.execution.status(record.providerTaskId);
  }

  async retain(attemptId: string) {
    const record = await this.dependencies.store.loadSubmitted(attemptId);
    if (!record) throw new Error("CAPABILITY_V3_ATTEMPT_NOT_FOUND");
    return this.dependencies.execution.retainFrozenArtifacts({
      promptId: record.providerTaskId,
      runId: record.attemptId,
      outputNodeId: record.outputNodeId,
      outputMediaKey: record.outputMediaKey,
    });
  }
}
