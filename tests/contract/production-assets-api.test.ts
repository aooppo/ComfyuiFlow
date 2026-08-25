import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assetVersionFileInputSchema,
  createProductionAssetSchema,
  createProductionAssetVersionSchema,
  ifMatchRowVersionSchema,
  productionAssetRelationInputSchema,
} from "@comfyuiflow/project-core";

describe("production asset HTTP contract", () => {
  it("keeps identity, version, file binding, and relation inputs separate and strict", () => {
    expect(createProductionAssetSchema.parse({ type: "OUTFIT", name: "Gala dress" })).toMatchObject(
      { type: "OUTFIT", name: "Gala dress" },
    );
    expect(
      createProductionAssetVersionSchema.parse({
        basedOnVersionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toMatchObject({ basedOnVersionId: "11111111-1111-4111-8111-111111111111" });
    expect(
      assetVersionFileInputSchema.parse({
        projectAssetId: "22222222-2222-4222-8222-222222222222",
        referenceUsage: "OUTFIT_DETAIL",
      }),
    ).toMatchObject({ viewpoint: "UNSPECIFIED", shotScale: "UNSPECIFIED", isPreferred: false });
    expect(
      productionAssetRelationInputSchema.parse({
        toAssetVersionId: "33333333-3333-4333-8333-333333333333",
        relationType: "COMPATIBLE_WITH",
      }),
    ).toMatchObject({ relationType: "COMPATIBLE_WITH" });
    expect(() =>
      assetVersionFileInputSchema.parse({
        projectAssetId: "22222222-2222-4222-8222-222222222222",
        referenceUsage: "OUTFIT_DETAIL",
        storageKey: "private/path",
      }),
    ).toThrow();
  });

  it("parses a bounded If-Match row version and rejects weak or malformed values", () => {
    expect(ifMatchRowVersionSchema.parse('"42"')).toBe(42);
    expect(() => ifMatchRowVersionSchema.parse("42")).toThrow();
    expect(() => ifMatchRowVersionSchema.parse('W/"42"')).toThrow();
    expect(() => ifMatchRowVersionSchema.parse('"9007199254740992"')).toThrow();
  });

  it("documents create, version, bind, relation, and immutable publish operations", async () => {
    const [contract, service, library] = await Promise.all([
      readFile("specs/007-asset-understanding/contracts/production-assets.openapi.yaml", "utf8"),
      readFile("packages/project-core/src/production-asset-service.ts", "utf8"),
      readFile(
        "apps/project-web/components/production-assets/production-asset-library.tsx",
        "utf8",
      ),
    ]);
    for (const route of [
      "/api/projects/{projectId}/production-assets:",
      "/api/production-assets/{assetId}/versions:",
      "/api/production-asset-versions/{versionId}/files:",
      "/api/production-asset-versions/{versionId}/relations:",
      "/api/production-asset-versions/{versionId}/publish:",
    ]) {
      expect(contract).toContain(route);
    }
    expect(contract).toContain("Atomically publish an immutable active version");
    expect(contract).toContain("name: If-Match");
    expect(service).toContain("fromRelations:");
    expect(service).toContain("toRelations:");
    expect(library).toContain("View details");
    expect(library).toContain("CollapsibleDraftActions");
    expect(library).toContain('expanded ? "Collapse draft" : "Edit draft"');
    expect(library).toContain("Create draft from this version");
    expect(library).toContain("basedOnVersionId");
  });
});
