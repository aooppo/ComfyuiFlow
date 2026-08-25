import { createHash, randomUUID } from "node:crypto";
import {
  StoryboardGenerationRequestV1Schema,
  StoryboardProposalV1Schema,
  type AiProviderResult,
  type AiTaskRequest,
  type StoryboardGenerationRequestV1,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export const FAKE_STORYBOARD_MODEL_ID = "storyboard-fake-v1";

export class FakeStoryboardProvider implements AiModelProvider {
  getCapabilities(modelId: string) {
    return {
      providerId: "fake",
      modelId,
      inputModalities: ["text"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
      storyboardGeneration: {
        contractVersions: ["storyboard-generation-v1"],
        promptTemplateVersions: ["storyboard-three-shot-v1"],
        supportedShotCounts: [3],
      },
    };
  }

  async validateConfiguration() {
    return { configured: true };
  }

  async generateStructured(request: AiTaskRequest): Promise<AiProviderResult> {
    void request;
    throw new Error("Fake Storyboard Provider does not implement legacy one-shot generation");
  }

  async generateStoryboard(rawRequest: StoryboardGenerationRequestV1) {
    const request = StoryboardGenerationRequestV1Schema.parse(rawRequest);
    if (
      request.modelRef.providerId !== "fake" ||
      request.modelRef.modelId !== FAKE_STORYBOARD_MODEL_ID
    ) {
      throw new Error("Fake Storyboard model is not registered");
    }

    const continuityRequirements = [
      "Preserve character identity, wardrobe, and carried items across all three shots.",
      "Preserve scene layout, lighting direction, and product appearance across every cut.",
    ];
    const stages = [
      {
        title: "Establish",
        creativeDescription: `Introduce the setting, subject, and visual goal: ${request.creativeBrief}`,
        startState: "The subject, product, and environment are clearly established and still.",
        action: "The subject enters the composition and directs attention toward the product.",
        endState: "The subject and product share a clear visual relationship.",
        camera: "Stable medium-wide portrait establishing shot with restrained movement.",
        composition: "Keep the subject and product legible with space for the action to develop.",
      },
      {
        title: "Reveal",
        creativeDescription: `Develop the central product action from the brief: ${request.creativeBrief}`,
        startState: "Continue exactly from the established subject, wardrobe, product, and scene.",
        action: "The subject demonstrates or reveals the product's defining visual quality.",
        endState: "The defining product detail is visible and understood.",
        camera: "Controlled medium portrait shot with a gentle push toward the key action.",
        composition: "Prioritize hands, expression, and product detail without losing identity.",
      },
      {
        title: "Resolve",
        creativeDescription: `Resolve the story with a confident final image: ${request.creativeBrief}`,
        startState: "Begin from the completed reveal with all continuity details unchanged.",
        action: "The subject settles into a final pose that presents the product naturally.",
        endState: "Hold a clean, memorable hero composition of the subject and product.",
        camera: "Settle into a stable medium-full portrait hero shot.",
        composition: "Balance subject and product as co-primary elements with a calm finish.",
      },
    ] as const;

    return StoryboardProposalV1Schema.parse({
      providerId: "fake",
      requestedModelId: request.modelRef.modelId,
      resolvedModelId: FAKE_STORYBOARD_MODEL_ID,
      responseId: `fake-storyboard:${randomUUID()}`,
      contractVersion: "storyboard-proposal-v1",
      promptTemplateVersion: request.promptTemplateVersion,
      shots: stages.map((stage, index) => ({
        schemaVersion: "shot-draft-v1",
        shotKey: deterministicUuid(
          `${request.contractVersion}:${request.promptTemplateVersion}:${request.projectId}:${request.storyboardId}:${request.creativeBrief}:${index + 1}`,
        ),
        ordinal: index + 1,
        ...stage,
        continuityRequirements,
        durationSeconds: 2,
        assetRequirements: request.assetRequirements.filter(
          (requirement) => requirement.shotOrdinal === index + 1,
        ),
      })),
      providerMetadata: { fake: true, providerCalls: 0 },
    });
  }
}

function deterministicUuid(input: string) {
  const bytes = Buffer.from(createHash("sha256").update(input).digest("hex").slice(0, 32), "hex");
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
