import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import {
  AuthorizationService,
  EvidenceStore,
  canonicalStringify,
  hashCanonical,
  loadRuntimeConfig,
  sha256Bytes,
} from "@comfyuiflow/spike-core";

async function temporaryRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "comfyuiflow-"));
}

describe("foundation", () => {
  it("canonicalizes object keys before hashing", () => {
    expect(canonicalStringify({ z: 1, nested: { b: true, a: false }, a: 2 })).toBe(
      '{"a":2,"nested":{"a":false,"b":true},"z":1}',
    );
    expect(hashCanonical({ b: 2, a: 1 })).toBe(hashCanonical({ a: 1, b: 2 }));
  });

  it("allows only loopback ComfyUI endpoints and keeps LIVE disabled by default", () => {
    const config = loadRuntimeConfig({}, "/tmp/project");
    expect(config.comfyuiBaseUrl).toBe("http://127.0.0.1:8188");
    expect(config.comfyuiLiveEnabled).toBe(false);
    expect(config.openaiLiveEnabled).toBe(false);
    expect(config.codexManagerLiveEnabled).toBe(false);
    expect(config.codexManagerConfigured).toBe(false);
    expect(config.comfyOrgCredentialConfigured).toBe(false);
    expect(config.codexManagerBaseUrl).toBe("http://127.0.0.1:48760/v1");
    expect(() => loadRuntimeConfig({ COMFYUI_BASE_URL: "https://example.com" })).toThrow(
      "must use http",
    );
    expect(() => loadRuntimeConfig({ COMFYUI_BASE_URL: "http://192.168.1.2:8188" })).toThrow(
      "loopback-local",
    );
    expect(
      loadRuntimeConfig({
        CODEX_MANAGER_API_KEY: "local-test-key-not-real",
        CODEX_MANAGER_LIVE_ENABLED: "1",
      }),
    ).toMatchObject({ codexManagerConfigured: true, codexManagerLiveEnabled: true });
    expect(loadRuntimeConfig({ COMFYUI_API_KEY: "test-comfy-key-value" })).toMatchObject({
      comfyOrgCredentialConfigured: true,
      comfyOrgApiKey: "test-comfy-key-value",
    });
    expect(loadRuntimeConfig({ COMFY_API_KEY: "test-comfy-alias-value" })).toMatchObject({
      comfyOrgCredentialConfigured: true,
      comfyOrgApiKey: "test-comfy-alias-value",
    });
  });

  it("creates a verifiable append-only evidence chain", async () => {
    const store = new EvidenceStore(await temporaryRoot());
    await store.append("run_test", "CREATED", { one: 1 });
    await store.append("run_test", "PREFLIGHTED", { two: 2 });
    const events = await store.read("run_test");
    expect(events).toHaveLength(2);
    expect(store.verify(events)).toBe(true);
    events[0]!.payload = { tampered: true };
    expect(store.verify(events)).toBe(false);
  });

  it("consumes an exact authorization at most once", async () => {
    const root = await temporaryRoot();
    const service = new AuthorizationService(root);
    const scopeHash = hashCanonical({ target: "one" });
    const grant = await service.createGrant({
      operation: "COMFYUI_SUBMIT",
      scopeHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const input = {
      grantId: grant.id,
      runId: crypto.randomUUID(),
      operation: "COMFYUI_SUBMIT" as const,
      scopeHash,
      requestHash: hashCanonical({ request: "one" }),
    };
    await expect(service.consumeGrant(input)).resolves.toMatchObject({ attemptNumber: 1 });
    await expect(service.consumeGrant(input)).rejects.toThrow("already consumed");
    const stored = JSON.parse(
      await readFile(join(root, "authorizations", "consumptions", `${grant.id}.json`), "utf8"),
    );
    expect(stored.grantId).toBe(grant.id);
  });

  it("rejects workflow hash drift and binds only manifest pointers", async () => {
    const root = await temporaryRoot();
    const workflow = {
      "1": { class_type: "LoadImage", inputs: { image: "character.png" } },
      "2": { class_type: "LoadImage", inputs: { image: "scene.png" } },
      "3": { class_type: "Text", inputs: { text: "prompt" } },
      "4": { class_type: "SaveVideo", inputs: { video: ["3", 0] } },
    };
    const bytes = Buffer.from(JSON.stringify(workflow));
    await writeFile(join(root, "ready.api.json"), bytes);
    const manifest = {
      workflowId: "ready-video",
      version: "1",
      displayName: "Ready video",
      enabled: true,
      apiWorkflowPath: "ready.api.json",
      sha256: sha256Bytes(bytes),
      requiredNodeClasses: ["LoadImage", "Text", "SaveVideo"],
      requiredModels: [],
      constraints: {
        durationSeconds: { min: 1, max: 5, default: 2 },
        width: 512,
        height: 512,
        fps: 24,
        outputMediaType: "video",
      },
      bindings: {
        character: { pointer: "/1/inputs/image" },
        scene: { pointer: "/2/inputs/image" },
        positivePrompt: { pointer: "/3/inputs/text" },
      },
      output: { nodeId: "4", mediaKey: "video" },
    };
    await writeFile(
      join(root, "registry.json"),
      JSON.stringify({ schemaVersion: "1.0.0", workflows: [manifest] }),
    );
    const registry = new WorkflowRegistry(join(root, "registry.json"));
    const materialized = await registry.materialize("ready-video", manifest.sha256, {
      character: "input/character.png",
      scene: "input/scene.png",
      positivePrompt: "walk into frame",
      durationSeconds: 2,
      width: 512,
      height: 512,
      fps: 24,
    });
    expect((materialized["1"] as any).inputs.image).toBe("input/character.png");
    expect((materialized["3"] as any).inputs.text).toBe("walk into frame");

    await mkdir(join(root, "sub"));
    await writeFile(join(root, "ready.api.json"), JSON.stringify({ changed: true }));
    await expect(
      registry.materialize("ready-video", manifest.sha256, {
        character: "character.png",
        scene: "scene.png",
        positivePrompt: "prompt",
        durationSeconds: 2,
        width: 512,
        height: 512,
        fps: 24,
      }),
    ).rejects.toThrow("hash drift");
  });
});
