import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ProjectAssetError } from "./contracts.js";
import { probeMedia } from "./media-probe.js";

const execFileAsync = promisify(execFile);

export async function normalizeKeyframeImage(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
) {
  const directory = await mkdtemp(path.join(tmpdir(), "comfyuiflow-keyframe-"));
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  const inputPath = path.join(directory, `input.${extension}`);
  const outputPath = path.join(directory, "normalized.png");
  try {
    await writeFile(inputPath, bytes);
    const inputFacts = await probeMedia(inputPath, mimeType);
    if (inputFacts.status !== "PASS" || !inputFacts.width || !inputFacts.height)
      throw new ProjectAssetError(
        "KEYFRAME_MEDIA_INVALID",
        "Generated keyframe is not a readable image",
        502,
      );
    await execFileAsync("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale=768:1344:force_original_aspect_ratio=increase,crop=768:1344",
      "-frames:v",
      "1",
      outputPath,
    ]);
    const normalized = await readFile(outputPath);
    const outputFacts = await probeMedia(outputPath, "image/png");
    if (outputFacts.status !== "PASS" || outputFacts.width !== 768 || outputFacts.height !== 1344)
      throw new ProjectAssetError(
        "KEYFRAME_DIMENSIONS_INVALID",
        "Generated keyframe could not be normalized to the video frame",
        502,
      );
    return {
      bytes: normalized,
      mimeType: "image/png" as const,
      width: 768 as const,
      height: 1344 as const,
      originalSha256: createHash("sha256").update(bytes).digest("hex"),
      originalWidth: inputFacts.width,
      originalHeight: inputFacts.height,
      normalized: inputFacts.width !== 768 || inputFacts.height !== 1344,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
