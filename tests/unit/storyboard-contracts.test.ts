import { describe, expect, it } from "vitest";
import {
  AiTaskRequestSchema,
  ShotSpecificationSchema,
  StoryboardGenerationRequestV1Schema,
  StoryboardProposalV1Schema,
} from "@comfyuiflow/contracts";
import { canonicalJson, canonicalSha256 } from "../../packages/project-core/src/canonical-json.js";
import {
  assetCandidateRequirementSchema,
  canonicalCandidateRequirementHash,
} from "@comfyuiflow/project-core";
import {
  PHASE2_STORYBOARD_BINDINGS_ENV,
  storyboardGate,
} from "../../packages/project-core/src/storyboard-gate.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const storyboardId = "22222222-2222-4222-8222-222222222222";

describe("storyboard contracts", () => {
  it("canonicalizes nested object keys recursively without reordering arrays", () => {
    const left = {
      z: [{ beta: 2, alpha: 1 }, "second"],
      a: { y: true, x: { d: null, c: 3 } },
    };
    const right = {
      a: { x: { c: 3, d: null }, y: true },
      z: [{ alpha: 1, beta: 2 }, "second"],
    };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(canonicalSha256(left)).toBe(canonicalSha256(right));
    expect(canonicalSha256({ values: [1, 2] })).not.toBe(canonicalSha256({ values: [2, 1] }));
  });

  it("rejects values that cannot be represented as stable JSON", () => {
    expect(() => canonicalJson({ missing: undefined })).toThrow();
    expect(() => canonicalJson({ invalid: Number.NaN })).toThrow();
    expect(() => canonicalJson(new Date())).toThrow();
  });

  it("includes nested candidate policy and capability fields in the canonical hash", () => {
    const requirement = assetCandidateRequirementSchema.parse({
      contractVersion: "asset-candidate-v1",
      projectId,
      requirementId: "shot-1-character",
      assetType: "CHARACTER",
      productionAssetId: "33333333-3333-4333-8333-333333333333",
      referenceUsages: ["IDENTITY"],
      viewpoints: ["FRONT"],
      shotScales: ["MEDIUM"],
      mediaCapability: { mediaType: "IMAGE", acceptedMimeTypes: ["image/png"] },
      policy: { allowUnspecifiedViewpoint: false, allowUnspecifiedShotScale: false },
    });
    const relaxed = assetCandidateRequirementSchema.parse({
      ...requirement,
      policy: { ...requirement.policy, allowUnspecifiedViewpoint: true },
    });

    expect(canonicalCandidateRequirementHash(requirement)).not.toBe(
      canonicalCandidateRequirementHash(relaxed),
    );
  });

  it("validates the versioned three-shot request and rejects malformed proposals", () => {
    const request = StoryboardGenerationRequestV1Schema.parse({
      taskType: "STORYBOARD_GENERATION_V1",
      contractVersion: "storyboard-generation-v1",
      modelRef: { providerId: "fake", modelId: "storyboard-fake-v1" },
      projectId,
      storyboardId,
      creativeBrief: "Lala presents a coffee table in a quiet vertical film.",
      shotCount: 3,
      promptTemplateVersion: "storyboard-three-shot-v1",
      assetRequirements: [],
    });
    expect(request.shotCount).toBe(3);

    const shot = {
      schemaVersion: "shot-draft-v1" as const,
      shotKey: "44444444-4444-4444-8444-444444444444",
      ordinal: 1,
      title: "Opening",
      creativeDescription: "Establish the product and character.",
      startState: "The room is still.",
      action: "Lala approaches the table.",
      endState: "Lala reaches the table.",
      camera: "Locked medium-wide portrait shot.",
      composition: "Lala and the table remain legible.",
      continuityRequirements: ["Preserve identity and wardrobe."],
      durationSeconds: 2,
      assetRequirements: [],
    };
    expect(() =>
      StoryboardProposalV1Schema.parse({
        providerId: "fake",
        requestedModelId: "storyboard-fake-v1",
        resolvedModelId: "storyboard-fake-v1",
        responseId: "fake:proposal",
        contractVersion: "storyboard-proposal-v1",
        promptTemplateVersion: "storyboard-three-shot-v1",
        shots: [shot, { ...shot, ordinal: 2 }, { ...shot, ordinal: 2 }],
        providerMetadata: { fake: true, providerCalls: 0 },
      }),
    ).toThrow();
  });

  it("keeps the legacy one-shot request and response contracts unchanged", () => {
    expect(
      AiTaskRequestSchema.parse({
        taskType: "STORYBOARD_GENERATION",
        modelRef: { providerId: "dry-run", modelId: "dry-run-director" },
        creativeDescription: "One shot",
        imageInputs: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            role: "CHARACTER",
            originalPath: "/original/character.png",
            storedPath: "/stored/character.png",
            originalFilename: "character.png",
            mimeType: "image/png",
            byteSize: 1,
            sha256: "a".repeat(64),
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            role: "SCENE",
            originalPath: "/original/scene.png",
            storedPath: "/stored/scene.png",
            originalFilename: "scene.png",
            mimeType: "image/png",
            byteSize: 1,
            sha256: "b".repeat(64),
          },
        ],
        promptTemplateVersion: "director-one-shot-v1",
        metadata: {},
      }).taskType,
    ).toBe("STORYBOARD_GENERATION");
    expect(ShotSpecificationSchema.shape.promptTemplateVersion.value).toBe("director-one-shot-v1");
  });

  it("keeps formal Storyboard binding closed unless the server value is exactly true", () => {
    expect(storyboardGate({}).phase2BindingsEnabled).toBe(false);
    expect(
      storyboardGate({ [PHASE2_STORYBOARD_BINDINGS_ENV]: "false" }).phase2BindingsEnabled,
    ).toBe(false);
    expect(storyboardGate({ [PHASE2_STORYBOARD_BINDINGS_ENV]: "TRUE" }).phase2BindingsEnabled).toBe(
      false,
    );
    expect(storyboardGate({ [PHASE2_STORYBOARD_BINDINGS_ENV]: "true" }).phase2BindingsEnabled).toBe(
      true,
    );
  });
});
