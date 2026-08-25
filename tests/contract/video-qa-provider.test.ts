import { describe, expect, it, vi } from "vitest";
import { CodexManagerLocalVideoQaProvider } from "@comfyuiflow/ai-providers";

const criteria = [
  "IDENTITY",
  "WARDROBE_STATE",
  "PRODUCT_STRUCTURE",
  "BODY_PROPORTION_SCALE",
  "SCENE",
  "COMPOSITION",
  "CROSS_FRAME_CONTINUITY",
  "VISUAL_DAMAGE",
  "UNEXPECTED_OBJECTS",
] as const;

function request() {
  const referenceSlots = [
    "SCENE",
    "PRODUCT",
    "CHARACTER_FULL_BODY",
    "CHARACTER_FACE",
    "CHARACTER_REAR",
  ].map((role) => ({
    role,
    projectAssetId: crypto.randomUUID(),
    assetVersionFileId: crypto.randomUUID(),
    productionAssetVersionId: crypto.randomUUID(),
    characterStateVersionId: null,
    sha256: "a".repeat(64),
    displayName: role,
  }));
  return {
    schemaVersion: "ai-qa-request-v1",
    artifactId: crypto.randomUUID(),
    generationSpecId: crypto.randomUUID(),
    generationSpecHash: "b".repeat(64),
    referenceSlots,
    referenceImages: referenceSlots.map(({ role }) => ({
      role,
      sha256: "a".repeat(64),
      mimeType: "image/png",
      content: new Uint8Array([1, 2, 3]),
    })),
    reviewFrames: ["FIRST", "MIDDLE", "FINAL"].map((role) => ({
      role,
      sha256: "c".repeat(64),
      mimeType: "image/png",
      content: new Uint8Array([4, 5, 6]),
    })),
    technicalFacts: { durationSeconds: 4, fps: 24 },
    expectedFacts: { action: "one bounded action" },
    modelRef: { providerId: "codexmanager-local", modelId: "gpt-5.4" },
  } as never;
}

function result() {
  return {
    schemaVersion: "ai-qa-result-v1",
    overallStatus: "WARN",
    summary: "Still-frame QA found no conclusive blocker.",
    limitations: ["Motion quality is not assessable.", "Audio meaning is not assessable."],
    criteria: criteria.map((criterion) => ({
      criterion,
      status: "NOT_ASSESSABLE",
      confidence: "LOW",
      evidence: "The three still frames do not provide enough evidence.",
      frameRoles: [],
    })),
  };
}

describe("CodexManager Local video QA", () => {
  it("sends exactly five references and three frames with fixed model and store false", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_video_qa",
          model: "gpt-5.4",
          output: [{ content: [{ type: "output_text", text: JSON.stringify(result()) }] }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = new CodexManagerLocalVideoQaProvider(
      { CODEX_MANAGER_API_KEY: "not-a-real-key" },
      fetch,
    );
    const reviewed = await provider.reviewVideoFrames(request());
    expect(reviewed).toMatchObject({
      providerId: "codexmanager-local",
      requestedModelId: "gpt-5.4",
      overallStatus: "WARN",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const wire = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(wire).toMatchObject({ model: "gpt-5.4", store: false, stream: false });
    expect(wire.input[0].content.filter((item: any) => item.type === "input_image")).toHaveLength(
      8,
    );
    expect(JSON.stringify(wire)).not.toContain("not-a-real-key");
    expect(JSON.stringify(wire)).toContain("Objects already visible in any approved reference");
    expect(JSON.stringify(wire)).toContain("a later shot must not be enforced in an earlier shot");
    expect(JSON.stringify(wire)).toContain("owner retry requirements");
    expect(JSON.stringify(wire)).toContain("BODY_PROPORTION_SCALE");
    expect(provider.externalCallCount).toBe(1);
  });

  it("rejects invalid strict output once without retry or fallback", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify({ invalid: true }) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new CodexManagerLocalVideoQaProvider(
      { CODEX_MANAGER_API_KEY: "not-a-real-key" },
      fetch,
    );
    await expect(provider.reviewVideoFrames(request())).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(provider.externalCallCount).toBe(1);
  });
});
