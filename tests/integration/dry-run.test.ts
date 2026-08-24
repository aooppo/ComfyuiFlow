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

const h3Prompt = `subject_definitions:
<Subject 1> comes from <Picture 1>, <Picture 2>, <Picture 3>, <Picture 4>, and <Picture 5>.

summary:
[reference generation] Create one advertisement.

retention_analysis:
<Subject 1>: fully_preserved.

detailed_description:
[Shot 1] Establish the room.
[Shot 2] At 00:02.500, track the subject.
[Shot 3] At 00:05.500, show the product detail.
[Shot 4] At 00:08.500, show the product hero.
[Shot 5] At 00:11.500, hold the final composition.

overall_soundscape:
Quiet room tone.

non_diegetic_music:
Warm instrumental music.`;

const h3ValidationPrompt = h3Prompt
  .replace("[Shot 2] At 00:02.500, track the subject.\n", "")
  .replace("[Shot 3] At 00:05.500, show the product detail.\n", "")
  .replace("[Shot 4] At 00:08.500, show the product hero.\n", "")
  .replace("[Shot 5] At 00:11.500, hold the final composition.\n", "");

describe("vertical spike dry-run", () => {
  it("previews the MiniMax H3 candidate with its exact bounded profile and zero calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-h3-dry-"));
    const character = join(root, "character.png");
    const scene = join(root, "scene.png");
    const product = join(root, "product.png");
    const characterFace = join(root, "character-face.png");
    const characterRear = join(root, "character-rear.png");
    await writeFile(character, png);
    await writeFile(scene, Buffer.concat([png, Buffer.from([0])]));
    await writeFile(product, Buffer.concat([png, Buffer.from([1])]));
    await writeFile(characterFace, Buffer.concat([png, Buffer.from([2])]));
    await writeFile(characterRear, Buffer.concat([png, Buffer.from([3])]));
    const output = await buildDryRun(
      {
        characterImage: character,
        sceneImage: scene,
        additionalReferenceImages: [
          { role: "PRODUCT", image: product },
          { role: "CHARACTER_FACE", image: characterFace },
          { role: "CHARACTER_REAR", image: characterRear },
        ],
        creativeDescription: "The woman turns gently toward camera.",
        generationPrompt: h3Prompt,
        workflowId: "minimax-h3-decorolala-ad-15s-v1",
      },
      {
        dataRoot: join(root, "data"),
        registry: new WorkflowRegistry(join(process.cwd(), "workflows", "registry.json")),
        readiness: async () => ({
          workflowId: "minimax-h3-decorolala-ad-15s-v1",
          ready: true,
          endpointReachable: true,
          workflowHashMatches: true,
          missingNodeClasses: [],
          missingModels: [],
          bindingErrors: [],
          blockers: [],
          comfyOrgCredentialConfigured: true,
          generationCalls: 0 as const,
        }),
        directorReadiness: async () => ({ configured: true }),
      },
    );
    expect(output).toMatchObject({
      mode: "DRY_RUN",
      providerCalls: 0,
      workflow: {
        workflowId: "minimax-h3-decorolala-ad-15s-v1",
        version: "1.0.0",
        sha256: "e5aeb79cf71b7e7f9e3aa9935756a406460b63db1d448f43239d9d3a3ca7fe37",
        constraints: {
          durationSeconds: { default: 15 },
          width: 768,
          height: 1344,
          fps: 24,
        },
      },
      expectedInvocation: {
        maxDirectorCalls: 1,
        maxGenerationSubmissions: 1,
      },
    });
    expect(output.assets).toHaveLength(5);
    expect(output.generationPrompt).toContain("subject_definitions:");
    expect(output.authorizationScope.generationPrompt).toContain("subject_definitions:");
    expect(output.readiness.generationCalls).toBe(0);
    const changedPromptOutput = await buildDryRun(
      {
        characterImage: character,
        sceneImage: scene,
        additionalReferenceImages: [
          { role: "PRODUCT", image: product },
          { role: "CHARACTER_FACE", image: characterFace },
          { role: "CHARACTER_REAR", image: characterRear },
        ],
        creativeDescription: "The woman turns gently toward camera.",
        generationPrompt: h3Prompt.replace("Warm instrumental music.", "Soft piano music."),
        workflowId: "minimax-h3-decorolala-ad-15s-v1",
      },
      {
        dataRoot: join(root, "data"),
        registry: new WorkflowRegistry(join(process.cwd(), "workflows", "registry.json")),
        readiness: async () => output.readiness,
        directorReadiness: async () => ({ configured: true }),
      },
    );
    expect(changedPromptOutput.scopeHash).not.toBe(output.scopeHash);
  });

  it("rejects a flat generation prompt before readiness or provider calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-h3-prompt-"));
    const character = join(root, "character.png");
    const scene = join(root, "scene.png");
    await writeFile(character, png);
    await writeFile(scene, Buffer.concat([png, Buffer.from([0])]));
    let readinessCalls = 0;
    await expect(
      buildDryRun(
        {
          characterImage: character,
          sceneImage: scene,
          creativeDescription: "ad",
          generationPrompt: "make an ad",
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
    ).rejects.toThrow("H3 full-reference prompt");
    expect(readinessCalls).toBe(0);
  });

  it("accepts a single-shot short validation prompt without timed cuts", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-h3-short-"));
    const character = join(root, "character.png");
    const scene = join(root, "scene.png");
    await writeFile(character, png);
    await writeFile(scene, Buffer.concat([png, Buffer.from([0])]));
    await expect(
      buildDryRun(
        {
          characterImage: character,
          sceneImage: scene,
          creativeDescription: "Minimal reference validation.",
          generationPrompt: h3ValidationPrompt,
          workflowId: "unused",
        },
        {
          dataRoot: join(root, "data"),
          registry: { load: async () => Promise.reject(new Error("validated prompt")) } as any,
          readiness: async () => {
            throw new Error("must not call readiness");
          },
        },
      ),
    ).rejects.toThrow("validated prompt");
  });

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
            comfyOrgCredentialConfigured: false,
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
