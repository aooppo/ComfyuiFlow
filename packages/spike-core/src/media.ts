import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import {
  VideoArtifactSchema,
  type ArtifactReference,
  type VideoArtifact,
} from "@comfyuiflow/contracts";
import { sha256File } from "./integrity.js";

const execFileAsync = promisify(execFile);

function parseRate(value: string): number {
  const [numerator, denominator = "1"] = value.split("/");
  const result = Number(numerator) / Number(denominator);
  if (!Number.isFinite(result) || result <= 0)
    throw new Error("FFprobe returned an invalid frame rate");
  return result;
}

export interface VideoFacts {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
}

export async function probeVideo(path: string, ffprobePath = "ffprobe"): Promise<VideoFacts> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
      "-of",
      "json",
      path,
    ]));
  } catch {
    throw new Error("FFprobe could not validate the artifact");
  }
  const value = JSON.parse(stdout) as {
    streams?: Array<Record<string, unknown>>;
    format?: Record<string, unknown>;
  };
  const streams = value.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("FFprobe found no video stream");
  const durationSeconds = Number(value.format?.duration);
  const width = Number(video.width);
  const height = Number(video.height);
  const codec = String(video.codec_name ?? "");
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    width <= 0 ||
    height <= 0 ||
    !codec
  ) {
    throw new Error("FFprobe returned incomplete video facts");
  }
  return {
    durationSeconds,
    width,
    height,
    fps: parseRate(String(video.r_frame_rate)),
    codec,
    hasAudio: streams.some((stream) => stream.codec_type === "audio"),
  };
}

export async function verifyVideoArtifact(input: {
  path: string;
  runId: string;
  promptId: string;
  sourceReference: ArtifactReference;
  mimeType?: string;
}): Promise<VideoArtifact> {
  const facts = await probeVideo(input.path);
  const file = await stat(input.path);
  return VideoArtifactSchema.parse({
    schemaVersion: "1.0.0",
    id: randomUUID(),
    runId: input.runId,
    promptId: input.promptId,
    storedPath: input.path,
    sourceReference: input.sourceReference,
    sha256: await sha256File(input.path),
    byteSize: file.size,
    mimeType: input.mimeType?.startsWith("video/") ? input.mimeType : "video/mp4",
    ...facts,
  });
}
