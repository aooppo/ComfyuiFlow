import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CodexManagerKeyframeImageProvider,
  FakeKeyframeImageProvider,
} from "@comfyuiflow/ai-providers";

const input = {
  requestHash: "a".repeat(64),
  prompt: "approved continuity boundary",
  references: [],
  width: 768 as const,
  height: 1344 as const,
  quality: "low" as const,
};

afterEach(() => vi.restoreAllMocks());

describe("keyframe image provider safety", () => {
  it("keeps Fake deterministic and free of external calls", async () => {
    const provider = new FakeKeyframeImageProvider();
    expect(provider.preview()).toMatchObject({
      liveReady: true,
      estimatedCostUsdPerImage: 0,
      providerRequestSize: "1024x1536",
    });
    const first = await provider.generateOnce(input);
    const second = await provider.generateOnce(input);
    expect(first.bytes).toEqual(second.bytes);
    expect(first.usage).toEqual({ externalCalls: 0 });
    expect(provider.calls.generate).toBe(2);
  });

  it("disables LIVE unless capability, snapshot, gateway and current price are explicit", async () => {
    const provider = new CodexManagerKeyframeImageProvider({});
    const capability = provider.preview();
    expect(capability.liveReady).toBe(false);
    expect(capability.blockers).toEqual(
      expect.arrayContaining([
        "KEYFRAME_LIVE_DISABLED",
        "KEYFRAME_GATEWAY_NOT_CONFIGURED",
        "KEYFRAME_HIGH_FIDELITY_UNVERIFIED",
        "KEYFRAME_PRICE_UNAVAILABLE",
        "KEYFRAME_MODEL_SNAPSHOT_UNAVAILABLE",
      ]),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(provider.generateOnce(input)).rejects.toThrow("KEYFRAME_CAPABILITY_UNAVAILABLE");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits exactly one multipart request and never retries", async () => {
    const now = Date.now();
    const provider = new CodexManagerKeyframeImageProvider({
      PROJECT_KEYFRAME_LIVE_ENABLED: "true",
      CODEX_MANAGER_API_KEY: "test-only-key",
      PROJECT_KEYFRAME_IMAGE_EDITING: "true",
      PROJECT_KEYFRAME_MULTI_REFERENCE: "true",
      PROJECT_KEYFRAME_HIGH_FIDELITY_INPUT: "true",
      PROJECT_KEYFRAME_MAX_REFERENCES: "4",
      PROJECT_KEYFRAME_ESTIMATED_USD_PER_IMAGE: "0.01",
      PROJECT_KEYFRAME_PRICE_AS_OF: new Date(now).toISOString(),
      PROJECT_KEYFRAME_PRICE_EXPIRES_AT: new Date(now + 60_000).toISOString(),
      PROJECT_KEYFRAME_MODEL_SNAPSHOT: "gpt-image-2-test-snapshot",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2U=" }] }), { status: 200 }),
      );
    const result = await provider.generateOnce(input);
    expect(Buffer.from(result.bytes).toString()).toBe("image");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).has("input_fidelity")).toBe(false);
  });
});
