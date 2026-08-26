import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { AttemptArtifactV3Schema, type AttemptArtifactV3 } from "@comfyuiflow/contracts";
import type { Prisma } from "./generated/client/index.js";
import type { CapabilityArtifactPipelineV3 } from "./capability-generation-worker-v3.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const execute = promisify(execFile);
export const CAPABILITY_V3_PROBE_VERSION = "ffprobe-capability-v3" as const;
export const CAPABILITY_V3_FRAME_VERSION = "review-frames-capability-v3" as const;

export class LocalCapabilityArtifactPipelineV3 implements CapabilityArtifactPipelineV3 {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage({
      root: process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
      maxBytes: Number(process.env.PROJECT_GENERATED_MAX_BYTES || 500 * 1024 * 1024),
    }),
  ) {}

  async process(input: Parameters<CapabilityArtifactPipelineV3["process"]>[0]) {
    const existing = await this.client.generationArtifactV3Record.findUnique({
      where: { attemptId: input.attemptId },
    });
    if (existing) return AttemptArtifactV3Schema.parse(existing.payloadJson);
    if (input.retained.length !== 1) throw new Error("ARTIFACT_COUNT_INVALID");
    const retained = input.retained[0]!;
    const preserved = await this.storage.preserve(createReadStream(retained.path));
    if (preserved.sha256 !== retained.sha256 || preserved.byteSize !== retained.byteSize)
      throw new Error("ARTIFACT_RETAIN_HASH_MISMATCH");
    const facts = await this.probe(preserved.absolutePath);
    const generationNode = Object.values(input.snapshot.materializedGraph).find(
      (node) => node.class_type === "MinimaxHailuo03ReferenceNode",
    );
    const requestedDuration = Number(generationNode?.inputs["model.duration"] ?? 0);
    const technicalPass =
      Boolean(facts.codec) &&
      facts.width > 0 &&
      facts.height > 0 &&
      Math.abs(facts.fps - 24) <= 0.15 &&
      requestedDuration >= 4 &&
      requestedDuration <= 15 &&
      facts.durationSeconds >= requestedDuration - 0.3 &&
      facts.durationSeconds <= requestedDuration + 1;
    const frames = technicalPass
      ? await this.extractFrames(preserved.absolutePath, facts.durationSeconds)
      : [];
    const artifact = AttemptArtifactV3Schema.parse({
      id: randomUUID(),
      attemptId: input.attemptId,
      storageKey: preserved.storageKey,
      mediaType: "video/mp4",
      bytes: preserved.byteSize,
      sha256: preserved.sha256,
      technicalStatus: technicalPass ? "VERIFIED" : "FAILED",
      technicalResultCode: technicalPass ? "VIDEO_TECHNICAL_PASS" : "ARTIFACT_INVALID",
      ffprobe: facts,
      reviewFrames: frames,
      aiQaStatus: "AI_QA_UNAVAILABLE",
      ownerDecision: null,
    } satisfies AttemptArtifactV3);
    await this.client.generationArtifactV3Record.create({
      data: {
        id: artifact.id,
        projectId: input.projectId,
        attemptId: artifact.attemptId,
        storageKey: artifact.storageKey,
        mediaType: artifact.mediaType,
        byteSize: artifact.bytes,
        sha256: artifact.sha256,
        technicalStatus: artifact.technicalStatus,
        technicalResultCode: artifact.technicalResultCode,
        ffprobeJson: artifact.ffprobe as Prisma.InputJsonValue,
        reviewFramesJson: artifact.reviewFrames as Prisma.InputJsonValue,
        aiQaStatus: artifact.aiQaStatus,
        payloadJson: artifact as Prisma.InputJsonValue,
      },
    });
    return artifact;
  }

  private async probe(videoPath: string) {
    const { stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ]);
    const raw = JSON.parse(stdout) as Record<string, any>;
    const video = raw.streams?.find((stream: any) => stream.codec_type === "video");
    const [numerator, denominator] = String(video?.avg_frame_rate ?? "0/1")
      .split("/")
      .map(Number);
    return {
      durationSeconds: Number(raw.format?.duration ?? video?.duration ?? 0),
      width: Number(video?.width ?? 0),
      height: Number(video?.height ?? 0),
      fps: denominator ? numerator! / denominator : 0,
      codec: String(video?.codec_name ?? "unknown"),
      container: String(raw.format?.format_name ?? "unknown").split(",")[0]!,
      probeVersion: CAPABILITY_V3_PROBE_VERSION,
    };
  }

  private async extractFrames(videoPath: string, durationSeconds: number) {
    const directory = await mkdtemp(path.join(tmpdir(), "comfyuiflow-capability-v3-"));
    const definitions = [
      { role: "FIRST" as const, timestampSeconds: 0 },
      { role: "MIDDLE" as const, timestampSeconds: durationSeconds / 2 },
      { role: "LAST" as const, timestampSeconds: Math.max(0, durationSeconds - 0.15) },
    ];
    try {
      return await Promise.all(
        definitions.map(async (definition) => {
          const output = path.join(directory, `${definition.role.toLowerCase()}.png`);
          await execute("ffmpeg", [
            "-v",
            "error",
            "-ss",
            definition.timestampSeconds.toFixed(6),
            "-i",
            videoPath,
            "-frames:v",
            "1",
            "-y",
            output,
          ]);
          const preserved = await this.storage.preserve(createReadStream(output));
          return {
            id: randomUUID(),
            role: definition.role,
            timestampSeconds: definition.timestampSeconds,
            storageKey: preserved.storageKey,
            sha256: preserved.sha256,
            bytes: preserved.byteSize,
          };
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
