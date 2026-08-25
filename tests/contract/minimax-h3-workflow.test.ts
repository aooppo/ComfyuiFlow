import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";

const historicalWorkflowId = "minimax-h3-reference-to-video";
const longWorkflowId = "minimax-h3-decorolala-ad-15s-v1";
const workflowId = "minimax-h3-decorolala-validation-4s-v1";
const projectWorkflowId = "minimax-h3-project-shot-4s-v1";
const workflowHash = "6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a";
const registry = new WorkflowRegistry(join(process.cwd(), "workflows", "registry.json"));

describe("MiniMax H3 reference-to-video workflow", () => {
  it("preserves longer history while enabling only the four-second validation workflow", async () => {
    const manifests = await registry.manifests();
    expect(manifests).toHaveLength(4);
    expect(manifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workflowId: historicalWorkflowId, enabled: false }),
        expect.objectContaining({ workflowId: longWorkflowId, enabled: false }),
        expect.objectContaining({ workflowId, enabled: false, requiredModels: [] }),
        expect.objectContaining({
          workflowId: projectWorkflowId,
          enabled: true,
          requiredModels: [],
        }),
      ]),
    );

    const loaded = await registry.load(workflowId);
    expect(loaded.actualHash).toBe(workflowHash);
    expect(loaded.hashMatches).toBe(true);
    expect(loaded.bindingErrors).toEqual([]);
    expect(loaded.missingNodeClassesInWorkflow).toEqual([]);
    expect(loaded.manifest.requiredNodeClasses).toEqual([
      "LoadImage",
      "MinimaxHailuo03ReferenceNode",
      "SaveVideo",
    ]);
  });

  it("registers the additive project workflow without changing validated graph bytes", async () => {
    const historical = await registry.load(workflowId);
    const project = await registry.load(projectWorkflowId);
    expect(project.actualHash).toBe(workflowHash);
    expect(project.actualHash).toBe(historical.actualHash);
    expect(project.hashMatches).toBe(true);
    expect(project.bindingErrors).toEqual([]);
  });

  it("binds scene, product, and three character views as ordered H3 references", async () => {
    const prompt = await registry.materialize(projectWorkflowId, workflowHash, {
      character: "comfyuiflow/character.png",
      scene: "comfyuiflow/scene.png",
      product: "comfyuiflow/product.png",
      characterFace: "comfyuiflow/character-face.png",
      characterRear: "comfyuiflow/character-rear.png",
      positivePrompt: "subject_definitions:\n<Subject 1> is Lady LaLa.",
      durationSeconds: 4,
      width: 768,
      height: 1344,
      fps: 24,
    });

    expect(prompt["1"]).toMatchObject({ inputs: { image: "comfyuiflow/scene.png" } });
    expect(prompt["2"]).toMatchObject({ inputs: { image: "comfyuiflow/product.png" } });
    expect(prompt["3"]).toMatchObject({ inputs: { image: "comfyuiflow/character.png" } });
    expect(prompt["4"]).toMatchObject({ inputs: { image: "comfyuiflow/character-face.png" } });
    expect(prompt["5"]).toMatchObject({ inputs: { image: "comfyuiflow/character-rear.png" } });
    expect(prompt["6"]).toMatchObject({
      class_type: "MinimaxHailuo03ReferenceNode",
      inputs: {
        model: "MiniMax H3",
        "model.resolution": "768P",
        "model.ratio": "9:16",
        "model.duration": 4,
        "model.reference_images.image_1": ["1", 0],
        "model.reference_images.image_2": ["2", 0],
        "model.reference_images.image_3": ["3", 0],
        "model.reference_images.image_4": ["4", 0],
        "model.reference_images.image_5": ["5", 0],
        watermark: false,
      },
    });
    expect((prompt["6"] as any).inputs["model.prompt"]).toContain("subject_definitions:");
    expect(prompt["7"]).toMatchObject({
      class_type: "SaveVideo",
      inputs: { video: ["6", 0], format: "mp4", codec: "auto" },
    });
  });
});
