import { createHash, randomUUID } from "node:crypto";
import {
  StoryboardGenerationRequestV1Schema,
  StoryboardProposalV1Schema,
  StoryboardGenerationRequestV2Schema,
  StoryboardProposalV2Schema,
  type AiProviderResult,
  type AiTaskRequest,
  type StoryboardGenerationRequestV1,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";

export const FAKE_STORYBOARD_MODEL_ID = "storyboard-fake-v1";
export const FAKE_STORYBOARD_V2_MODEL_ID = "fake-storyboard-v2";

export class FakeStoryboardProvider implements AiModelProvider {
  getCapabilities(modelId: string) {
    const v2 = modelId === FAKE_STORYBOARD_V2_MODEL_ID;
    return {
      providerId: "fake",
      modelId,
      inputModalities: ["text"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
      storyboardGeneration: {
        contractVersions: v2 ? ["storyboard-generation-v2"] : ["storyboard-generation-v1"],
        promptTemplateVersions: v2 ? ["storyboard-director-v2"] : ["storyboard-three-shot-v1"],
        supportedShotCounts: v2 ? [] : [3],
        ...(v2 ? { maxShotCount: 20 } : {}),
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

  async generateStoryboardV2(rawRequest: unknown) {
    const request = StoryboardGenerationRequestV2Schema.parse(rawRequest);
    if (
      request.modelRef.providerId !== "fake" ||
      request.modelRef.modelId !== FAKE_STORYBOARD_V2_MODEL_ID
    ) {
      throw new Error("Fake Storyboard V2 model is not registered");
    }
    const count = Math.min(3, request.maxShotCount);
    const references = request.references.map((reference) => reference.alias);
    return StoryboardProposalV2Schema.parse({
      providerId: "fake",
      requestedModelId: request.modelRef.modelId,
      resolvedModelId: FAKE_STORYBOARD_V2_MODEL_ID,
      responseId: `fake-storyboard-v2:${createHash("sha256").update(JSON.stringify(request)).digest("hex").slice(0, 24)}`,
      contractVersion: "storyboard-proposal-v2",
      promptTemplateVersion: "storyboard-director-v2",
      narrativeSummary: `围绕“${request.creativeBrief}”建立、发展并收束一条连续视觉叙事。`,
      shots: Array.from({ length: count }, (_, index) => ({
        ordinal: index + 1,
        title: ["建立", "展开", "收束"][index] ?? `镜头 ${index + 1}`,
        creativeDescription: `${request.creativeBrief}（第 ${index + 1} 镜）`,
        startState:
          index === 0 ? "主体与环境清晰建立。" : "承接上一镜的主体、服装、道具与环境状态。",
        action:
          index === 0
            ? "主体进入构图并建立叙事目标。"
            : index === count - 1
              ? "主体完成动作并形成最终画面。"
              : "主体推进核心动作并突出主要视觉信息。",
        endState:
          index === count - 1 ? "形成稳定且完整的英雄画面。" : "动作停在可自然承接下一镜的状态。",
        camera: "稳定的竖屏中景，使用克制且连续的镜头运动。",
        composition: "主体与主要产品或道具保持清晰可辨。",
        continuityRequirements: ["保持主体身份、服装、主要道具、场景布局和光线连续。"],
        durationSeconds: 2,
        referenceAliases: references,
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
