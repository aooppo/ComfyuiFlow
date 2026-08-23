import { randomUUID } from "node:crypto";
import { AiProviderResultSchema, type AiTaskRequest } from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export class DryRunDirectorProvider implements AiModelProvider {
  getCapabilities(modelId: string) {
    return {
      providerId: "dry-run",
      modelId,
      inputModalities: ["text", "image"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
    };
  }

  async validateConfiguration() {
    return { configured: true };
  }

  async generateStructured(request: AiTaskRequest) {
    const directorRunId = randomUUID();
    return AiProviderResultSchema.parse({
      providerId: "dry-run",
      requestedModelId: request.modelRef.modelId,
      resolvedModelId: request.modelRef.modelId,
      responseId: `dry-run:${directorRunId}`,
      structuredOutput: {
        id: randomUUID(),
        schemaVersion: "1.0.0",
        promptTemplateVersion: "director-one-shot-v1",
        creativeDescription: request.creativeDescription,
        startState: "Character and scene match the supplied reference images.",
        action: request.creativeDescription,
        endState: "The action resolves while character and scene identity remain stable.",
        camera: "Single continuous medium shot; no cut.",
        composition: "Keep the main character legible within the supplied scene.",
        continuityRequirements: [
          "Preserve character identity and wardrobe.",
          "Preserve scene layout and lighting direction.",
        ],
        durationSeconds: 2,
        directorRunId,
      },
      providerMetadata: { dryRun: true, providerCalls: 0 },
    });
  }
}
