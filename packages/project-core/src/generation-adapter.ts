import type { GenerationExecutionSlotV1 } from "@comfyuiflow/contracts";
import type { GenerationProvider, RetainedProviderArtifact } from "./generation-provider.js";

export type GenerationAdapterErrorCode =
  "ADAPTER_NOT_IMPLEMENTED" | "PRE_DISPATCH_BLOCKED" | "PROVIDER_REJECTED" | "SUBMISSION_AMBIGUOUS";

export class GenerationAdapterError extends Error {
  readonly ambiguous: boolean;

  constructor(
    readonly code: GenerationAdapterErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${code}: ${message}`, options);
    this.name = "GenerationAdapterError";
    this.ambiguous = code === "SUBMISSION_AMBIGUOUS";
  }
}

export interface LegacyGenerationAdapterPlan {
  engineVersion: "LEGACY_V1";
  workflowId: string;
  compiledPrompt: string;
  slots: GenerationExecutionSlotV1[];
}

export interface WorkflowAgentGenerationAdapterPlan {
  engineVersion: "WORKFLOW_AGENT_V1";
  executionPlanId: string;
  executionPlanSha256: string;
  authorizationConsumptionId: string;
  payload: Readonly<Record<string, unknown>>;
}

export type GenerationAdapterPlan =
  LegacyGenerationAdapterPlan | WorkflowAgentGenerationAdapterPlan;

export interface GenerationAdapterSubmission {
  jobId: string;
  providerIdempotencyKey: string;
  plan: GenerationAdapterPlan;
}

export interface GenerationAdapter {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly executorType: "COMFYUI_GRAPH" | "DIRECT_PROVIDER_API";
  getCapabilities(): Promise<Readonly<Record<string, unknown>>>;
  checkReadiness(): Promise<{ ready: boolean; blockers: string[] }>;
  estimateCost(plan: GenerationAdapterPlan): Promise<{
    currency: string;
    estimatedCostMicros: number;
    maximumCostMicros: number;
  } | null>;
  compileExecutionPlan(input: unknown): Promise<GenerationAdapterPlan>;
  submit(input: GenerationAdapterSubmission): Promise<{ taskId: string }>;
  getStatus(
    taskId: string,
  ): Promise<"PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN">;
  retainArtifacts(taskId: string, jobId: string): Promise<RetainedProviderArtifact[]>;
  cancel(taskId: string): Promise<{ cancelled: boolean; remoteTerminationConfirmed: boolean }>;
}

export type GenerationAdapterIdentity = Pick<
  GenerationAdapter,
  "adapterId" | "adapterVersion" | "executorType"
>;

export class GenerationAdapterRegistry {
  private readonly adapters = new Map<string, GenerationAdapter>();
  private readonly identities = new Map<string, GenerationAdapterIdentity>();

  constructor(adapters: GenerationAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: GenerationAdapter) {
    const key = this.key(adapter.adapterId, adapter.adapterVersion);
    if (this.adapters.has(key)) throw new Error(`Duplicate generation adapter: ${key}`);
    this.adapters.set(key, adapter);
    this.identities.set(key, adapter);
    return this;
  }

  registerIdentity(identity: GenerationAdapterIdentity) {
    const key = this.key(identity.adapterId, identity.adapterVersion);
    const existing = this.identities.get(key);
    if (existing && existing.executorType !== identity.executorType)
      throw new Error(`Conflicting generation adapter identity: ${key}`);
    this.identities.set(key, Object.freeze({ ...identity }));
    return this;
  }

  resolveIdentity(adapterId: string, adapterVersion: string): GenerationAdapterIdentity {
    const identity = this.identities.get(this.key(adapterId, adapterVersion));
    if (!identity) {
      throw new GenerationAdapterError(
        "ADAPTER_NOT_IMPLEMENTED",
        `No registered adapter matches ${adapterId}@${adapterVersion}`,
      );
    }
    return identity;
  }

  resolve(adapterId: string, adapterVersion: string): GenerationAdapter {
    const adapter = this.adapters.get(this.key(adapterId, adapterVersion));
    if (!adapter) {
      throw new GenerationAdapterError(
        "ADAPTER_NOT_IMPLEMENTED",
        `No registered adapter matches ${adapterId}@${adapterVersion}`,
      );
    }
    return adapter;
  }

  private key(adapterId: string, adapterVersion: string) {
    return `${adapterId}@${adapterVersion}`;
  }
}

export class LegacyGenerationProviderAdapter implements GenerationAdapter {
  readonly adapterId: string;
  readonly adapterVersion = "1.0.0";
  readonly executorType = "COMFYUI_GRAPH" as const;

  constructor(private readonly provider: GenerationProvider) {
    this.adapterId = `legacy-${provider.profileId}`;
  }

  async getCapabilities() {
    return { profileId: this.provider.profileId, engineVersion: "LEGACY_V1" };
  }

  async checkReadiness() {
    return this.provider.preflight();
  }

  async estimateCost() {
    return null;
  }

  async compileExecutionPlan(input: unknown): Promise<LegacyGenerationAdapterPlan> {
    const plan = input as LegacyGenerationAdapterPlan;
    if (plan?.engineVersion !== "LEGACY_V1") {
      throw new GenerationAdapterError("PRE_DISPATCH_BLOCKED", "Legacy plan is required");
    }
    return plan;
  }

  async submit(input: GenerationAdapterSubmission) {
    if (input.plan.engineVersion !== "LEGACY_V1") {
      throw new GenerationAdapterError("PRE_DISPATCH_BLOCKED", "Legacy plan is required");
    }
    try {
      return await this.provider.submit({
        jobId: input.jobId,
        promptId: input.providerIdempotencyKey,
        workflowId: input.plan.workflowId,
        compiledPrompt: input.plan.compiledPrompt,
        slots: input.plan.slots,
      });
    } catch (error) {
      if (error instanceof GenerationAdapterError) throw error;
      throw new GenerationAdapterError(
        "SUBMISSION_AMBIGUOUS",
        "Legacy submission result is unknown",
        {
          cause: error,
        },
      );
    }
  }

  getStatus(taskId: string) {
    return this.provider.status(taskId);
  }

  retainArtifacts(taskId: string, jobId: string) {
    return this.provider.retainArtifacts(taskId, jobId);
  }

  cancel(taskId: string) {
    return this.provider.cancel(taskId);
  }
}

export class GenerationProviderWorkflowAdapter implements GenerationAdapter {
  constructor(
    readonly adapterId: string,
    readonly adapterVersion: string,
    readonly executorType: "COMFYUI_GRAPH" | "DIRECT_PROVIDER_API",
    private readonly provider: GenerationProvider,
  ) {}

  async getCapabilities() {
    return { profileId: this.provider.profileId, engineVersion: "WORKFLOW_AGENT_V1" };
  }

  checkReadiness() {
    return this.provider.preflight();
  }

  async estimateCost(plan: GenerationAdapterPlan) {
    if (plan.engineVersion !== "WORKFLOW_AGENT_V1") return null;
    const pricing = plan.payload.pricing;
    if (!pricing || typeof pricing !== "object") return null;
    const value = pricing as Record<string, unknown>;
    if (typeof value.currency !== "string" || !Number.isSafeInteger(value.estimatedCostMicros))
      return null;
    return {
      currency: value.currency,
      estimatedCostMicros: value.estimatedCostMicros as number,
      maximumCostMicros: value.estimatedCostMicros as number,
    };
  }

  async compileExecutionPlan(input: unknown): Promise<WorkflowAgentGenerationAdapterPlan> {
    const plan = input as WorkflowAgentGenerationAdapterPlan;
    if (
      plan?.engineVersion !== "WORKFLOW_AGENT_V1" ||
      !plan.executionPlanId ||
      !plan.executionPlanSha256 ||
      !plan.payload
    ) {
      throw new GenerationAdapterError(
        "PRE_DISPATCH_BLOCKED",
        "A frozen Workflow Agent plan is required",
      );
    }
    const payload = plan.payload;
    if (
      typeof payload.workflowId !== "string" ||
      typeof payload.compiledPrompt !== "string" ||
      !Array.isArray(payload.slots)
    ) {
      throw new GenerationAdapterError(
        "PRE_DISPATCH_BLOCKED",
        "The registered provider payload is incomplete",
      );
    }
    return plan;
  }

  async submit(input: GenerationAdapterSubmission) {
    if (input.plan.engineVersion !== "WORKFLOW_AGENT_V1")
      throw new GenerationAdapterError("PRE_DISPATCH_BLOCKED", "A Workflow Agent plan is required");
    const payload = input.plan.payload;
    try {
      return await this.provider.submit({
        jobId: input.jobId,
        promptId: input.providerIdempotencyKey,
        workflowId: String(payload.workflowId),
        compiledPrompt: String(payload.compiledPrompt),
        slots: payload.slots as GenerationExecutionSlotV1[],
      });
    } catch (error) {
      if (error instanceof GenerationAdapterError) throw error;
      throw new GenerationAdapterError(
        "SUBMISSION_AMBIGUOUS",
        "Provider submission result is unknown",
        { cause: error },
      );
    }
  }

  getStatus(taskId: string) {
    return this.provider.status(taskId);
  }
  retainArtifacts(taskId: string, jobId: string) {
    return this.provider.retainArtifacts(taskId, jobId);
  }
  cancel(taskId: string) {
    return this.provider.cancel(taskId);
  }
}

export interface ExecutionPlanMcpClient {
  callTool(name: string, input: Record<string, unknown>): Promise<any>;
}

export class ComfyUiExecutionPlanAdapter implements GenerationAdapter {
  readonly executorType = "COMFYUI_GRAPH" as const;

  constructor(
    readonly adapterId: string,
    readonly adapterVersion: string,
    private readonly mcp: ExecutionPlanMcpClient,
  ) {}

  async getCapabilities() {
    return { engineVersion: "WORKFLOW_AGENT_V1", submissionMode: "FROZEN_PLAN_IDENTITY" };
  }

  async checkReadiness() {
    const result = await this.mcp.callTool("comfyui_check_graph_readiness", {
      adapterId: this.adapterId,
      adapterVersion: this.adapterVersion,
    });
    return {
      ready: result?.ready === true,
      blockers: Array.isArray(result?.blockers)
        ? result.blockers.map(String)
        : ["WORKFLOW_NOT_READY"],
    };
  }

  async estimateCost(plan: GenerationAdapterPlan) {
    if (plan.engineVersion !== "WORKFLOW_AGENT_V1") return null;
    const pricing = plan.payload.pricing as Record<string, unknown> | undefined;
    if (
      !pricing ||
      typeof pricing.currency !== "string" ||
      !Number.isSafeInteger(pricing.estimatedCostMicros)
    )
      return null;
    return {
      currency: pricing.currency,
      estimatedCostMicros: pricing.estimatedCostMicros as number,
      maximumCostMicros: pricing.estimatedCostMicros as number,
    };
  }

  async compileExecutionPlan(input: unknown): Promise<WorkflowAgentGenerationAdapterPlan> {
    const plan = input as WorkflowAgentGenerationAdapterPlan;
    const snapshot = plan?.payload?.executionInputSnapshot as Record<string, unknown> | undefined;
    if (
      plan?.engineVersion !== "WORKFLOW_AGENT_V1" ||
      !plan.executionPlanId ||
      !plan.executionPlanSha256 ||
      !snapshot ||
      typeof snapshot.materializedExecutionSha256 !== "string"
    )
      throw new GenerationAdapterError(
        "PRE_DISPATCH_BLOCKED",
        "A materialized frozen execution plan is required",
      );
    return plan;
  }

  async submit(input: GenerationAdapterSubmission) {
    if (input.plan.engineVersion !== "WORKFLOW_AGENT_V1") {
      throw new GenerationAdapterError("PRE_DISPATCH_BLOCKED", "A Workflow Agent plan is required");
    }
    const snapshot = input.plan.payload.executionInputSnapshot as
      Record<string, unknown> | undefined;
    try {
      const result = await this.mcp.callTool("comfyui_submit_execution_plan", {
        executionPlanId: input.plan.executionPlanId,
        executionPlanSha256: input.plan.executionPlanSha256,
        generationJobId: input.jobId,
        authorizationConsumptionId: input.plan.authorizationConsumptionId,
        materializedExecutionSha256: snapshot?.materializedExecutionSha256,
      });
      const promptId = result?.promptId;
      if (typeof promptId !== "string" || promptId !== input.providerIdempotencyKey) {
        throw new GenerationAdapterError(
          "SUBMISSION_AMBIGUOUS",
          "Execution plan submission identity is unknown",
        );
      }
      return { taskId: promptId };
    } catch (error) {
      if (error instanceof GenerationAdapterError) throw error;
      throw new GenerationAdapterError(
        "SUBMISSION_AMBIGUOUS",
        "Execution plan submission result is unknown",
        { cause: error },
      );
    }
  }

  async getStatus(taskId: string) {
    const result = await this.mcp.callTool("comfyui_get_job_status", { promptId: taskId });
    const status = String(result?.status ?? "UNKNOWN");
    if (status === "IN_PROGRESS") return "RUNNING" as const;
    if (["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "UNKNOWN"].includes(status)) {
      return status as "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN";
    }
    return "UNKNOWN" as const;
  }

  async retainArtifacts(_taskId: string, jobId: string): Promise<RetainedProviderArtifact[]> {
    const result = await this.mcp.callTool("comfyui_retain_execution_plan_artifacts", {
      generationJobId: jobId,
    });
    const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
    const { readFile } = await import("node:fs/promises");
    return Promise.all(
      artifacts.map(async (artifact: Record<string, unknown>) => ({
        mimeType: "video/mp4" as const,
        bytes: new Uint8Array(await readFile(String(artifact.path))),
        providerReference: { sha256: artifact.sha256 },
      })),
    );
  }

  async cancel(taskId: string) {
    const result = await this.mcp.callTool("comfyui_cancel_job", { promptId: taskId });
    return {
      cancelled: result?.cancelled === true,
      remoteTerminationConfirmed: result?.cancelled === true,
    };
  }
}
