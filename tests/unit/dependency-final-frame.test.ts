import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  createUpstreamFinalFrameBinding,
  DependencyFrameExtractor,
  evaluateGenerationSpecDependenciesV3,
  LocalContentStorage,
} from "@comfyuiflow/project-core";

const execute = promisify(execFile);
const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("exact dependency final frame", () => {
  it("binds exact upstream plan, artifact, frame index, and hash only after materialization", () => {
    const base = {
      bindingId: "00000000-0000-4000-8000-000000000001",
      upstreamPlanRef: { id: "plan.upstream", version: "7" },
      artifactRef: { id: "artifact.final-frame", version: "3" },
      frameIndex: 120,
      sha256: "a".repeat(64),
    };
    expect(createUpstreamFinalFrameBinding({ ...base, ready: false })).toMatchObject({
      ready: false,
      blockerCode: "UPSTREAM_FINAL_FRAME_NOT_MATERIALIZED",
      binding: null,
    });
    const materialized = createUpstreamFinalFrameBinding({ ...base, ready: true });
    expect(materialized).toMatchObject({
      ready: true,
      blockerCode: null,
      lineage: {
        upstreamPlanRef: base.upstreamPlanRef,
        artifactRef: base.artifactRef,
        frameIndex: base.frameIndex,
        sha256: base.sha256,
      },
      binding: {
        sourceKind: "UPSTREAM_FINAL_FRAME",
        sourceRef: { id: "artifact.final-frame", version: materialized.lineageHash },
        sha256: "a".repeat(64),
      },
    });
    expect(
      evaluateGenerationSpecDependenciesV3({ continuityRequired: true, bindings: [] }),
    ).toEqual(["UPSTREAM_FINAL_FRAME_NOT_MATERIALIZED"]);
    expect(
      evaluateGenerationSpecDependenciesV3({
        continuityRequired: true,
        bindings: [materialized.binding!],
      }),
    ).toEqual([]);
  });

  it("extracts the last decoded frame with exact index, rational PTS, and stable hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-final-frame-test-"));
    roots.push(root);
    const videoPath = join(root, "five-frames.mp4");
    await execute("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=32x32:rate=5:duration=1",
      "-frames:v",
      "5",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-y",
      videoPath,
    ]);
    const extractor = new DependencyFrameExtractor(
      new LocalContentStorage({ root: join(root, "storage"), maxBytes: 2 * 1024 * 1024 }),
    );
    const first = await extractor.extract(videoPath);
    const second = await extractor.extract(videoPath);
    expect(first.frameIndex).toBe(4);
    expect(first.pts).toBeGreaterThanOrEqual(0n);
    expect(first.timeBaseNumerator).toBeGreaterThan(0);
    expect(first.timeBaseDenominator).toBeGreaterThan(0);
    expect(first.actualTimestamp).toBe(
      (Number(first.pts) * first.timeBaseNumerator) / first.timeBaseDenominator,
    );
    expect(first.sha256).toBe(second.sha256);
    expect(first.mimeType).toBe("image/png");
  });
});
