import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeVideo } from "@comfyuiflow/spike-core";
import { probeMedia } from "@comfyuiflow/project-core";

describe("media verification", () => {
  it("extracts playable H.264 video facts with FFprobe", async () => {
    const facts = await probeVideo(join(process.cwd(), "tests/fixtures/media/shot.mp4"));
    expect(facts).toMatchObject({
      codec: "h264",
      width: 160,
      height: 96,
      fps: 24,
      durationSeconds: 0.5,
      hasAudio: false,
    });
  });

  it("rejects a non-video input", async () => {
    await expect(probeVideo(import.meta.filename)).rejects.toThrow("FFprobe");
  });

  it("records a safe INVALID result for truncated media without exposing a path or tool output", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-media-"));
    const file = join(root, "truncated.png");
    await writeFile(file, Buffer.from("89504e470d0a1a0a", "hex"));
    const result = await probeMedia(file, "image/png");
    expect(result).toMatchObject({ status: "FAIL", safeResultCode: "MEDIA_STRUCTURE_INVALID" });
    expect(JSON.stringify(result)).not.toContain(root);
  });
});
