import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ComfyUiClient,
  WorkflowRegistry,
  checkWorkflowReadiness,
} from "@comfyuiflow/comfyui-bridge";
import { sha256Bytes } from "@comfyuiflow/spike-core";
import { createFakeComfyUi, type FakeComfyUi } from "../fixtures/fake-comfyui.js";

const openServers: FakeComfyUi[] = [];
afterEach(async () => Promise.all(openServers.splice(0).map((server) => server.close())));

async function readyRegistry(
  root: string,
  requiredModels: Array<{ folder: string; filename: string }> = [],
  requiresComfyOrgAuth = false,
) {
  const source = join(process.cwd(), "tests/fixtures/workflows/ready.api.json");
  const bytes = await readFile(source);
  await writeFile(join(root, basename(source)), bytes);
  const registry = {
    schemaVersion: "1.0.0",
    workflows: [
      {
        workflowId: "ready-video",
        version: "1",
        displayName: "Ready video",
        enabled: true,
        apiWorkflowPath: basename(source),
        sha256: sha256Bytes(bytes),
        requiredNodeClasses: ["LoadImage", "Text", "SaveVideo"],
        requiredModels,
        requiresComfyOrgAuth,
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
      },
    ],
  };
  const registryPath = join(root, "registry.json");
  await writeFile(registryPath, JSON.stringify(registry));
  return new WorkflowRegistry(registryPath);
}

describe("ComfyUI readiness contract", () => {
  it("confirms node/model/binding readiness without submitting", async () => {
    const fake = await createFakeComfyUi({ models: { checkpoints: ["video.safetensors"] } });
    openServers.push(fake);
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-ready-"));
    const registry = await readyRegistry(root, [
      { folder: "checkpoints", filename: "video.safetensors" },
    ]);
    const result = await checkWorkflowReadiness(
      new ComfyUiClient(fake.baseUrl),
      registry,
      "ready-video",
    );
    expect(result).toMatchObject({ ready: true, generationCalls: 0 });
    expect(fake.counts["POST /prompt"] ?? 0).toBe(0);
  });

  it("reports all missing prerequisites when the endpoint is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-blocked-"));
    const registry = await readyRegistry(root, [
      { folder: "checkpoints", filename: "missing.safetensors" },
    ]);
    const result = await checkWorkflowReadiness(
      new ComfyUiClient("http://127.0.0.1:1", { timeoutMs: 100 }),
      registry,
      "ready-video",
    );
    expect(result.ready).toBe(false);
    expect(result.endpointReachable).toBe(false);
    expect(result.blockers).toContain("COMFYUI_UNREACHABLE");
    expect(result.generationCalls).toBe(0);
  });

  it("blocks a Partner Node workflow before generation when no credential is configured", async () => {
    const fake = await createFakeComfyUi();
    openServers.push(fake);
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-auth-blocked-"));
    const registry = await readyRegistry(root, [], true);
    const result = await checkWorkflowReadiness(
      new ComfyUiClient(fake.baseUrl),
      registry,
      "ready-video",
    );
    expect(result).toMatchObject({
      ready: false,
      comfyOrgCredentialConfigured: false,
      generationCalls: 0,
    });
    expect(result.blockers).toContain("COMFY_ORG_CREDENTIAL_MISSING");
    expect(fake.counts["POST /prompt"] ?? 0).toBe(0);
  });
});
