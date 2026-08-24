import { describe, expect, it } from "vitest";
import {
  characterStateComponentSchema,
  createCharacterStateSchema,
} from "@comfyuiflow/project-core";

describe("character state contract", () => {
  it("accepts only composition slots and excludes ordinary Props", () => {
    expect(createCharacterStateSchema.parse({ stateKey: "gala", name: "Gala" })).toMatchObject({
      stateKey: "gala",
    });
    expect(
      characterStateComponentSchema.parse({
        slotType: "OUTFIT",
        componentAssetVersionId: "11111111-1111-4111-8111-111111111111",
        slotKey: "dress",
        sortOrder: 0,
        required: true,
      }),
    ).toMatchObject({ slotType: "OUTFIT" });
    expect(() =>
      characterStateComponentSchema.parse({
        slotType: "PROP",
        componentAssetVersionId: "11111111-1111-4111-8111-111111111111",
        slotKey: "umbrella",
        sortOrder: 0,
        required: true,
      }),
    ).toThrow();
  });
});
