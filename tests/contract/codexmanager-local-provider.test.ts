import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CODEXMANAGER_LOCAL_BASE_URL,
  CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
  CODEXMANAGER_LOCAL_PROVIDER_ID,
  CodexManagerLocalProvider,
} from "@comfyuiflow/ai-providers";
import { ingestSpikeAssets } from "@comfyuiflow/spike-core";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function requestFixture() {
  const root = await mkdtemp(join(tmpdir(), "comfyuiflow-codexmanager-"));
  const character = join(root, "character.png");
  const scene = join(root, "scene.png");
  await writeFile(character, png);
  await writeFile(scene, Buffer.concat([png, Buffer.from([0])]));
  return {
    taskType: "STORYBOARD_GENERATION" as const,
    modelRef: {
      providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
      modelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
    },
    creativeDescription: "walk in",
    imageInputs: await ingestSpikeAssets(character, scene, join(root, "data")),
    promptTemplateVersion: "director-one-shot-v1" as const,
    metadata: { requiredDurationSeconds: 2.0625 },
  };
}

function validOutput() {
  return {
    id: randomUUID(),
    schemaVersion: "1.0.0",
    promptTemplateVersion: "director-one-shot-v1",
    creativeDescription: "walk in",
    startState: "At the doorway",
    action: "Walks into the room",
    endState: "Stops near the table",
    camera: "Medium tracking shot",
    composition: "Character centered",
    continuityRequirements: ["Keep wardrobe stable"],
    durationSeconds: 2.0625,
    directorRunId: randomUUID(),
  };
}

function jsonGatewayResponse(output: unknown = validOutput()) {
  return new Response(
    JSON.stringify({
      id: "resp_local_test",
      model: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }],
      usage: { input_tokens: 12, output_tokens: 24 },
      status: "completed",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function sseGatewayResponse(output: unknown = validOutput()) {
  const completed = {
    type: "response.completed",
    response: {
      id: "resp_local_sse_test",
      model: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      status: "completed",
      usage: { input_tokens: 12, output_tokens: 24 },
      output: [],
    },
  };
  return new Response(
    [
      `data: ${JSON.stringify({ type: "response.created", response: { id: "pending" } })}`,
      "",
      `data: ${JSON.stringify({ type: "response.output_text.done", text: JSON.stringify(output) })}`,
      "",
      `data: ${JSON.stringify(completed)}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"),
    { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } },
  );
}

describe("CodexManager local Director adapter", () => {
  it("uses the fixed loopback Responses endpoint, images, strict output, and local provenance", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonGatewayResponse());
    const provider = new CodexManagerLocalProvider({
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
    });

    expect(provider.getCapabilities(CODEXMANAGER_LOCAL_DIRECTOR_MODEL)).toMatchObject({
      providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
      modelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      inputModalities: ["text", "image"],
      structuredOutput: true,
    });
    const result = await provider.generateStructured(await requestFixture());
    expect(result).toMatchObject({
      providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
      requestedModelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      resolvedModelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      providerMetadata: { gateway: "loopback", responseTransport: "json", store: false },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe("http://127.0.0.1:48760/v1/responses");
    const wireRequest = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(wireRequest).toMatchObject({
      model: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
      store: false,
      stream: false,
    });
    expect(
      wireRequest.input[0].content.filter((item: any) => item.type === "input_image"),
    ).toHaveLength(2);
    expect(JSON.stringify(wireRequest)).not.toContain("local-test-key-not-real");
    expect(fetch.mock.calls[0]![1].headers.authorization).toBe("Bearer local-test-key-not-real");
    expect(CODEXMANAGER_LOCAL_BASE_URL).toBe("http://127.0.0.1:48760/v1");
  });

  it("accepts CodexManager SSE output without issuing another request", async () => {
    const fetch = vi.fn().mockResolvedValue(sseGatewayResponse());
    const provider = new CodexManagerLocalProvider({
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
    });
    await expect(provider.generateStructured(await requestFixture())).resolves.toMatchObject({
      responseId: "resp_local_sse_test",
      providerMetadata: { responseTransport: "sse" },
      structuredOutput: { durationSeconds: 2.0625 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails an incomplete SSE response without retrying", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('data: {"type":"response.created"}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const provider = new CodexManagerLocalProvider({
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
    });
    await expect(provider.generateStructured(await requestFixture())).rejects.toThrow(
      "SSE response is incomplete",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports missing credentials without probing the gateway", async () => {
    const fetch = vi.fn();
    const provider = new CodexManagerLocalProvider({ environment: {}, fetch });
    await expect(provider.validateConfiguration()).resolves.toEqual({
      configured: false,
      reason: "CODEX_MANAGER_API_KEY is missing",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports an unreachable gateway with a bounded non-secret error", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED secret-value"));
    const provider = new CodexManagerLocalProvider({
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
      fetch,
    });
    await expect(provider.validateConfiguration()).resolves.toEqual({
      configured: false,
      reason: "CodexManager local gateway is unreachable",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe("http://127.0.0.1:48760/health");
  });

  it("fails invalid output once without repair or fallback", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonGatewayResponse({ invalid: true }));
    const provider = new CodexManagerLocalProvider({
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
    });
    await expect(provider.generateStructured(await requestFixture())).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects unregistered provider/model requests before a gateway call", async () => {
    const fetch = vi.fn();
    const provider = new CodexManagerLocalProvider({
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
    });
    const request = await requestFixture();
    await expect(
      provider.generateStructured({
        ...request,
        modelRef: { providerId: "openai", modelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL },
      }),
    ).rejects.toThrow("not registered");
    await expect(
      provider.generateStructured({
        ...request,
        modelRef: { providerId: CODEXMANAGER_LOCAL_PROVIDER_ID, modelId: "unregistered-model" },
      }),
    ).rejects.toThrow("not registered");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("propagates one transport failure without a second provider request", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("gateway transport failed"));
    const provider = new CodexManagerLocalProvider({
      fetch,
      environment: { CODEX_MANAGER_API_KEY: "local-test-key-not-real" },
    });
    await expect(provider.generateStructured(await requestFixture())).rejects.toThrow(
      "gateway transport failed",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
