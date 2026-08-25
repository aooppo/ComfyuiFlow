import { describe, expect, it, vi } from "vitest";
import { TerraStoryboardProvider } from "@comfyuiflow/ai-providers";
import { StoryboardGenerationRequestV2Schema } from "@comfyuiflow/contracts";
const request = StoryboardGenerationRequestV2Schema.parse({
  taskType: "STORYBOARD_GENERATION_V2",
  contractVersion: "storyboard-generation-v2",
  promptTemplateVersion: "storyboard-director-v2",
  modelRef: { providerId: "codexmanager-local", modelId: "gpt-5.6-terra" },
  creativeBrief: "测试",
  maxShotCount: 1,
  currentHead: { versionNumber: 1, contentHash: "a".repeat(64) },
  references: [{ alias: "ref_01", kind: "SCENE", displayName: "场景", semanticFacts: {} }],
});
function envelope() {
  const output = {
    narrativeSummary: "摘要",
    shots: [
      {
        ordinal: 1,
        title: "镜头",
        creativeDescription: "描述",
        startState: "开始",
        action: "动作",
        endState: "结束",
        camera: "中景",
        composition: "居中",
        continuityRequirements: [],
        durationSeconds: 2,
        referenceAliases: ["ref_01"],
      },
    ],
  };
  return { id: "resp_1", model: "gpt-5.6-terra-actual", output_text: JSON.stringify(output) };
}
function sseEnvelope() {
  const response = envelope();
  return new Response(
    [
      `data: ${JSON.stringify({ type: "response.output_text.done", text: response.output_text })}`,
      "",
      `data: ${JSON.stringify({
        type: "response.completed",
        response: { id: response.id, model: response.model, status: "completed", output: [] },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"),
    { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } },
  );
}
describe("Terra Storyboard providers", () => {
  it("CodexManager sends exactly one request and records the returned model", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(envelope()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const provider = new TerraStoryboardProvider("codexmanager-local", {
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "test" },
    });
    const value = await provider.generateStoryboardV2(request);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(value.resolvedModelId).toBe("gpt-5.6-terra-actual");
  });
  it("accepts CodexManager SSE output in one request", async () => {
    const fetch = vi.fn(async () => sseEnvelope());
    const provider = new TerraStoryboardProvider("codexmanager-local", {
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "test" },
    });
    const value = await provider.generateStoryboardV2(request);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(value.resolvedModelId).toBe("gpt-5.6-terra-actual");
    expect(value.shots).toHaveLength(1);
  });
  it("OpenAI uses its own explicit profile with no fallback", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(envelope()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const provider = new TerraStoryboardProvider("openai", {
      fetch,
      environment: { OPENAI_API_KEY: "test" },
    });
    const value = await provider.generateStoryboardV2({
      ...request,
      modelRef: { providerId: "openai", modelId: "gpt-5.6-terra" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(value.providerId).toBe("openai");
  });
});
