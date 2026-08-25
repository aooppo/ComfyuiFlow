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

  it("allows incomplete saved drafts but rejects malformed shot payloads", () => {
    expect(
      appendStoryboardVersionSchema.parse({
        parentVersionId: null,
        creativeBrief: "Work in progress",
        shots: [],
      }).shots,
    ).toEqual([]);
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
