import { readFile } from "node:fs/promises";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AiProviderResultSchema,
  ShotSpecificationSchema,
  type AiTaskRequest,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export const CODEXMANAGER_LOCAL_PROVIDER_ID = "codexmanager-local";
export const CODEXMANAGER_LOCAL_BASE_URL = "http://127.0.0.1:48760/v1";
export const CODEXMANAGER_LOCAL_HEALTH_URL = "http://127.0.0.1:48760/health";
export const CODEXMANAGER_LOCAL_DIRECTOR_MODEL = "gpt-5.4";

interface CodexManagerLocalProviderOptions {
  environment?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  readinessTimeoutMs?: number;
}

interface GatewayResponseEnvelope {
  id?: unknown;
  model?: unknown;
  status?: unknown;
  usage?: unknown;
  output_text?: unknown;
  output?: unknown;
}

function numericUsage(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number") result[key] = item;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function requiredDurationSeconds(request: AiTaskRequest): number | undefined {
  const value = request.metadata.requiredDurationSeconds;
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 30) {
    throw new Error("requiredDurationSeconds metadata is invalid");
  }
  return value;
}

function outputTextFromEnvelope(response: GatewayResponseEnvelope): string | undefined {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return undefined;
  for (const item of response.output) {
    if (typeof item !== "object" || item === null || !("content" in item)) continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
    }
  }
  return undefined;
}

function parseSseResponse(body: string): {
  response: GatewayResponseEnvelope;
  outputText: string;
} {
  let completedResponse: GatewayResponseEnvelope | undefined;
  let outputText: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (typeof event !== "object" || event === null || !("type" in event)) continue;
    if (
      event.type === "response.output_text.done" &&
      "text" in event &&
      typeof event.text === "string"
    ) {
      outputText = event.text;
    }
    if (
      event.type === "response.completed" &&
      "response" in event &&
      typeof event.response === "object" &&
      event.response !== null
    ) {
      completedResponse = event.response;
    }
  }
  if (!completedResponse || outputText === undefined) {
    throw new Error("CodexManager local SSE response is incomplete");
  }
  return { response: completedResponse, outputText };
}

export class CodexManagerLocalProvider implements AiModelProvider {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly readinessTimeoutMs: number;

  constructor(options: CodexManagerLocalProviderOptions = {}) {
    this.environment = options.environment ?? process.env;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 2_000;
  }

  getCapabilities(modelId: string) {
    return {
      providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
      modelId,
      inputModalities: ["text", "image"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
    };
  }

  async validateConfiguration() {
    if (!this.environment.CODEX_MANAGER_API_KEY) {
      return { configured: false, reason: "CODEX_MANAGER_API_KEY is missing" };
    }
    try {
      const response = await this.fetchImplementation(CODEXMANAGER_LOCAL_HEALTH_URL, {
        method: "GET",
        signal: AbortSignal.timeout(this.readinessTimeoutMs),
      });
      if (!response.ok) {
        return { configured: false, reason: "CodexManager local gateway is unhealthy" };
      }
      return { configured: true };
    } catch {
      return { configured: false, reason: "CodexManager local gateway is unreachable" };
    }
  }

  async generateStructured(request: AiTaskRequest) {
    if (
      request.modelRef.providerId !== CODEXMANAGER_LOCAL_PROVIDER_ID ||
      request.modelRef.modelId !== CODEXMANAGER_LOCAL_DIRECTOR_MODEL
    ) {
      throw new Error("CodexManager local Director model is not registered");
    }
    const requiredDuration = requiredDurationSeconds(request);
    const images = await Promise.all(
      request.imageInputs.map(async (asset) => {
        const bytes = await readFile(asset.storedPath);
        return {
          type: "input_image" as const,
          image_url: `data:${asset.mimeType};base64,${bytes.toString("base64")}`,
          detail: "high" as const,
        };
      }),
    );
    const apiKey = this.environment.CODEX_MANAGER_API_KEY;
    if (!apiKey) throw new Error("CODEX_MANAGER_API_KEY is missing");
    const gatewayResponse = await this.fetchImplementation(
      `${CODEXMANAGER_LOCAL_BASE_URL}/responses`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
          store: false,
          stream: false,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Create exactly one continuous video shot from the character and scene references. " +
                    "Preserve identity, wardrobe, scene layout, and lighting. Return only the required structured fields. " +
                    (requiredDuration === undefined
                      ? ""
                      : `Set durationSeconds exactly to ${requiredDuration}. `) +
                    `Creative intent: ${request.creativeDescription}`,
                },
                ...images,
              ],
            },
          ],
          text: { format: zodTextFormat(ShotSpecificationSchema, "shot_specification") },
        }),
      },
    );
    if (!gatewayResponse.ok) {
      throw new Error(`CodexManager local request failed with status ${gatewayResponse.status}`);
    }
    const contentType = gatewayResponse.headers.get("content-type")?.toLowerCase() ?? "";
    let response: GatewayResponseEnvelope;
    let outputText: string | undefined;
    if (contentType.includes("text/event-stream")) {
      const parsed = parseSseResponse(await gatewayResponse.text());
      response = parsed.response;
      outputText = parsed.outputText;
    } else {
      response = (await gatewayResponse.json()) as GatewayResponseEnvelope;
      outputText = outputTextFromEnvelope(response);
    }
    if (!outputText) throw new Error("CodexManager local response has no structured output");
    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(outputText);
    } catch {
      throw new Error("CodexManager local structured output is invalid JSON");
    }
    const structuredOutput = ShotSpecificationSchema.parse(parsedOutput);
    if (
      requiredDuration !== undefined &&
      Math.abs(structuredOutput.durationSeconds - requiredDuration) > Number.EPSILON
    ) {
      throw new Error("Structured output does not match the selected workflow duration");
    }
    const usage = numericUsage(response.usage);
    return AiProviderResultSchema.parse({
      providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
      requestedModelId: request.modelRef.modelId,
      resolvedModelId:
        typeof response.model === "string" ? response.model : CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      responseId: typeof response.id === "string" ? response.id : undefined,
      structuredOutput,
      ...(usage ? { usage } : {}),
      finishReason: typeof response.status === "string" ? response.status : "unknown",
      providerMetadata: {
        gateway: "loopback",
        responseTransport: contentType.includes("text/event-stream") ? "sse" : "json",
        store: false,
      },
    });
  }
}
