import { describe, expect, it } from "vitest";
import {
  appendStoryboardVersionSchema,
  createStoryboardSchema,
  parseStoryboardEtag,
  storyboardDecisionSchema,
  storyboardEtag,
  storyboardResolutionSchema,
} from "@comfyuiflow/project-core";

describe("storyboard service contracts", () => {
  it("parses safe create input and strict ETags", () => {
    expect(createStoryboardSchema.parse({ title: "Launch", creativeBrief: "Three shots" })).toEqual(
      {
        title: "Launch",
        creativeBrief: "Three shots",
      },
    );
    expect(storyboardEtag(7)).toBe('"storyboard-7"');
    expect(parseStoryboardEtag('"storyboard-7"')).toBe(7);
    expect(parseStoryboardEtag("7")).toBeNull();
  });

  it("accepts 1-20 contiguous unique shots and rejects empty or malformed payloads", () => {
    const shot = (ordinal: number) => ({
      schemaVersion: "shot-draft-v1" as const,
      shotKey: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
      ordinal,
      title: `Shot ${ordinal}`,
      creativeDescription: "Description",
      startState: "Start",
      action: "Action",
      endState: "End",
      camera: "Camera",
      composition: "Composition",
      continuityRequirements: [],
      durationSeconds: 3,
      assetRequirements: [],
    });
    expect(
      appendStoryboardVersionSchema.parse({
        parentVersionId: null,
        creativeBrief: "Work in progress",
        shots: Array.from({ length: 20 }, (_, index) => shot(index + 1)),
        includeProjectAssetRequirements: true,
      }).shots,
    ).toHaveLength(20);
    expect(() =>
      appendStoryboardVersionSchema.parse({
        parentVersionId: null,
        creativeBrief: "Empty",
        shots: [],
      }),
    ).toThrow();
    expect(() =>
      appendStoryboardVersionSchema.parse({
        parentVersionId: null,
        creativeBrief: "Gapped",
        shots: [shot(1), shot(3)],
      }),
    ).toThrow();
    expect(() =>
      appendStoryboardVersionSchema.parse({
        parentVersionId: null,
        creativeBrief: "Invalid",
        shots: [{ ordinal: 1 }],
      }),
    ).toThrow();
  });

  it("supports an empty but frozen resolution for versions with no requirements", () => {
    const hash = "a".repeat(64);
    expect(storyboardResolutionSchema.parse({ candidateResultHash: hash, selections: [] })).toEqual(
      {
        candidateResultHash: hash,
        selections: [],
      },
    );
    expect(storyboardDecisionSchema.parse({ decision: "APPROVED" })).toEqual({
      decision: "APPROVED",
    });
  });
});
