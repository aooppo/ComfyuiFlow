import { describe, expect, it } from "vitest";
import { analyzeShotRequirementsV3 } from "@comfyuiflow/project-core";

const shotId = "8fd62386-445f-4d9f-a337-087cbc201575";
const specId = "69ce3acd-c810-44ec-8f26-02d62190e028";
const revision = { id: "storyboard.revision", version: "7" };

describe("Workflow Agent per-Shot V3 requirements", () => {
  it("omits Character and Character State blockers for a no-person environment Shot", () => {
    const result = analyzeShotRequirementsV3({
      specId,
      version: "1",
      shotId,
      storyboardRevisionRef: revision,
      semantics: {
        personPresent: false,
        explicitCharacterIdentityRequired: false,
        appearanceContinuityRequired: false,
        productIdentityRequired: false,
        environmentIdentityRequired: false,
        styleReferenceDesired: false,
        previousFinalFrameRequired: false,
        motionReferenceRequired: false,
        audioReferenceRequired: false,
      },
      selectedEvidencePurposes: [],
    });
    expect(result.purposes.find((item) => item.purpose === "CHARACTER")).toMatchObject({
      necessity: "OMITTED",
      reasonCode: "NO_EXPLICIT_CHARACTER_NEED",
    });
    expect(result.purposes.filter((item) => item.necessity === "REQUIRED")).toEqual([]);
  });

  it("requires only the exact product, character, continuity, motion, and audio purposes", () => {
    const result = analyzeShotRequirementsV3({
      specId,
      version: "1",
      shotId,
      storyboardRevisionRef: revision,
      semantics: {
        personPresent: true,
        explicitCharacterIdentityRequired: true,
        appearanceContinuityRequired: true,
        productIdentityRequired: true,
        environmentIdentityRequired: false,
        styleReferenceDesired: false,
        previousFinalFrameRequired: true,
        motionReferenceRequired: true,
        audioReferenceRequired: true,
      },
      selectedEvidencePurposes: ["ENVIRONMENT"],
    });
    expect(
      result.purposes.filter((item) => item.necessity === "REQUIRED").map((item) => item.purpose),
    ).toEqual(["AUDIO", "CHARACTER", "CONTINUITY", "MOTION", "PRODUCT"]);
    expect(result.purposes.find((item) => item.purpose === "ENVIRONMENT")).toMatchObject({
      necessity: "OPTIONAL",
      reasonCode: "OWNER_SELECTED_OPTIONAL_EVIDENCE",
    });
  });

  it("returns identical ordered purposes, reasons, and hash across 100 runs", () => {
    const input = {
      specId,
      version: "1",
      shotId,
      storyboardRevisionRef: revision,
      semantics: {
        personPresent: true,
        explicitCharacterIdentityRequired: false,
        appearanceContinuityRequired: false,
        productIdentityRequired: false,
        environmentIdentityRequired: true,
        styleReferenceDesired: true,
        previousFinalFrameRequired: false,
        motionReferenceRequired: false,
        audioReferenceRequired: false,
      },
      selectedEvidencePurposes: ["PRODUCT" as const],
    };
    const results = Array.from({ length: 100 }, () => analyzeShotRequirementsV3(input));
    expect(new Set(results.map((item) => JSON.stringify(item))).size).toBe(1);
    expect(new Set(results.map((item) => item.requirementHash)).size).toBe(1);
  });
});
