import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { DependencyFrameExtractor, LocalContentStorage } from "@comfyuiflow/project-core";

const execute = promisify(execFile);
const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("exact dependency final frame", () => {
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
