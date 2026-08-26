import { describe, expect, it } from "vitest";
import { computeAssemblySelection, type AssemblySelectionSpec } from "@comfyuiflow/project-core";

const artifact = (
  id: string,
  retainedAt: string,
  decision: "PASS" | "FAIL" | null,
  status = "TECHNICALLY_VALID",
) => ({
  id,
  sha256: id.padEnd(64, "a").slice(0, 64),
  byteSize: 1000,
  detectedMimeType: "video/mp4",
  retainedAt,
  status,
  humanQaDecisions: decision
    ? [{ decision, createdAt: new Date(new Date(retainedAt).getTime() + 1000).toISOString() }]
    : [],
});

const spec = (
  ordinal: number,
  artifacts: ReturnType<typeof artifact>[],
): AssemblySelectionSpec => ({
  id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
  ordinal,
  artifacts,
});

describe("plan assembly source selection", () => {
  it("keeps the latest owner-PASS source even when a newer attempt is blank or failed", () => {
    const selection = computeAssemblySelection("10000000-0000-4000-8000-000000000001", [
      spec(1, [
        artifact("1", "2026-08-25T09:00:00.000Z", "PASS"),
        artifact("2", "2026-08-25T10:00:00.000Z", null),
        artifact("3", "2026-08-25T11:00:00.000Z", "FAIL"),
      ]),
    ]);

    expect(selection.eligible).toBe(true);
    expect(selection.sources).toHaveLength(1);
    expect(selection.sources[0]?.artifactId).toBe("1");
    expect(selection.missingOrdinals).toEqual([]);
    expect(selection.sourceSetHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lists every missing ordinal and withholds the source-set hash", () => {
    const selection = computeAssemblySelection("10000000-0000-4000-8000-000000000001", [
      spec(2, [artifact("2", "2026-08-25T09:00:00.000Z", "FAIL")]),
      spec(1, [artifact("1", "2026-08-25T09:00:00.000Z", "PASS")]),
      spec(3, [artifact("3", "2026-08-25T09:00:00.000Z", null)]),
    ]);

    expect(selection.eligible).toBe(false);
    expect(selection.sources.map((source) => source.ordinal)).toEqual([1]);
    expect(selection.missingOrdinals).toEqual([2, 3]);
    expect(selection.sourceSetHash).toBeNull();
  });

  it("is deterministic across database ordering and rejects invalid media state", () => {
    const versionId = "10000000-0000-4000-8000-000000000001";
    const first = computeAssemblySelection(versionId, [
      spec(2, [artifact("2", "2026-08-25T09:00:00.000Z", "PASS")]),
      spec(1, [artifact("1", "2026-08-25T09:00:00.000Z", "PASS")]),
    ]);
    const second = computeAssemblySelection(versionId, [
      spec(1, [artifact("1", "2026-08-25T09:00:00.000Z", "PASS")]),
      spec(2, [artifact("2", "2026-08-25T09:00:00.000Z", "PASS")]),
    ]);
    const invalid = computeAssemblySelection(versionId, [
      spec(1, [artifact("1", "2026-08-25T09:00:00.000Z", "PASS", "TECHNICALLY_INVALID")]),
    ]);

    expect(first.sources.map((source) => source.ordinal)).toEqual([1, 2]);
    expect(first.sourceSetHash).toBe(second.sourceSetHash);
    expect(invalid).toMatchObject({ eligible: false, missingOrdinals: [1] });
  });

  it("uses an exact frozen reuse artifact instead of a newer owner-PASS attempt", () => {
    const value = spec(1, [
      artifact("reused", "2026-08-25T09:00:00.000Z", "PASS"),
      artifact("newer", "2026-08-25T10:00:00.000Z", "PASS"),
    ]);
    value.frozenReuseArtifactId = "reused";
    const selection = computeAssemblySelection("10000000-0000-4000-8000-000000000001", [value]);
    expect(selection.sources[0]?.artifactId).toBe("reused");
  });
});
