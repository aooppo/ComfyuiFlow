/** Immutable identity transmitted across the unique Worker → Adapter boundary. */
export interface FrozenGenerationAttemptInput {
  attemptId: string;
  adapterRef: { id: string; version: string };
  runtimeRef: { id: string; version: string };
  runtimeContractDigest: string;
  graphSha256: string;
}

export interface RetainedGenerationArtifact {
  mimeType: string;
  bytes: Uint8Array;
  providerReference?: Record<string, unknown>;
}

export interface CapabilityAdapter {
  readonly adapterRef: { id: string; version: string };
  readonly runtimeRef: { id: string; version: string };
  submit(input: FrozenGenerationAttemptInput): Promise<{ taskId: string }>;
  status(
    input: FrozenGenerationAttemptInput & { taskId: string },
  ): Promise<"PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN">;
  reconcile(
    input: FrozenGenerationAttemptInput & { taskId: string },
  ): Promise<"PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN">;
  retain(
    input: FrozenGenerationAttemptInput & { taskId: string },
  ): Promise<RetainedGenerationArtifact[]>;
  cancel(input: FrozenGenerationAttemptInput & { taskId: string }): Promise<{
    cancelled: boolean;
    remoteTerminationConfirmed: boolean;
  }>;
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, CapabilityAdapter>();

  constructor(adapters: readonly CapabilityAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: CapabilityAdapter) {
    const identity = this.key(adapter.adapterRef, adapter.runtimeRef);
    if (this.adapters.has(identity)) throw new Error(`DUPLICATE_ADAPTER_RUNTIME:${identity}`);
    this.adapters.set(identity, adapter);
    return this;
  }

  resolve(input: Pick<FrozenGenerationAttemptInput, "adapterRef" | "runtimeRef">) {
    const adapter = this.adapters.get(this.key(input.adapterRef, input.runtimeRef));
    if (!adapter)
      throw new Error(
        `ADAPTER_NOT_IMPLEMENTED:${input.adapterRef.id}@${input.adapterRef.version}:${input.runtimeRef.id}@${input.runtimeRef.version}`,
      );
    return adapter;
  }

  private key(
    adapterRef: { id: string; version: string },
    runtimeRef: { id: string; version: string },
  ) {
    return `${adapterRef.id}@${adapterRef.version}#${runtimeRef.id}@${runtimeRef.version}`;
  }
}

export interface MainlineMcpClient {
  callTool(name: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** The first production adapter. It transmits identity/digests only; MCP loads the frozen graph. */
export class ComfyUiMcpAdapter implements CapabilityAdapter {
  constructor(
    readonly adapterRef: { id: string; version: string },
    readonly runtimeRef: { id: string; version: string },
    private readonly mcp: MainlineMcpClient,
  ) {}

  async submit(input: FrozenGenerationAttemptInput) {
    const result = await this.mcp.callTool("submit_generation_attempt", { ...input });
    if (typeof result.taskId !== "string") throw new Error("SUBMISSION_AMBIGUOUS");
    return { taskId: result.taskId };
  }

  async status(input: FrozenGenerationAttemptInput & { taskId: string }) {
    return this.readStatus(input);
  }

  async reconcile(input: FrozenGenerationAttemptInput & { taskId: string }) {
    return this.readStatus(input);
  }

  async retain(input: FrozenGenerationAttemptInput & { taskId: string }) {
    const result = await this.mcp.callTool("retain_generation_artifacts", {
      attemptId: input.attemptId,
      taskId: input.taskId,
    });
    return Array.isArray(result.artifacts)
      ? (result.artifacts as RetainedGenerationArtifact[])
      : [];
  }

  async cancel() {
    return { cancelled: false, remoteTerminationConfirmed: false };
  }

  private async readStatus(input: FrozenGenerationAttemptInput & { taskId: string }) {
    const result = await this.mcp.callTool("get_generation_attempt_status", {
      attemptId: input.attemptId,
      taskId: input.taskId,
    });
    const state = String(result.status ?? "UNKNOWN").toUpperCase();
    if (state === "IN_PROGRESS") return "RUNNING" as const;
    if (["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "UNKNOWN"].includes(state))
      return state as "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN";
    return "UNKNOWN" as const;
  }
}
