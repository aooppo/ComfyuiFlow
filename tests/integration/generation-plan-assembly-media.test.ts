import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { assemblePortraitVideos, probeVideoFacts } from "@comfyuiflow/project-core";

const execute = promisify(execFile);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("local shot plan media assembly", () => {
  it("concatenates ordered portrait sources into a silent browser MP4", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "comfyuiflow-assembly-test-"));
    temporaryRoots.push(root);
    const first = path.join(root, "01.mp4");
    const second = path.join(root, "02.mp4");
    const output = path.join(root, "combined.mp4");

    for (const [file, color] of [
      [first, "red"],
      [second, "blue"],
    ] as const) {
      await execute("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:s=768x1344:r=24:d=0.5`,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-y",
        file,
      ]);
    }

    await assemblePortraitVideos([first, second], output);
    const facts = await probeVideoFacts(output);

    expect((await stat(output)).size).toBeGreaterThan(0);
    expect(facts).toMatchObject({
      container: "mov",
      videoCodec: "h264",
      width: 768,
      height: 1344,
      hasAudio: false,
    });
    expect(facts.fps).toBeCloseTo(24, 1);
    expect(facts.durationSeconds).toBeCloseTo(1, 1);
  }, 30_000);
});
