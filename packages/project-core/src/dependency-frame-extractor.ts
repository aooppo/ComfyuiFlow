import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { canonicalSha256 } from "./canonical-json.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";

const execute = promisify(execFile);
export const DEPENDENCY_FINAL_FRAME_EXTRACTOR_VERSION = "dependency-final-frame-v1" as const;

export interface ExtractedDependencyFrame {
  extractorVersion: typeof DEPENDENCY_FINAL_FRAME_EXTRACTOR_VERSION;
  frameIndex: number;
  pts: bigint;
  timeBaseNumerator: number;
  timeBaseDenominator: number;
  actualTimestamp: number;
  storageKey: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
}

export function createUpstreamFinalFrameBinding(input: {
  bindingId: string;
  upstreamPlanRef: { id: string; version: string };
  artifactRef: { id: string; version: string };
  frameIndex: number;
  sha256: string;
  ready: boolean;
}) {
  const lineage = {
    upstreamPlanRef: input.upstreamPlanRef,
    artifactRef: input.artifactRef,
    frameIndex: input.frameIndex,
    sha256: input.sha256,
  };
  const lineageHash = canonicalSha256(lineage);
  return {
    ready: input.ready,
    blockerCode: input.ready ? null : ("UPSTREAM_FINAL_FRAME_NOT_MATERIALIZED" as const),
    lineage,
    lineageHash,
    binding: input.ready
      ? {
          id: input.bindingId,
          purpose: "CONTINUITY" as const,
          sourceKind: "UPSTREAM_FINAL_FRAME" as const,
          sourceRef: { id: input.artifactRef.id, version: lineageHash },
          sha256: input.sha256,
          modality: "IMAGE" as const,
          roleLabel: "first-frame",
          necessity: "REQUIRED" as const,
        }
      : null,
  };
}

export class DependencyFrameExtractor {
  constructor(private readonly storage: StorageProvider = new LocalContentStorage()) {}

  async extract(videoPath: string): Promise<ExtractedDependencyFrame> {
    const { stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_streams",
      "-show_frames",
      "-show_entries",
      "stream=time_base:frame=media_type,best_effort_timestamp,pkt_pts,pkt_dts",
      "-of",
      "json",
      videoPath,
    ]);
    const raw = JSON.parse(stdout) as any;
    const stream = raw.streams?.[0];
    const [timeBaseNumerator, timeBaseDenominator] = String(stream?.time_base ?? "0/0")
      .split("/")
      .map(Number);
    if (
      !Number.isInteger(timeBaseNumerator) ||
      !Number.isInteger(timeBaseDenominator) ||
      timeBaseNumerator! <= 0 ||
      timeBaseDenominator! <= 0
    )
      throw new Error("DEPENDENCY_FRAME_TIME_BASE_INVALID");
    const frames = (Array.isArray(raw.frames) ? raw.frames : []).filter(
      (frame: any) => !frame.media_type || frame.media_type === "video",
    );
    if (frames.length === 0) throw new Error("DEPENDENCY_FRAME_NOT_FOUND");
    const frameIndex = frames.length - 1;
    const finalFrame = frames[frameIndex];
    const rawPts = finalFrame.best_effort_timestamp ?? finalFrame.pkt_pts ?? finalFrame.pkt_dts;
    if (rawPts === undefined || !/^-?\d+$/.test(String(rawPts)))
      throw new Error("DEPENDENCY_FRAME_PTS_INVALID");
    const pts = BigInt(String(rawPts));
    const temporary = await mkdtemp(path.join(tmpdir(), "comfyuiflow-dependency-frame-"));
    try {
      const output = path.join(temporary, "final.png");
      await execute("ffmpeg", [
        "-v",
        "error",
        "-i",
        videoPath,
        "-vf",
        `select=eq(n\\,${frameIndex})`,
        "-vsync",
        "0",
        "-frames:v",
        "1",
        "-y",
        output,
      ]);
      const preserved = await this.storage.preserve(createReadStream(output));
      return {
        extractorVersion: DEPENDENCY_FINAL_FRAME_EXTRACTOR_VERSION,
        frameIndex,
        pts,
        timeBaseNumerator: timeBaseNumerator!,
        timeBaseDenominator: timeBaseDenominator!,
        actualTimestamp: (Number(pts) * timeBaseNumerator!) / timeBaseDenominator!,
        storageKey: preserved.storageKey,
        sha256: preserved.sha256,
        byteSize: preserved.byteSize,
        mimeType: preserved.detectedMimeType,
      };
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
