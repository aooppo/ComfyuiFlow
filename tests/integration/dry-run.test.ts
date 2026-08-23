import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { sha256Bytes } from "@comfyuiflow/spike-core";
import { buildDryRun } from "../../apps/spike-cli/src/dry-run.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("vertical spike dry-run", () => {
  it("produces a complete preview with zero provider calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-dry-"));
    const character = join(root, "character.png");
    const scene = join(root, "scene.png");
    await writeFile(character, png);
    await writeFile(scene, Buffer.concat([png, Buffer.from([0])]));
    const workflowBytes = await readFile(
      join(process.cwd(), "tests/fixtures/workflows/ready.api.json"),
    );
    await writeFile(join(root, "ready.api.json"), workflowBytes);
    await writeFile(
      join(root, "registry.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        workflows: [
          {
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
          },
        ],
      }),
    );
    let readinessCalls = 0;
    const output = await buildDryRun(
      {
        characterImage: character,
        sceneImage: scene,
        creativeDescription: "The character enters the scene and looks toward camera.",
        workflowId: "ready-video",
      },
      {
        dataRoot: join(root, "data"),
        registry: new WorkflowRegistry(join(root, "registry.json")),
        readiness: async () => {
          readinessCalls += 1;
          return {
            workflowId: "ready-video",
            ready: true,
            endpointReachable: true,
            workflowHashMatches: true,
            missingNodeClasses: [],
            missingModels: [],
            bindingErrors: [],
            blockers: [],
            generationCalls: 0 as const,
          };
        },
      },
    );
    expect(readinessCalls).toBe(1);
    expect(output).toMatchObject({
      mode: "DRY_RUN",
      providerCalls: 0,
      director: {
        providerId: "codexmanager-local",
        modelId: "gpt-5.4",
        destination: "loopback-local",
      },
      workflow: { workflowId: "ready-video" },
      readiness: { ready: true },
    });
    expect(output.assets).toHaveLength(2);
    expect(output.expectedInvocation.tool).toBe("comfyui_submit_workflow");
  });

  it("rejects duplicate character and scene bytes before readiness or provider calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-duplicate-"));
    const character = join(root, "character.png");
    const scene = join(root, "scene.png");
    await writeFile(character, png);
    await writeFile(scene, png);
    let readinessCalls = 0;
    await expect(
      buildDryRun(
        {
          characterImage: character,
          sceneImage: scene,
          creativeDescription: "walk",
          workflowId: "unused",
        },
        {
          dataRoot: join(root, "data"),
          registry: { load: async () => Promise.reject(new Error("must not load")) } as any,
          readiness: async () => {
            readinessCalls += 1;
            throw new Error("must not call readiness");
          },
        },
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_INPUT_ASSETS", providerCalls: 0 });
    expect(readinessCalls).toBe(0);
  });
});
