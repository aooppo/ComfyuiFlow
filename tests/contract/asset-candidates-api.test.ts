import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  assetCandidateRequirementSchema,
  assetCandidateResultSchema,
  ProjectAssetError,
} from "@comfyuiflow/project-core";
import { apiError } from "../../apps/project-web/lib/api.js";

const projectId = "11111111-1111-4111-8111-111111111111";

describe("asset candidate preview HTTP contract", () => {
  it("accepts only the frozen v1 request and result wire shapes", () => {
    expect(
      assetCandidateRequirementSchema.parse({
        contractVersion: "asset-candidate-v1",
        projectId,
        requirementId: "shot-1-character",
        assetType: "CHARACTER",
        productionAssetId: "22222222-2222-4222-8222-222222222222",
        referenceUsages: ["FULL_BODY"],
      }),
    ).toMatchObject({
      viewpoints: [],
      shotScales: [],
      mediaCapability: { mediaType: "IMAGE", acceptedMimeTypes: [] },
      policy: { allowUnspecifiedViewpoint: false, allowUnspecifiedShotScale: false },
    });
    expect(() =>
      assetCandidateRequirementSchema.parse({
        contractVersion: "asset-candidate-v2",
        projectId,
        requirementId: "shot-1-character",
        assetType: "CHARACTER",
        productionAssetId: "22222222-2222-4222-8222-222222222222",
        referenceUsages: ["FULL_BODY"],
      }),
    ).toThrow();
    expect(() =>
      assetCandidateResultSchema.parse({
        policyVersion: "deterministic-assets-v1",
        inputHash: "a".repeat(64),
        resolvedIdentity: {
          productionAssetVersionId: "22222222-2222-4222-8222-222222222222",
          characterStateVersionId: null,
          versionId: "22222222-2222-4222-8222-222222222222",
        },
        eligible: [],
        rejected: [
          {
            projectAssetId: "33333333-3333-4333-8333-333333333333",
            productionAssetVersionId: "22222222-2222-4222-8222-222222222222",
            bindingId: "44444444-4444-4444-8444-444444444444",
            matchedRules: [],
            reasonCodes: ["MODEL_GUESSED_MATCH"],
          },
        ],
        gaps: ["NO_ELIGIBLE_CANDIDATE"],
        formalSelectionCreated: false,
      }),
    ).toThrow();
  });

  it("returns stable safe errors for route/project mismatches and unexpected failures", async () => {
    const mismatch = apiError(
      new ProjectAssetError(
        "CROSS_PROJECT",
        "Candidate requirement must match the route project",
        409,
      ),
    );
    expect(mismatch.status).toBe(409);
    await expect(mismatch.json()).resolves.toEqual({
      error: {
        code: "CROSS_PROJECT",
        message: "Candidate requirement must match the route project",
      },
    });

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unexpected = apiError(new Error("/private/storage/key [REDACTED_SECRET]"));
    expect(unexpected.status).toBe(500);
    await expect(unexpected.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed" },
    });
    error.mockRestore();
  });

  it("documents the zero-call preview route and formal-selection boundary", async () => {
    const [openapi, selectionContract, route, previewUi] = await Promise.all([
      readFile("specs/007-asset-understanding/contracts/production-assets.openapi.yaml", "utf8"),
      readFile("specs/007-asset-understanding/contracts/asset-selection-contract.md", "utf8"),
      readFile(
        "apps/project-web/app/api/projects/[projectId]/asset-candidates/preview/route.ts",
        "utf8",
      ),
      readFile("apps/project-web/components/production-assets/asset-candidate-preview.tsx", "utf8"),
    ]);
    expect(openapi).toContain("/api/projects/{projectId}/asset-candidates/preview:");
    expect(openapi).toContain("formalSelectionCreated");
    expect(selectionContract).toContain("Phase 2 API 始终返回 `formalSelectionCreated=false`");
    expect(previewUi).toContain("result.inputHash.slice(0, 12)");
    expect(previewUi).toContain("item.reasonCodes.map");
    expect(previewUi).toContain("candidateConclusion blocked");
    expect(previewUi).toContain("candidateDiagnostics");
    expect(previewUi).toContain("当前没有可用的候选素材");
    expect(previewUi).not.toContain("result.resultHash");
    expect(previewUi).not.toContain("item.reasons.join");
    expect(route).toContain('"CROSS_PROJECT"');
  });
});
