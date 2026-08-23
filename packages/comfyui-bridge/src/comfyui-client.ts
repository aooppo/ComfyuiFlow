import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  ArtifactReferenceSchema,
  JobStatusResultSchema,
  type ArtifactReference,
  type JobStatusResult,
} from "@comfyuiflow/contracts";

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
    options: ComfyUiClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.fetchImplementation = options.fetch ?? fetch;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      return await this.fetchImplementation(`${this.baseUrl}${path}`, { ...init, signal });
    } catch (error) {
      throw new ComfyUiHttpError(
        `ComfyUI request failed: ${error instanceof Error ? error.name : "transport error"}`,
      );
    }
  }

  private async json(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.request(path, init);
    if (!response.ok) {
      throw new ComfyUiHttpError(
        `ComfyUI returned HTTP ${response.status}`,
        response.status,
        response.status === 400 ? "PROVIDER_VALIDATION" : "TRANSPORT",
      );
    }
    return response.json();
  }

  async getSystemStats(): Promise<Record<string, unknown>> {
    return (await this.json("/system_stats")) as Record<string, unknown>;
  }

  async getObjectInfo(): Promise<Record<string, unknown>> {
    return (await this.json("/object_info")) as Record<string, unknown>;
  }

  async listModels(folder: string): Promise<string[]> {
    const value = await this.json(`/models/${encodeURIComponent(folder)}`);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  async getQueue(): Promise<{ running: string[]; pending: string[] }> {
    const value = (await this.json("/queue")) as Record<string, unknown>;
    const ids = (items: unknown): string[] =>
      Array.isArray(items)
        ? items
            .map((item) =>
              Array.isArray(item) && typeof item[1] === "string" ? item[1] : undefined,
            )
            .filter((item): item is string => Boolean(item))
        : [];
    return { running: ids(value.queue_running), pending: ids(value.queue_pending) };
  }

  async stageInput(path: string): Promise<StagedInput> {
    const bytes = await readFile(path);
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(bytes)]), basename(path));
    form.append("type", "input");
    form.append("subfolder", "comfyuiflow");
    form.append("overwrite", "false");
    const value = (await this.json("/upload/image", { method: "POST", body: form })) as Record<
      string,
      unknown
    >;
    if (typeof value.name !== "string" || typeof value.subfolder !== "string") {
      throw new ComfyUiHttpError("ComfyUI upload response is invalid", 200, "PROVIDER_VALIDATION");
    }
    return { name: value.name, subfolder: value.subfolder, type: "input" };
  }

  async submitWorkflow(promptId: string, prompt: Record<string, unknown>): Promise<SubmitResult> {
    const value = (await this.json("/prompt", {
      method: "POST",
      headers: { "content-type": "application/json", "Comfy-Usage-Source": "comfyuiflow-spike" },
      body: JSON.stringify({ prompt_id: promptId, prompt }),
    })) as Record<string, unknown>;
    if (value.prompt_id !== promptId || typeof value.number !== "number") {
      throw new ComfyUiHttpError("ComfyUI submit response is invalid", 200, "PROVIDER_VALIDATION");
    }
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
    if (response.status === 404) {
      return JobStatusResultSchema.parse({
        promptId,
        status: "UNKNOWN",
        outputCount: 0,
        artifacts: [],
      });
    }
    if (!response.ok)
      throw new ComfyUiHttpError(`ComfyUI returned HTTP ${response.status}`, response.status);
    const value = (await response.json()) as Record<string, unknown>;
    const statusMap: Record<string, JobStatusResult["status"]> = {
      pending: "PENDING",
      in_progress: "IN_PROGRESS",
      completed: "COMPLETED",
      failed: "FAILED",
      cancelled: "CANCELLED",
    };
    const artifacts: ArtifactReference[] = [];
    const outputs = value.outputs;
    if (typeof outputs === "object" && outputs !== null) {
      for (const [nodeId, nodeValue] of Object.entries(outputs as Record<string, unknown>)) {
        if (typeof nodeValue !== "object" || nodeValue === null) continue;
        for (const [mediaKey, items] of Object.entries(nodeValue as Record<string, unknown>)) {
          if (!Array.isArray(items)) continue;
          for (const item of items) {
            const parsed = ArtifactReferenceSchema.safeParse({
              ...(typeof item === "object" && item !== null ? item : {}),
              nodeId,
              mediaKey,
            });
            if (parsed.success) artifacts.push(parsed.data);
          }
        }
      }
    }
    return JobStatusResultSchema.parse({
      promptId,
      status: statusMap[String(value.status)] ?? "UNKNOWN",
      createTime: value.create_time,
      executionStartTime: value.execution_start_time,
      executionEndTime: value.execution_end_time,
      outputCount: typeof value.outputs_count === "number" ? value.outputs_count : artifacts.length,
      error: value.execution_error,
      artifacts,
    });
  }

  async cancelJob(promptId: string): Promise<boolean> {
    const value = (await this.json(`/api/jobs/${encodeURIComponent(promptId)}/cancel`, {
      method: "POST",
    })) as Record<string, unknown>;
    return value.cancelled === true;
  }

  async downloadArtifact(reference: ArtifactReference): Promise<Response> {
    const query = new URLSearchParams({
      filename: reference.filename,
      subfolder: reference.subfolder,
      type: reference.type,
    });
    const response = await this.request(`/view?${query.toString()}`);
    if (!response.ok)
      throw new ComfyUiHttpError(`ComfyUI returned HTTP ${response.status}`, response.status);
    return response;
  }
}
