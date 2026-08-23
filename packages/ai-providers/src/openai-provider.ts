import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AiProviderResultSchema,
  ShotSpecificationSchema,
  type AiTaskRequest,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export const OPENAI_DIRECTOR_MODEL = "gpt-5.4-2026-03-05";

function numericUsage(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number") result[key] = item;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export class OpenAiResponsesProvider implements AiModelProvider {
  constructor(private readonly client: OpenAI = new OpenAI()) {}

  getCapabilities(modelId: string) {
    return {
      providerId: "openai",
      modelId,
      inputModalities: ["text", "image"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
    };
  }

  async validateConfiguration() {
    return process.env.OPENAI_API_KEY
      ? { configured: true }
      : { configured: false, reason: "OPENAI_API_KEY is missing" };
  }

  async generateStructured(request: AiTaskRequest) {
    if (
      request.modelRef.providerId !== "openai" ||
      request.modelRef.modelId !== OPENAI_DIRECTOR_MODEL
    ) {
      throw new Error("OpenAI Director model is not registered");
    }
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
    const response = await this.client.responses.parse({
      model: OPENAI_DIRECTOR_MODEL,
      store: false,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Create exactly one continuous video shot from the character and scene references. " +
                "Preserve identity, wardrobe, scene layout, and lighting. Return only the required " +
                `structured fields. Creative intent: ${request.creativeDescription}`,
            },
            ...images,
          ],
        },
      ],
      text: { format: zodTextFormat(ShotSpecificationSchema, "shot_specification") },
    });
    const structuredOutput = ShotSpecificationSchema.parse(response.output_parsed);
    const usage = numericUsage(response.usage);
    return AiProviderResultSchema.parse({
      providerId: "openai",
      requestedModelId: request.modelRef.modelId,
      resolvedModelId: response.model ?? OPENAI_DIRECTOR_MODEL,
      responseId: response.id,
      structuredOutput,
      ...(usage ? { usage } : {}),
      finishReason: response.status ?? "unknown",
      providerMetadata: { store: false },
    });
  }
}
