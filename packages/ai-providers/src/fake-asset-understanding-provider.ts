import { randomUUID } from "node:crypto";
import {
  type AiProviderResult,
  type AiTaskRequest,
  AssetUnderstandingProviderResultSchema,
  type AssetUnderstandingProviderRequest,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export class FakeAssetUnderstandingProvider implements AiModelProvider {
  calls = 0;

  constructor(private readonly mode: "SUCCESS" | "INVALID" | "AMBIGUOUS" = "SUCCESS") {}

  getCapabilities(modelId: string) {
    return {
      providerId: "fake",
      modelId,
      inputModalities: ["text", "image"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
    };
  }

  async validateConfiguration() {
    return { configured: true };
  }

  async generateStructured(request: AiTaskRequest): Promise<AiProviderResult> {
    void request;
    throw new Error("Fake asset understanding provider does not implement storyboard generation");
  }

  async understandAssets(request: AssetUnderstandingProviderRequest) {
    this.calls += 1;
    if (this.mode === "AMBIGUOUS") throw new Error("Fake provider lost completion signal");
    const images = this.mode === "INVALID" ? request.images.slice(0, 1) : request.images;
    return AssetUnderstandingProviderResultSchema.parse({
      providerId: "fake",
      requestedModelId: request.modelRef.modelId,
      resolvedModelId: request.modelRef.modelId,
      responseId: `fake:${randomUUID()}`,
      results: images.map((image) => ({
        slot: image.slot,
        facts: {
          summary: "A verified source image suitable for owner review.",
          directObservations: ["Image bytes were supplied by the verified local storage provider."],
          uncertainInterpretations: [],
          subjectTypeSuggestions: [],
          referenceUsageSuggestions: [],
          confidence: "LOW",
        },
      })),
      providerMetadata: { dryRun: true, providerCalls: 0 },
    });
  }
}
