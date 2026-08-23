import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeVideo } from "@comfyuiflow/spike-core";

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
});
