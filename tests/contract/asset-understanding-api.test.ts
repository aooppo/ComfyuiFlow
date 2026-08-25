import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  analysisConfirmSchema,
  analysisPreviewSchema,
  understandingApplicationSchema,
  understandingCorrectionSchema,
  understandingReviewSchema,
} from "@comfyuiflow/project-core";

const assetId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "owner-action-0001";

describe("asset understanding HTTP contract", () => {
  it("keeps preview zero-call defaults and confirmation explicit", () => {
    expect(analysisPreviewSchema.parse({ assetIds: [assetId] })).toEqual({
      assetIds: [assetId],
      providerId: "fake",
      modelId: "asset-understanding-fake-v1",
    });
    expect(() => analysisPreviewSchema.parse({ assetIds: [assetId, assetId] })).toThrow(/unique/);
    expect(() =>
      analysisConfirmSchema.parse({
        manifestHash: "a".repeat(64),
        acknowledgeExternalImageUpload: false,
        idempotencyKey,
      }),
    ).toThrow();
    expect(
      analysisConfirmSchema.parse({
        manifestHash: "a".repeat(64),
        acknowledgeExternalImageUpload: true,
        idempotencyKey,
      }),
    ).toMatchObject({ acknowledgeExternalImageUpload: true });
  });

  it("separates review, correction, and explicit draft-target application DTOs", () => {
    expect(
      understandingReviewSchema.parse({
        decision: "REJECTED",
        notes: "Identity is uncertain",
        idempotencyKey,
      }),
    ).toMatchObject({ decision: "REJECTED" });
    const corrected = understandingCorrectionSchema.parse({
      acceptCorrection: true,
      idempotencyKey,
      facts: {
        summary: "Owner-corrected observation",
        directObservations: ["Full body is visible"],
        uncertainInterpretations: [],
        confidence: "HIGH",
      },
    });
    expect(corrected.facts.qualityFacts).toEqual({
      sharpnessConfidence: null,
      exposureConfidence: null,
      subjectVisibility: null,
      usableFrameCoverage: null,
    });
    expect(
      understandingApplicationSchema.parse({
        targetType: "ASSET_VERSION_FILE_DRAFT",
        targetId,
        fieldMappings: [{ sourceField: "viewpointSuggestion", targetField: "viewpoint" }],
        idempotencyKey,
      }),
    ).toMatchObject({ targetType: "ASSET_VERSION_FILE_DRAFT", targetId });
    expect(() =>
      understandingApplicationSchema.parse({
        targetType: "PUBLISHED_VERSION",
        targetId,
        fieldMappings: [{ sourceField: "summary", targetField: "description" }],
        idempotencyKey,
      }),
    ).toThrow();
  });

  it("documents and implements Preview, Run, History, Review, Correction, and Application routes", async () => {
    const openapi = await readFile(
      "specs/007-asset-understanding/contracts/production-assets.openapi.yaml",
      "utf8",
    );
    for (const route of [
      "/api/projects/{projectId}/asset-analyses/preview:",
      "/api/projects/{projectId}/asset-analyses:",
      "/api/asset-analyses/{runId}:",
      "/api/project-assets/{assetId}/understanding:",
      "/api/understanding-revisions/{revisionId}/reviews:",
      "/api/understanding-revisions/{revisionId}/corrections:",
      "/api/understanding-revisions/{revisionId}/applications:",
    ]) {
      expect(openapi).toContain(route);
    }

    const routeSources = await Promise.all([
      readFile(
        "apps/project-web/app/api/projects/[projectId]/asset-analyses/preview/route.ts",
        "utf8",
      ),
      readFile("apps/project-web/app/api/projects/[projectId]/asset-analyses/route.ts", "utf8"),
      readFile("apps/project-web/app/api/asset-analyses/[runId]/route.ts", "utf8"),
      readFile("apps/project-web/app/api/project-assets/[assetId]/understanding/route.ts", "utf8"),
      readFile(
        "apps/project-web/app/api/understanding-revisions/[revisionId]/reviews/route.ts",
        "utf8",
      ),
      readFile(
        "apps/project-web/app/api/understanding-revisions/[revisionId]/corrections/route.ts",
        "utf8",
      ),
      readFile(
        "apps/project-web/app/api/understanding-revisions/[revisionId]/applications/route.ts",
        "utf8",
      ),
    ]);
    for (const source of routeSources) expect(source).toContain("apiError(error)");
  });
});
