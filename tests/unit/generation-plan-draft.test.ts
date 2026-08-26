import { describe, expect, it } from "vitest";
import { computeDraftSelection } from "@comfyuiflow/project-core";

function artifact(
  id: string,
  retainedAt: string,
  humanDecision: "PASS" | "FAIL" | undefined,
  aiStatus: "PASS" | "WARN",
) {
  return {
    id,
    sha256: id.padEnd(64, "a").slice(0, 64),
    byteSize: 100,
    detectedMimeType: "video/mp4",
    status: "TECHNICALLY_VALID",
    retainedAt,
    humanQaDecisions: humanDecision ? [{ decision: humanDecision, createdAt: retainedAt }] : [],
    aiQaRuns: [{ result: { overallStatus: aiStatus, summary: `${aiStatus} details` } }],
  };
}

describe("whole-film warning draft selection", () => {
  it("selects the newest playable artifact per shot without auto-promoting it", () => {
    const selection = computeDraftSelection(crypto.randomUUID(), [
      {
        id: crypto.randomUUID(),
        ordinal: 2,
        artifacts: [artifact("2-new", "2026-08-25T02:00:00.000Z", "FAIL", "WARN")],
      },
      {
        id: crypto.randomUUID(),
        ordinal: 1,
        artifacts: [
          artifact("1-old", "2026-08-25T01:00:00.000Z", "PASS", "PASS"),
          artifact("1-new", "2026-08-25T03:00:00.000Z", undefined, "PASS"),
        ],
      },
    ]);

    expect(selection.eligible).toBe(true);
    expect(selection.sources.map((source) => source.artifactId)).toEqual(["1-new", "2-new"]);
    expect(selection.sources.map((source) => source.humanQaState)).toEqual(["PENDING", "FAIL"]);
    expect(selection.warnings).toEqual(
      expect.arrayContaining([
        { ordinal: 1, warning: "人工审核：PENDING" },
        { ordinal: 2, warning: "人工审核：FAIL" },
        { ordinal: 2, warning: "AI QA WARN：WARN details" },
      ]),
    );
  });

  it("refuses a draft when any approved-plan shot lacks playable media", () => {
    const selection = computeDraftSelection(crypto.randomUUID(), [
      { id: crypto.randomUUID(), ordinal: 1, artifacts: [] },
      {
        id: crypto.randomUUID(),
        ordinal: 2,
        artifacts: [artifact("2-only", "2026-08-25T01:00:00.000Z", "PASS", "PASS")],
      },
    ]);
    expect(selection).toMatchObject({ eligible: false, missingOrdinals: [1], sourceSetHash: null });
  });

  it("uses an exact frozen reuse artifact instead of a newer attempt", () => {
    const selection = computeDraftSelection(crypto.randomUUID(), [
      {
        id: crypto.randomUUID(),
        ordinal: 1,
        frozenReuseArtifactId: "reused",
        artifacts: [
          artifact("reused", "2026-08-25T01:00:00.000Z", "PASS", "PASS"),
          artifact("newer", "2026-08-25T02:00:00.000Z", "PASS", "PASS"),
        ],
      },
    ]);
    expect(selection.sources[0]?.artifactId).toBe("reused");
  });
});
