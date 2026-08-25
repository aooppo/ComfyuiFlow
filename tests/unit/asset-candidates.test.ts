import { describe, expect, it } from "vitest";
import {
  AssetCandidateService,
  assetCandidateResultSchema,
  assetCandidateRequirementSchema,
  canonicalCandidateRequirementHash,
  compareAssetCandidateRank,
  evaluateAssetCandidate,
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

  it("canonicalizes nested object keys and rejects duplicate hard requirements", () => {
    const parsed = assetCandidateRequirementSchema.parse(requirement);
    const reordered = {
      ...parsed,
      policy: {
        allowUnspecifiedShotScale: parsed.policy.allowUnspecifiedShotScale,
        allowUnspecifiedViewpoint: parsed.policy.allowUnspecifiedViewpoint,
      },
      mediaCapability: {
        minimumWidth: parsed.mediaCapability.minimumWidth,
        acceptedMimeTypes: parsed.mediaCapability.acceptedMimeTypes,
        mediaType: parsed.mediaCapability.mediaType,
      },
    };
    expect(canonicalCandidateRequirementHash(reordered)).toBe(
      canonicalCandidateRequirementHash(parsed),
    );
    expect(() =>
      assetCandidateRequirementSchema.parse({
        ...requirement,
        referenceUsages: ["FULL_BODY", "FULL_BODY"],
      }),
    ).toThrow(/duplicates/);
  });

  it("applies hard filters in stable order and never restores an invalid preferred candidate", () => {
    const input = assetCandidateRequirementSchema.parse({
      ...requirement,
      characterStateVersionId: "33333333-3333-4333-8333-333333333333",
    });
    const decision = evaluateAssetCandidate(
      input,
      {
        id: "44444444-4444-4444-8444-444444444444",
        projectId: "99999999-9999-4999-8999-999999999999",
        productionAssetVersionId: "88888888-8888-4888-8888-888888888888",
        assetType: "OUTFIT",
        productionAssetStatus: "INACTIVE",
        productionAssetVersionStatus: "RETIRED",
        bindingStatus: "INACTIVE",
        projectAssetStatus: "INVALID",
        approvalStatus: "SUGGESTED",
        referenceUsage: "FACE",
        viewpoint: "REAR",
        shotScale: "CLOSE_UP",
        mediaType: "VIDEO",
        detectedMimeType: "video/mp4",
        width: 8_192,
        height: 8_192,
        isPreferred: true,
      },
      {
        expectedVersionId: "77777777-7777-4777-8777-777777777777",
        characterStateMatches: false,
      },
    );
    expect(decision.reasonCodes).toEqual([
      "CROSS_PROJECT",
      "WRONG_IDENTITY",
      "WRONG_VERSION",
      "WRONG_CHARACTER_STATE",
      "INACTIVE_ASSET",
      "FILE_NOT_READY",
      "UNAPPROVED_BINDING",
      "REFERENCE_USAGE_MISSING",
      "VIEWPOINT_MISMATCH",
      "SHOT_SCALE_MISMATCH",
      "MEDIA_CAPABILITY_MISMATCH",
    ]);
    expect(decision.scoreFacts).toMatchObject({ preferred: 1, effectivePixels: 67_108_864 });
  });

  it("uses explainable score facts, creation order, and binding id as deterministic tie breakers", () => {
    const base = {
      scoreFacts: {
        preferred: 0,
        usageExact: 1,
        viewpointExact: 1,
        shotScaleExact: 1,
        probeComplete: 1,
        effectivePixels: 1_000,
      },
    };
    const older = {
      ...base,
      bindingId: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const newer = {
      ...base,
      bindingId: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    expect([newer, older].sort(compareAssetCandidateRank).map((item) => item.bindingId)).toEqual([
      older.bindingId,
      newer.bindingId,
    ]);
    expect(
      [{ ...older, createdAt: newer.createdAt }, { ...newer }]
        .sort(compareAssetCandidateRank)
        .map((item) => item.bindingId),
    ).toEqual([newer.bindingId, older.bindingId]);
  });

  it("validates the complete stable candidate result DTO", () => {
    expect(
      assetCandidateResultSchema.parse({
        policyVersion: "deterministic-assets-v1",
        inputHash: "a".repeat(64),
        resolvedIdentity: {
          productionAssetVersionId: "22222222-2222-4222-8222-222222222222",
          characterStateVersionId: null,
          versionId: "22222222-2222-4222-8222-222222222222",
        },
        eligible: [
          {
            projectAssetId: "33333333-3333-4333-8333-333333333333",
            productionAssetVersionId: "22222222-2222-4222-8222-222222222222",
            bindingId: "44444444-4444-4444-8444-444444444444",
            matchedRules: ["PROJECT_MATCH", "IDENTITY_MATCH", "OWNER_APPROVED"],
            scoreFacts: {
              preferred: 1,
              usageExact: 1,
              viewpointExact: 1,
              shotScaleExact: 1,
              probeComplete: 1,
              effectivePixels: 4_194_304,
            },
          },
        ],
        rejected: [],
        gaps: [],
        formalSelectionCreated: false,
      }),
    ).toMatchObject({
      formalSelectionCreated: false,
      eligible: [{ matchedRules: expect.any(Array) }],
    });
  });

  it("integrates the pure policy without creating a formal selection or recovering rejected rows", async () => {
    const input = assetCandidateRequirementSchema.parse({
      ...requirement,
      productionAssetId: undefined,
      productionAssetVersionId: "22222222-2222-4222-8222-222222222222",
    });
    const baseBinding = {
      projectId: input.projectId,
      productionAssetVersionId: input.productionAssetVersionId,
      status: "ACTIVE",
      approvalStatus: "ACCEPTED",
      referenceUsage: "FULL_BODY",
      viewpoint: "FRONT",
      shotScale: "FULL",
      isPreferred: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      projectAsset: {
        status: "READY",
        mediaType: "IMAGE",
        width: 1_024,
        height: 1_024,
        storedObject: { detectedMimeType: "image/png" },
      },
      productionAssetVersion: {
        status: "ACTIVE",
        productionAsset: { type: "CHARACTER", status: "ACTIVE" },
      },
    };
    const client = {
      productionAssetVersion: {
        findUnique: async () => ({
          id: input.productionAssetVersionId,
          projectId: input.projectId,
          status: "ACTIVE",
          productionAsset: { type: "CHARACTER" },
        }),
      },
      assetVersionFile: {
        findMany: async () => [
          {
            ...baseBinding,
            id: "33333333-3333-4333-8333-333333333333",
            projectAssetId: "44444444-4444-4444-8444-444444444444",
          },
          {
            ...baseBinding,
            id: "55555555-5555-4555-8555-555555555555",
            projectAssetId: "66666666-6666-4666-8666-666666666666",
            isPreferred: true,
            referenceUsage: "FACE",
            projectAsset: { ...baseBinding.projectAsset, width: 8_192, height: 8_192 },
          },
        ],
      },
    };
    const result = await new AssetCandidateService(client as never).preview(input);
    expect(result).toMatchObject({
      policyVersion: "deterministic-assets-v1",
      formalSelectionCreated: false,
      eligible: [{ bindingId: "33333333-3333-4333-8333-333333333333" }],
      rejected: [
        {
          bindingId: "55555555-5555-4555-8555-555555555555",
          reasonCodes: ["REFERENCE_USAGE_MISSING"],
        },
      ],
      gaps: [],
    });
    expect(result.inputHash).toBe(canonicalCandidateRequirementHash(input));
  });
});
