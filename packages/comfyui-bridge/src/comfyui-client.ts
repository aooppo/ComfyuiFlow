import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface ArtifactReference {
  filename: string;
  subfolder: string;
  type: string;
  nodeId: string;
  mediaKey: string;
}
export interface JobStatusResult {
  promptId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN";
  outputCount: number;
  artifacts: ArtifactReference[];
  createTime?: unknown;
  executionStartTime?: unknown;
  executionEndTime?: unknown;
  error?: unknown;
}

export class ComfyUiHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly classification: "TRANSPORT" | "PROVIDER_VALIDATION" | "PROVIDER_FAILED" = "TRANSPORT",
  ) {
    super(message);
  }
}

export interface ComfyUiClientOptions {
  timeoutMs?: number;
  fetch?: typeof fetch;
  comfyOrgApiKey?: string;
  comfyOrgAuthToken?: string;
}
export interface StagedInput {
  name: string;
  subfolder: string;
  type: "input";
}
export interface SubmitResult {
  promptId: string;
  queueNumber: number;
  nodeErrors: Record<string, unknown>;
}

export class ComfyUiClient {
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;
  constructor(
    readonly baseUrl: string,
    private readonly options: ComfyUiClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.fetchImplementation = options.fetch ?? fetch;
  }
  hasComfyOrgCredential() {
    return Boolean(this.options.comfyOrgAuthToken || this.options.comfyOrgApiKey);
  }
  private async request(path: string, init: RequestInit = {}) {
    try {
      return await this.fetchImplementation(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new ComfyUiHttpError(
        `ComfyUI request failed: ${error instanceof Error ? error.name : "transport error"}`,
      );
    }
  }
  private async json(path: string, init: RequestInit = {}) {
    const response = await this.request(path, init);
    if (!response.ok)
      throw new ComfyUiHttpError(
        `ComfyUI returned HTTP ${response.status}`,
        response.status,
        response.status === 400 ? "PROVIDER_VALIDATION" : "TRANSPORT",
      );
    return response.json();
  }
  async getObjectInfo(): Promise<Record<string, unknown>> {
    return (await this.json("/object_info")) as Record<string, unknown>;
  }
  async getSystemStats(): Promise<Record<string, unknown>> {
    return (await this.json("/system_stats")) as Record<string, unknown>;
  }
  async stageInput(path: string): Promise<StagedInput> {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(await readFile(path))]), basename(path));
    form.append("type", "input");
    form.append("subfolder", "comfyuiflow/staged");
    form.append("overwrite", "false");
    const value = (await this.json("/upload/image", { method: "POST", body: form })) as Record<
      string,
      unknown
    >;
    if (typeof value.name !== "string" || typeof value.subfolder !== "string")
      throw new ComfyUiHttpError("ComfyUI upload response is invalid", 200, "PROVIDER_VALIDATION");
    return { name: value.name, subfolder: value.subfolder, type: "input" };
  }
  async submitWorkflow(
    promptId: string,
    prompt: Readonly<Record<string, unknown>>,
  ): Promise<SubmitResult> {
    const value = (await this.json("/prompt", {
      method: "POST",
      headers: { "content-type": "application/json", "Comfy-Usage-Source": "comfyuiflow" },
      body: JSON.stringify({
        prompt_id: promptId,
        prompt,
        extra_data: {
          ...(this.options.comfyOrgAuthToken
            ? { auth_token_comfy_org: this.options.comfyOrgAuthToken }
            : this.options.comfyOrgApiKey
              ? { api_key_comfy_org: this.options.comfyOrgApiKey }
              : {}),
          comfy_usage_source: "comfyuiflow",
        },
      }),
    })) as Record<string, unknown>;
    if (value.prompt_id !== promptId || typeof value.number !== "number")
      throw new ComfyUiHttpError("ComfyUI submit response is invalid", 200, "PROVIDER_VALIDATION");
    return {
      promptId,
      queueNumber: value.number,
      nodeErrors:
        typeof value.node_errors === "object" && value.node_errors !== null
          ? (value.node_errors as Record<string, unknown>)
          : {},
    };
  }
  async getJobStatus(promptId: string): Promise<JobStatusResult> {
    const response = await this.request(`/api/jobs/${encodeURIComponent(promptId)}`);
    if (response.status === 404)
      return { promptId, status: "UNKNOWN", outputCount: 0, artifacts: [] };
    if (!response.ok)
      throw new ComfyUiHttpError(`ComfyUI returned HTTP ${response.status}`, response.status);
    const value = (await response.json()) as Record<string, unknown>;
    const map: Record<string, JobStatusResult["status"]> = {
      pending: "PENDING",
      in_progress: "IN_PROGRESS",
      completed: "COMPLETED",
      failed: "FAILED",
      cancelled: "CANCELLED",
    };
    const artifacts: ArtifactReference[] = [];
    if (value.outputs && typeof value.outputs === "object")
      for (const [nodeId, node] of Object.entries(value.outputs as Record<string, unknown>))
        if (node && typeof node === "object")
          for (const [mediaKey, items] of Object.entries(node as Record<string, unknown>))
            if (Array.isArray(items))
              for (const item of items) {
                const x = item as Record<string, unknown>;
                if (
                  typeof x.filename === "string" &&
                  typeof x.subfolder === "string" &&
                  typeof x.type === "string"
                )
                  artifacts.push({
                    filename: x.filename,
                    subfolder: x.subfolder,
                    type: x.type,
                    nodeId,
                    mediaKey,
                  });
              }
    return {
      promptId,
      status: map[String(value.status)] ?? "UNKNOWN",
      outputCount: typeof value.outputs_count === "number" ? value.outputs_count : artifacts.length,
      artifacts,
      createTime: value.create_time,
      executionStartTime: value.execution_start_time,
      executionEndTime: value.execution_end_time,
      error: value.execution_error,
    };
  }
}
