import { describe, expect, it, vi } from "vitest";
import { FakeStoryboardProvider, FAKE_STORYBOARD_V2_MODEL_ID } from "@comfyuiflow/ai-providers";
import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import {
  StoryboardGenerationRequestV2Schema,
  validateStoryboardProposalV2,
} from "@comfyuiflow/contracts";

const hash = "a".repeat(64);
function request(maxShotCount = 3) {
  return StoryboardGenerationRequestV2Schema.parse({
    taskType: "STORYBOARD_GENERATION_V2",
    contractVersion: "storyboard-generation-v2",
    promptTemplateVersion: "storyboard-director-v2",
    modelRef: { providerId: "fake", modelId: FAKE_STORYBOARD_V2_MODEL_ID },
    creativeBrief: "用三个连续画面介绍产品",
    maxShotCount,
    currentHead: { versionNumber: 1, contentHash: hash },
    references: [
      {
        alias: "ref_01",
        kind: "PRODUCT",
        displayName: "主要产品",
        semanticFacts: { color: "red" },
      },
    ],
  });
}

describe("storyboard director v2", () => {
  it("preserves the user maximum and generates a deterministic zero-call proposal", async () => {
    const provider = new FakeStoryboardProvider();
    const value = await provider.generateStoryboardV2(request(2));
    expect(value.shots).toHaveLength(2);
    expect(value.providerMetadata.providerCalls).toBe(0);
    expect(validateStoryboardProposalV2(value, request(2))).toEqual(value);
  });
  it("rejects invalid bounds, unknown aliases, gaps and reference-free shots", async () => {
    expect(() => request(0)).toThrow();
    const value = await new FakeStoryboardProvider().generateStoryboardV2(request());
    expect(() =>
      validateStoryboardProposalV2(
        { ...value, shots: [{ ...value.shots[0], referenceAliases: [] }] },
        request(),
      ),
    ).toThrow();
    expect(() =>
      validateStoryboardProposalV2(
        {
          ...value,
          shots: value.shots.map((shot, index) => (index === 1 ? { ...shot, ordinal: 3 } : shot)),
        },
        request(),
      ),
    ).toThrow();
    expect(() =>
      validateStoryboardProposalV2(
        { ...value, shots: [{ ...value.shots[0], referenceAliases: ["ref_unknown"] }] },
        request(),
      ),
    ).toThrow();
  });
  it("does not accept database ids or filesystem paths at the provider boundary", () => {
    expect(() =>
      StoryboardGenerationRequestV2Schema.parse({ ...request(), projectId: crypto.randomUUID() }),
    ).toThrow();
    expect(JSON.stringify(request())).not.toMatch(/storedPath|database|projectId|storyboardId/);
  });
  it("returns a non-confirmable zero-call preview when no reference is eligible", async () => {
    const client = {
      storyboard: {
        findUnique: vi.fn().mockResolvedValue({
          id: "storyboard-1",
          projectId: "project-1",
          status: "ACTIVE",
          creativeBrief: "展示产品",
          headVersion: { id: "version-1", versionNumber: 1, contentHash: hash },
        }),
      },
      assetVersionFile: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new StoryboardDirectorService(
      client as any,
      undefined,
      {},
      {
        allowTestFixtures: true,
      },
    );

    await expect(
      service.preview("storyboard-1", { profileId: "fake-storyboard-v2", maxShotCount: 2 }),
    ).resolves.toMatchObject({
      externalCalls: 0,
      references: [],
      recommended: [],
      rejected: [],
      canConfirm: false,
    });
  });
});
