import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ComfyUiClient,
  ComfyUiExecutionService,
  WorkflowRegistry,
  generationScopeHash,
} from "@comfyuiflow/comfyui-bridge";
import {
  AuthorizationService,
  hashCanonical,
  sha256Bytes,
  sha256File,
} from "@comfyuiflow/spike-core";
import { createFakeComfyUi, type FakeComfyUi } from "../fixtures/fake-comfyui.js";

const openServers: FakeComfyUi[] = [];
afterEach(async () => Promise.all(openServers.splice(0).map((server) => server.close())));

async function fixture(root: string) {
  const workflowBytes = await readFile(
    join(process.cwd(), "tests/fixtures/workflows/ready.api.json"),
  );
  await writeFile(join(root, "ready.api.json"), workflowBytes);
  const manifest = {
    workflowId: "ready-video",
    version: "1",
    displayName: "Ready video",
    enabled: true,
    apiWorkflowPath: "ready.api.json",
    sha256: sha256Bytes(workflowBytes),
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
  return { manifest, registry: new WorkflowRegistry(join(root, "registry.json")) };
}

describe("ComfyUI live bridge contract", () => {
  it("stages, submits once, polls, downloads output, and cancels by exact ID", async () => {
    const artifactBytes = await readFile(join(process.cwd(), "tests/fixtures/media/shot.mp4"));
    const fake = await createFakeComfyUi({ artifactBytes });
    openServers.push(fake);
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-live-"));
    const { manifest, registry } = await fixture(root);
    const inputRoot = join(root, "inputs");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(inputRoot));
    const character = join(inputRoot, "character.png");
    const scene = join(inputRoot, "scene.png");
    await writeFile(character, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]));
    await writeFile(scene, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 2]));
    const authorization = new AuthorizationService(root);
    const service = new ComfyUiExecutionService({
      client: new ComfyUiClient(fake.baseUrl),
      registry,
      authorization,
      dataRoot: root,
      liveEnabled: true,
    });
    const stagedCharacter = await service.stageInput({
      workflowId: manifest.workflowId,
      role: "character",
      localPath: character,
      expectedSha256: await sha256File(character),
    });
    const stagedScene = await service.stageInput({
      workflowId: manifest.workflowId,
      role: "scene",
      localPath: scene,
      expectedSha256: await sha256File(scene),
    });
    const promptId = randomUUID();
    const runId = randomUUID();
    const submission = {
      workflowId: manifest.workflowId,
      workflowSha256: manifest.sha256,
      promptId,
      runId,
      character: stagedCharacter,
      scene: stagedScene,
      shot: {
        positivePrompt: "Walk into the room",
        durationSeconds: 2,
        width: 512,
        height: 512,
        fps: 24,
      },
    };
    const scopeHash = generationScopeHash(submission);
    const grant = await authorization.createGrant({
      operation: "COMFYUI_SUBMIT",
      scopeHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const submitted = await service.submit({ ...submission, grantId: grant.id });
    expect(submitted.promptId).toBe(promptId);
    expect(fake.counts["POST /prompt"]).toBe(1);
    await expect(service.submit({ ...submission, grantId: grant.id })).rejects.toThrow(
      "already consumed",
    );
    expect(fake.counts["POST /prompt"]).toBe(1);
    const status = await service.status(promptId);
    expect(status.status).toBe("COMPLETED");
    const artifacts = await service.retainArtifacts({
      promptId,
      runId,
      workflowId: manifest.workflowId,
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.sha256).toBe(sha256Bytes(artifactBytes));
    expect(await service.cancel(promptId)).toBe(true);
    expect(hashCanonical(submission)).toHaveLength(64);
  });

  it("blocks submission when LIVE is disabled before consuming a grant", async () => {
    const fake = await createFakeComfyUi();
    openServers.push(fake);
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-disabled-"));
    const { registry } = await fixture(root);
    const service = new ComfyUiExecutionService({
      client: new ComfyUiClient(fake.baseUrl),
      registry,
      authorization: new AuthorizationService(root),
      dataRoot: root,
      liveEnabled: false,
    });
    await expect(service.submit({} as any)).rejects.toThrow("LIVE is disabled");
    expect(fake.counts["POST /prompt"] ?? 0).toBe(0);
  });
});
