import { describe, expect, it } from "vitest";
import { normalizeExecutionInputRole } from "../../apps/comfyui-mcp/src/execution-plan-store.js";

describe("ComfyUI execution-plan input roles", () => {
  it("normalizes requirement bindings to the bridge allowlist", () => {
    expect(normalizeExecutionInputRole("scene")).toBe("SCENE");
    expect(normalizeExecutionInputRole("product")).toBe("PRODUCT");
    expect(normalizeExecutionInputRole("character_full_body")).toBe("CHARACTER_FULL_BODY");
    expect(normalizeExecutionInputRole("character_face")).toBe("CHARACTER_FACE");
    expect(normalizeExecutionInputRole("character_rear")).toBe("CHARACTER_REAR");
    expect(normalizeExecutionInputRole("first_frame")).toBeNull();
    expect(normalizeExecutionInputRole("endpoint")).toBeNull();
  });
});
