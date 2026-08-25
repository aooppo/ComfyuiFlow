import { describe, expect, it } from "vitest";
import {
  buildContinuitySuggestion,
  normalizeKeyframeImage,
  preflightContinuityData,
} from "@comfyuiflow/project-core";

const shots = [1, 2, 3].map((ordinal) => ({
  id: crypto.randomUUID(),
  ordinal,
  title: `Shot ${ordinal}`,
  startState: `start-${ordinal}`,
  endState: `end-${ordinal}`,
  camera: `camera-${ordinal}`,
  composition: `composition-${ordinal}`,
}));

describe("continuity registry and zero-call preflight", () => {
  it("creates N+1 boundaries shared by adjacent shots", () => {
    const suggestion = buildContinuitySuggestion({
      assets: [
        {
          subjectKey: "environment:room",
          kind: "ENVIRONMENT",
          label: "客厅",
          sourceSha256: "a".repeat(64),
          facts: { layout: "approved" },
        },
      ],
      shots,
    });

    expect(suggestion.boundaries).toHaveLength(4);
    expect(suggestion.shots[0]?.endBoundaryIndex).toBe(suggestion.shots[1]?.startBoundaryIndex);
    expect(suggestion.shots[1]?.endBoundaryIndex).toBe(suggestion.shots[2]?.startBoundaryIndex);
    const result = preflightContinuityData(crypto.randomUUID(), suggestion);
    expect(result.externalCalls).toBe(0);
    expect(result.ready).toBe(true);
  });

  it("blocks an undeclared hard whole-film change with business actions", () => {
    const suggestion = buildContinuitySuggestion({
      assets: [
        {
          subjectKey: "prop:wine-glass",
          kind: "PROP",
          label: "酒杯",
          sourceSha256: "b".repeat(64),
          facts: { state: "in hand" },
        },
      ],
      shots,
    });
    suggestion.boundaries[2]!.state["prop:wine-glass"] = { state: "on table" };

    const result = preflightContinuityData(crypto.randomUUID(), suggestion);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "WHOLE_FILM_HOLD_CONFLICT",
          subjectKey: "prop:wine-glass",
          boundaryIndex: 2,
          actions: expect.arrayContaining(["INHERIT_PREVIOUS", "DECLARE_SHOT_CHANGE"]),
        }),
      ]),
    );
  });

  it("records provider dimensions and normalizes deterministically to H3 portrait", async () => {
    const providerPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEklEQVR4nGNkYPjLwMDAwgAGAAsXAQPfmWhAAAAAAElFTkSuQmCC",
      "base64",
    );
    const normalized = await normalizeKeyframeImage(providerPng, "image/png");
    expect(normalized).toMatchObject({
      width: 768,
      height: 1344,
      originalWidth: 2,
      originalHeight: 2,
      normalized: true,
    });
    expect(normalized.bytes.byteLength).toBeGreaterThan(providerPng.byteLength);
  });
});
