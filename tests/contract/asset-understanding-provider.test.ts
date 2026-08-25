import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  AssetUnderstandingProviderRequestSchema,
  AssetUnderstandingProviderResultSchema,
} from "@comfyuiflow/contracts";
import {
  FakeAssetUnderstandingProvider,
  OPENAI_ASSET_UNDERSTANDING_MODEL,
  OpenAiAssetUnderstandingProvider,
} from "@comfyuiflow/ai-providers";

const facts = {
  summary: "Verified image",
  directObservations: ["One subject is visible"],
  uncertainInterpretations: [],
  confidence: "LOW" as const,
};

function request() {
  return AssetUnderstandingProviderRequestSchema.parse({
    taskType: "ASSET_UNDERSTANDING",
    contractVersion: "asset-understanding-v1",
    modelRef: { providerId: "fake", modelId: "asset-understanding-fake-v1" },
    promptVersion: "asset-understanding-v1",
    schemaVersion: "asset-understanding-v1",
    images: [
      { slot: "A1", mimeType: "image/png", content: new Uint8Array([1, 2, 3]) },
      { slot: "A2", mimeType: "image/jpeg", content: new Uint8Array([4, 5, 6]) },
    ],
    context: "Bounded test context",
  });
}

describe("asset-understanding provider contract", () => {
  it("keeps request/result DTOs strict, bounded, and slot-unique", () => {
    expect(() =>
      AssetUnderstandingProviderRequestSchema.parse({
        ...request(),
        images: [request().images[0], request().images[0]],
      }),
    ).toThrow(/unique/);
    expect(() =>
      AssetUnderstandingProviderRequestSchema.parse({ ...request(), localPath: "/tmp/x" }),
    ).toThrow();
    expect(() =>
      AssetUnderstandingProviderResultSchema.parse({
        providerId: "fake",
        requestedModelId: "fake-v1",
        resolvedModelId: "fake-v1",
        responseId: "response-1",
        results: [
          { slot: "A1", facts },
          { slot: "A1", facts },
        ],
      }),
    ).toThrow(/unique/);
  });

  it("provides deterministic success, invalid-slot, timeout, and ambiguous Fake modes", async () => {
    const success = new FakeAssetUnderstandingProvider();
    await expect(success.understandAssets(request())).resolves.toMatchObject({
      providerId: "fake",
      results: [{ slot: "A1" }, { slot: "A2" }],
      providerMetadata: { providerCalls: 0 },
    });
    expect(success.calls).toBe(1);

    const invalid = new FakeAssetUnderstandingProvider("INVALID");
    const incomplete = await invalid.understandAssets(request());
    expect(incomplete.results.map((item) => item.slot)).toEqual(["A1"]);
    expect(invalid.calls).toBe(1);

    const timeout = new FakeAssetUnderstandingProvider("TIMEOUT");
    await expect(timeout.understandAssets(request())).rejects.toThrow(/timed out/);
    expect(timeout.calls).toBe(1);

    const ambiguous = new FakeAssetUnderstandingProvider("AMBIGUOUS");
    await expect(ambiguous.understandAssets(request())).rejects.toThrow(/completion signal/);
    expect(ambiguous.calls).toBe(1);
  });

  it("sends one fixed OpenAI request with store disabled and rejects unregistered models first", async () => {
    const parse = vi.fn().mockResolvedValue({
      id: "response-1",
      model: OPENAI_ASSET_UNDERSTANDING_MODEL,
      output_parsed: {
        results: [
          { slot: "A1", facts },
          { slot: "A2", facts },
        ],
      },
    });
    const provider = new OpenAiAssetUnderstandingProvider({ responses: { parse } } as never);
    const openAiRequest = {
      ...request(),
      modelRef: { providerId: "openai", modelId: OPENAI_ASSET_UNDERSTANDING_MODEL },
    };
    await expect(provider.understandAssets(openAiRequest)).resolves.toMatchObject({
      providerId: "openai",
      results: [{ slot: "A1" }, { slot: "A2" }],
      providerMetadata: { store: false },
    });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0]?.[0]).toMatchObject({
      model: OPENAI_ASSET_UNDERSTANDING_MODEL,
      store: false,
    });
    expect(JSON.stringify(parse.mock.calls[0]?.[0])).not.toMatch(
      /projectAssetId|productionAssetId|storageKey|localPath/i,
    );

    await expect(
      provider.understandAssets({
        ...openAiRequest,
        modelRef: { providerId: "openai", modelId: "unregistered" },
      }),
    ).rejects.toThrow(/not registered/);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("pins SDK retry and timeout safeguards in the OpenAI adapter", async () => {
    const source = await readFile(
      "packages/ai-providers/src/openai-asset-understanding-provider.ts",
      "utf8",
    );
    expect(source).toContain("maxRetries: 0");
    expect(source).toContain("timeout: 30_000");
    expect(source).toContain("store: false");
  });
});
