import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";

const workflowId = "wan22-ti2v-5b-dual-reference";
const registry = new WorkflowRegistry(join(process.cwd(), "workflows", "registry.json"));

describe("Wan2.2 dual-reference workflow", () => {
  it("is hash locked and routes both references into the Wan start frame", async () => {
    const loaded = await registry.load(workflowId);
    expect(loaded.hashMatches).toBe(true);
    expect(loaded.bindingErrors).toEqual([]);
    expect(loaded.missingNodeClassesInWorkflow).toEqual([]);

    const prompt = await registry.materialize(workflowId, loaded.actualHash, {
      character: "comfyuiflow/character.png",
      scene: "comfyuiflow/scene.png",
      positivePrompt: "The character takes one step and looks toward camera.",
      durationSeconds: 2.0625,
      width: 512,
      height: 288,
      fps: 16,
    });

    expect(prompt["1"]).toMatchObject({ inputs: { image: "comfyuiflow/character.png" } });
    expect(prompt["2"]).toMatchObject({ inputs: { image: "comfyuiflow/scene.png" } });
    expect(prompt["9"]).toMatchObject({
      class_type: "ImageCompositeMasked",
      inputs: { destination: ["3", 0], source: ["4", 0], mask: ["8", 0] },
    });
    expect(prompt["16"]).toMatchObject({
      class_type: "Wan22ImageToVideoLatent",
      inputs: { start_image: ["9", 0], width: 512, height: 288, length: 33 },
    });
    expect(prompt["20"]).toMatchObject({
      class_type: "SaveVideo",
      inputs: { format: "mp4", codec: "h264" },
    });
  });

  it("contains only the reviewed local core-node allowlist", async () => {
    const loaded = await registry.load(workflowId);
    const nodeClasses = new Set(
      Object.values(loaded.workflow).map((node) => (node as { class_type: string }).class_type),
    );
    expect([...nodeClasses].sort()).toEqual([...loaded.manifest.requiredNodeClasses].sort());
    expect([...nodeClasses].some((nodeClass) => /Api|HTTP|Webhook/i.test(nodeClass))).toBe(false);
  });
});
