import { describe, expect, it } from "vitest";
import {
  buildContinuitySuggestion,
  compileContinuityKeyframePrompt,
  keyframeReferencePriority,
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

  it("carries approved dynamic props through every boundary with declared shot changes", () => {
    const suggestion = buildContinuitySuggestion({
      assets: [
        {
          subjectKey: "prop:wine-glass",
          kind: "PROP",
          label: "red wine glass",
          sourceSha256: "c".repeat(64),
          defaultPolicy: "SHOT_CHANGE",
          facts: { dynamicCandidate: true },
        },
      ],
      shots,
    });
    const subject = suggestion.subjects.find((item) => item.subjectKey === "prop:wine-glass");
    expect(subject?.rules[0]?.policy).toBe("SHOT_CHANGE");
    expect(suggestion.boundaries).toHaveLength(4);
    expect(suggestion.boundaries[1]?.state["prop:wine-glass"]).toMatchObject({
      physicalPresence: "PRESENT",
      visibility: "UNSPECIFIED",
      instantaneousState: "end-1",
    });
    expect(suggestion.shots.every((shot) => shot.declaredChanges["prop:wine-glass"])).toBe(true);
    expect(preflightContinuityData(crypto.randomUUID(), suggestion).ready).toBe(true);
  });

  it("keeps not-emphasized props physically present instead of deleting them", () => {
    const continuityShots = [
      {
        ...shots[0]!,
        endState: "酒杯留在咖啡桌上，但下一镜不强调酒杯",
      },
      {
        ...shots[1]!,
        startState: "酒杯不作为画面重点，人物走向沙发",
      },
      shots[2]!,
    ];
    const suggestion = buildContinuitySuggestion({
      assets: [
        {
          subjectKey: "prop:wine-glass",
          kind: "PROP",
          label: "酒杯",
          sourceSha256: "d".repeat(64),
          defaultPolicy: "SHOT_CHANGE",
          facts: { dynamicCandidate: true },
        },
      ],
      shots: continuityShots,
    });

    expect(suggestion.boundaries[1]?.state["prop:wine-glass"]).toMatchObject({
      physicalPresence: "PRESENT",
      visibility: "NOT_EMPHASIZED",
      instantaneousState: "酒杯留在咖啡桌上，但下一镜不强调酒杯",
    });
  });

  it("locks product geometry and preserves unmentioned scene inventory in every boundary", () => {
    const suggestion = buildContinuitySuggestion({
      assets: [
        {
          subjectKey: "environment:room",
          kind: "ENVIRONMENT",
          label: "客厅",
          sourceSha256: "e".repeat(64),
          facts: { identityAnchors: ["桌上的书和灯"] },
        },
        {
          subjectKey: "product:coffee-table",
          kind: "PRODUCT",
          label: "咖啡桌",
          sourceSha256: "f".repeat(64),
          facts: { identityAnchors: ["椭圆桌面", "三条弧形桌腿"] },
        },
      ],
      shots,
    });

    expect(suggestion.boundaries[2]?.state["environment:room"]).toMatchObject({
      persistence: "PRESERVE_ALL_REFERENCE_OBJECTS",
      facts: { identityAnchors: ["桌上的书和灯"] },
    });
    expect(suggestion.boundaries[2]?.state["product:coffee-table"]).toMatchObject({
      identityLock: {
        preserveGeometry: true,
        attributes: expect.arrayContaining(["top_shape", "leg_count", "leg_structure"]),
      },
    });
  });

  it("compiles only the shared boundary instant, never the next shot final composition", () => {
    const suggestion = buildContinuitySuggestion({
      assets: [
        {
          subjectKey: "product:coffee-table",
          kind: "PRODUCT",
          label: "咖啡桌",
          sourceSha256: "1".repeat(64),
          facts: { identityAnchors: ["三条桌腿"] },
        },
      ],
      shots: [
        { ...shots[0]!, endState: "人物站在咖啡桌右侧，酒杯在桌上" },
        {
          ...shots[1]!,
          startState: "人物站在咖啡桌右侧，酒杯在桌上",
          composition: "人物最终坐到沙发上",
        },
        shots[2]!,
      ],
    });
    const prompt = compileContinuityKeyframePrompt(suggestion.subjects, suggestion.boundaries[1]!);

    expect(prompt).toContain("人物站在咖啡桌右侧，酒杯在桌上");
    expect(prompt).toContain("same tabletop shape, leg count, leg structure");
    expect(prompt).toContain("books, lamps");
    expect(prompt).not.toContain("人物最终坐到沙发上");
    expect(prompt).not.toContain("nextStartState");
    expect(prompt).not.toContain("composition-2");
    expect(prompt).not.toContain("camera-1");
  });

  it("orders image edits from the scene base to fixed identities and dynamic props", () => {
    expect(keyframeReferencePriority({ kind: "ENVIRONMENT", policy: "WHOLE_FILM_HOLD" })).toBe(0);
    expect(keyframeReferencePriority({ kind: "PROP", policy: "WHOLE_FILM_HOLD" })).toBe(1);
    expect(keyframeReferencePriority({ kind: "CHARACTER", policy: "WHOLE_FILM_HOLD" })).toBe(2);
    expect(keyframeReferencePriority({ kind: "PROP", policy: "SHOT_CHANGE" })).toBe(3);
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
