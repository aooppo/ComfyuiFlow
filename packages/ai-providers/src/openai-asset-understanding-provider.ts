import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  type AiProviderResult,
  type AiTaskRequest,
  AssetUnderstandingProviderResultSchema,
  type AssetUnderstandingProviderRequest,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export const OPENAI_ASSET_UNDERSTANDING_MODEL = "gpt-5.4-2026-03-05";

export class OpenAiAssetUnderstandingProvider implements AiModelProvider {
  constructor(private readonly client: OpenAI = new OpenAI({ maxRetries: 0, timeout: 30_000 })) {}

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

  async generateStructured(request: AiTaskRequest): Promise<AiProviderResult> {
    void request;
    throw new Error("OpenAI asset understanding provider does not implement storyboard generation");
  }

  async understandAssets(request: AssetUnderstandingProviderRequest) {
    if (
      request.modelRef.providerId !== "openai" ||
      request.modelRef.modelId !== OPENAI_ASSET_UNDERSTANDING_MODEL
    ) {
      throw new Error("OpenAI asset understanding model is not registered");
    }
    const response = await this.client.responses.parse({
      model: OPENAI_ASSET_UNDERSTANDING_MODEL,
      store: false,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Return JSON only. Describe each anonymous image slot with direct observations and clearly separate uncertainty. Do not identify database records.",
            },
            ...request.images.map((image) => ({
              type: "input_image" as const,
              image_url: `data:${image.mimeType};base64,${Buffer.from(image.content).toString("base64")}`,
              detail: "high" as const,
            })),
          ],
        },
      ],
      text: {
        format: zodTextFormat(
          AssetUnderstandingProviderResultSchema.omit({
            providerId: true,
            requestedModelId: true,
            resolvedModelId: true,
            responseId: true,
            usage: true,
            finishReason: true,
            providerMetadata: true,
          }),
          "asset_understanding",
        ),
      },
    });
    return AssetUnderstandingProviderResultSchema.parse({
      providerId: "openai",
      requestedModelId: request.modelRef.modelId,
      resolvedModelId: response.model ?? OPENAI_ASSET_UNDERSTANDING_MODEL,
      responseId: response.id,
      ...(response.output_parsed ?? {}),
      providerMetadata: { store: false },
    });
  }
}
