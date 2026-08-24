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

export interface MediaProbeFacts extends MediaFacts {
  status: "PASS" | "FAIL";
  container: string | null;
  streamCount: number | null;
  safeResultCode: string;
}

export const MEDIA_PROBE_VERSION = "ffprobe-v1";

export async function inspectMedia(filePath: string, mimeType: string): Promise<MediaFacts> {
  const facts = await probeMedia(filePath, mimeType);
  return {
    mediaType: facts.mediaType,
    width: facts.width,
    height: facts.height,
    durationMs: facts.durationMs,
    inspectionWarning: facts.status === "PASS" ? null : facts.safeResultCode,
  };
}

export async function probeMedia(filePath: string, mimeType: string): Promise<MediaProbeFacts> {
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
      format?: { duration?: string; format_name?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const video = parsed.streams?.find((stream) => stream.codec_type === "video");
    const mediaType: MediaTypeValue = mimeType.startsWith("image/")
      ? "IMAGE"
      : video
        ? "VIDEO"
        : "AUDIO";
    const seconds = Number(parsed.format?.duration);
    const streamCount = parsed.streams?.length ?? 0;
    if (streamCount === 0 || (mimeType.startsWith("image/") && (!video?.width || !video?.height))) {
      return failedFacts(mimeType, "MEDIA_STRUCTURE_INVALID");
    }
    return {
      mediaType,
      width: video?.width ?? null,
      height: video?.height ?? null,
      durationMs:
        mediaType !== "IMAGE" && Number.isFinite(seconds) ? Math.round(seconds * 1_000) : null,
      inspectionWarning: null,
      status: "PASS",
      container: parsed.format?.format_name?.slice(0, 80) ?? null,
      streamCount,
      safeResultCode: "MEDIA_PROBE_OK",
    };
  } catch {
    return failedFacts(mimeType, "MEDIA_STRUCTURE_INVALID");
  }
}

function failedFacts(mimeType: string, safeResultCode: string): MediaProbeFacts {
  return {
    mediaType: mimeType.startsWith("image/")
      ? "IMAGE"
      : mimeType.startsWith("video/")
        ? "VIDEO"
        : "AUDIO",
    width: null,
    height: null,
    durationMs: null,
    inspectionWarning: safeResultCode,
    status: "FAIL",
    container: null,
    streamCount: null,
    safeResultCode,
  };
}
