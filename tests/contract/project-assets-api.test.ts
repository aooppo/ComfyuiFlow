import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assetFilterSchema,
  assetPatchSchema,
  assetRoleSchema,
  projectInputSchema,
  projectPatchSchema,
} from "@comfyuiflow/project-core";

describe("Project/Asset HTTP contract", () => {
  it("accepts only bounded owner-facing project and asset changes", () => {
    expect(
      projectInputSchema.parse({
        name: "Coffee table film",
        brief: "A quiet portrait campaign",
        targetAspectRatio: "PORTRAIT_9_16",
      }),
    ).toMatchObject({ name: "Coffee table film" });
    expect(() => projectPatchSchema.parse({})).toThrow();
    expect(() => assetPatchSchema.parse({ sha256: "changed" })).toThrow();
    expect(assetRoleSchema.parse("CHARACTER_FACE")).toBe("CHARACTER_FACE");
    expect(assetFilterSchema.parse({ mediaType: "VIDEO", role: "PRODUCT" })).toEqual({
      mediaType: "VIDEO",
      role: "PRODUCT",
    });
  });

  it("documents every implemented lifecycle, import, preview, and removal route", async () => {
    const contract = await readFile(
      "specs/006-project-asset-workspace/contracts/project-assets.openapi.yaml",
      "utf8",
    );
    for (const route of [
      "/projects:",
      "/projects/{projectId}:",
      "/projects/{projectId}/archive:",
      "/projects/{projectId}/restore:",
      "/projects/{projectId}/assets:",
      "/projects/{projectId}/assets/import:",
      "/assets/{assetId}:",
      "/assets/{assetId}/remove:",
      "/assets/{assetId}/content:",
    ]) {
      expect(contract).toContain(route);
    }
    expect(contract).toContain("No endpoint invokes AI, ComfyUI, or an external upload");
  });
});
