import { describe, expect, it } from "vitest";
import {
  assetVersionFileInputSchema,
  createProductionAssetSchema,
} from "@comfyuiflow/project-core";

describe("production asset contract", () => {
  it("keeps semantic identity separate from READY source-file bindings", () => {
    expect(createProductionAssetSchema.parse({ type: "OUTFIT", name: "Gala dress" })).toMatchObject(
      { type: "OUTFIT" },
    );
    expect(
      assetVersionFileInputSchema.parse({
        projectAssetId: "11111111-1111-4111-8111-111111111111",
        referenceUsage: "OUTFIT_DETAIL",
      }),
    ).toMatchObject({ viewpoint: "UNSPECIFIED", shotScale: "UNSPECIFIED" });
  });
});
