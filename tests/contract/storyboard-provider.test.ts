import { describe, expect, it } from "vitest";
import { FAKE_STORYBOARD_MODEL_ID, FakeStoryboardProvider } from "@comfyuiflow/ai-providers";
import type { StoryboardGenerationRequestV1 } from "@comfyuiflow/contracts";

const request: StoryboardGenerationRequestV1 = {
  taskType: "STORYBOARD_GENERATION_V1",
  contractVersion: "storyboard-generation-v1",
  modelRef: { providerId: "fake", modelId: FAKE_STORYBOARD_MODEL_ID },
  projectId: "11111111-1111-4111-8111-111111111111",
  storyboardId: "22222222-2222-4222-8222-222222222222",
  creativeBrief: "Lala introduces a coffee table with a calm beginning, reveal, and resolution.",
  shotCount: 3,
  promptTemplateVersion: "storyboard-three-shot-v1",
  assetRequirements: [],
};

describe("Fake Storyboard Provider", () => {
  it("advertises Storyboard support additively", () => {
    const capabilities = new FakeStoryboardProvider().getCapabilities(FAKE_STORYBOARD_MODEL_ID);
    expect(capabilities.storyboardGeneration).toEqual({
      contractVersions: ["storyboard-generation-v1"],
      promptTemplateVersions: ["storyboard-three-shot-v1"],
      supportedShotCounts: [3],
    });
    expect(capabilities.structuredOutput).toBe(true);
  });

  it("returns deterministic three-shot bodies and distinct response provenance with zero calls", async () => {
    const provider = new FakeStoryboardProvider();
    const first = await provider.generateStoryboard(request);
    const second = await provider.generateStoryboard(request);

    expect(first.shots).toHaveLength(3);
    expect(first.shots.map((shot) => shot.ordinal)).toEqual([1, 2, 3]);
    expect(first.shots).toEqual(second.shots);
    expect(first.responseId).not.toBe(second.responseId);
    expect(first.providerMetadata).toMatchObject({ fake: true, providerCalls: 0 });
  });

  it("fails closed for an unregistered model without fallback", async () => {
    const provider = new FakeStoryboardProvider();
    await expect(
      provider.generateStoryboard({
        ...request,
        modelRef: { providerId: "fake", modelId: "unknown-model" },
      }),
    ).rejects.toThrow("not registered");
  });
});
