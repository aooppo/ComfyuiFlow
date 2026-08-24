import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaTypeValue } from "./contracts.js";

const execFileAsync = promisify(execFile);

export interface MediaFacts {
  mediaType: MediaTypeValue;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  inspectionWarning: string | null;
}

export async function inspectMedia(filePath: string, mimeType: string): Promise<MediaFacts> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const video = parsed.streams?.find((stream) => stream.codec_type === "video");
    const mediaType: MediaTypeValue = mimeType.startsWith("image/")
      ? "IMAGE"
      : video
        ? "VIDEO"
        : "AUDIO";
    const seconds = Number(parsed.format?.duration);
    return {
      mediaType,
      width: video?.width ?? null,
      height: video?.height ?? null,
      durationMs:
        mediaType !== "IMAGE" && Number.isFinite(seconds) ? Math.round(seconds * 1_000) : null,
      inspectionWarning: null,
    };
  } catch {
    return {
      mediaType: mimeType.startsWith("image/")
        ? "IMAGE"
        : mimeType.startsWith("video/")
          ? "VIDEO"
          : "AUDIO",
      width: null,
      height: null,
      durationMs: null,
      inspectionWarning: mimeType.startsWith("image/")
        ? "IMAGE_METADATA_UNAVAILABLE"
        : "MEDIA_METADATA_UNAVAILABLE",
    };
  }
}
