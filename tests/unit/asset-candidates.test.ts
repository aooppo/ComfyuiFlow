import { describe, expect, it } from "vitest";
import {
  assetCandidateRequirementSchema,
  canonicalCandidateRequirementHash,
} from "@comfyuiflow/project-core";

const requirement = {
  contractVersion: "asset-candidate-v1" as const,
  projectId: "11111111-1111-4111-8111-111111111111",
  requirementId: "lala-gala-full-body",
  assetType: "CHARACTER" as const,
  productionAssetId: "22222222-2222-4222-8222-222222222222",
  referenceUsages: ["FULL_BODY" as const],
  viewpoints: ["FRONT" as const],
  shotScales: ["FULL" as const],
  mediaCapability: {
    mediaType: "IMAGE" as const,
    acceptedMimeTypes: ["image/png"],
    minimumWidth: 1024,
  },
  policy: { allowUnspecifiedViewpoint: false, allowUnspecifiedShotScale: false },
};

describe("asset candidate contract", () => {
  it("requires a stable identity and produces a deterministic request fingerprint", () => {
    const parsed = assetCandidateRequirementSchema.parse(requirement);
    expect(canonicalCandidateRequirementHash(parsed)).toBe(
      canonicalCandidateRequirementHash(parsed),
    );
    expect(() =>
      assetCandidateRequirementSchema.parse({ ...requirement, productionAssetId: undefined }),
    ).toThrow();
  });
});
