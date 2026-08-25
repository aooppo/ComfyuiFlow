import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { RetainedProviderArtifact } from "./generation-provider.js";
import { ProjectAssetError } from "./contracts.js";
import type { Prisma } from "./generated/client/index.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const execute = promisify(execFile);
export const TECHNICAL_CHECKER_VERSION = "ffprobe-video-v1" as const;
export const REVIEW_FRAME_EXTRACTOR_VERSION = "review-frames-v1" as const;

export class GeneratedArtifactService {
  private readonly storage: StorageProvider;

  constructor(
    private readonly client: ProjectPrisma = prisma,
    storage?: StorageProvider,
  ) {
    this.storage =
      storage ??
      new LocalContentStorage({
        root: process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
        maxBytes: Number(process.env.PROJECT_GENERATED_MAX_BYTES || 500 * 1024 * 1024),
      });
  }

  async retainAndValidate(
    jobId: string,
    artifacts: RetainedProviderArtifact[],
    options: { requireH3Profile?: boolean } = {},
  ): Promise<any> {
    const job = await this.client.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new ProjectAssetError("GENERATION_TARGET_INVALID", "Job was not found", 404);
    if (artifacts.length !== 1)
      return this.failJob(jobId, "ARTIFACT_COUNT_INVALID", "Expected exactly one video artifact");
    const source = artifacts[0]!;
    let preserved: Awaited<ReturnType<StorageProvider["preserve"]>>;
    try {
      preserved = await this.storage.preserve(this.bytes(source.bytes));
    } catch {
      return this.failJob(jobId, "ARTIFACT_INVALID", "Generated output could not be retained");
    }
    const artifact = await this.client.generatedArtifact.create({
      data: {
        id: randomUUID(),
        projectId: job.projectId,
        generationJobId: job.id,
        storageKey: preserved.storageKey,
        sha256: preserved.sha256,
        byteSize: BigInt(preserved.byteSize),
        detectedMimeType: preserved.detectedMimeType,
        providerReferenceJson: (source.providerReference ?? {}) as Prisma.InputJsonValue,
      },
    });
    try {
      const facts = await this.probe(preserved.absolutePath);
      const validProfile =
        !options.requireH3Profile ||
        (facts.width === 768 &&
          facts.height === 1344 &&
          Math.abs(facts.fps - 24) < 0.1 &&
          facts.durationSeconds >= 3.8 &&
          facts.durationSeconds <= 4.8);
      if (!facts.videoCodec || !validProfile)
        throw new Error("Generated video does not match the registered profile");
      const check = await this.client.artifactTechnicalCheck.create({
        data: {
          id: randomUUID(),
          generatedArtifactId: artifact.id,
          checkerVersion: TECHNICAL_CHECKER_VERSION,
          status: "PASS",
          safeResultCode: "VIDEO_TECHNICAL_PASS",
          container: facts.container,
          videoCodec: facts.videoCodec,
          audioCodec: facts.audioCodec,
          width: facts.width,
          height: facts.height,
          fps: facts.fps,
          durationSeconds: facts.durationSeconds,
          bitrate: facts.bitrate === null ? null : BigInt(facts.bitrate),
          audioFactsJson: facts.audioFacts as Prisma.InputJsonValue,
        },
      });
      const frames = await this.extractFrames(
        artifact.id,
        preserved.absolutePath,
        facts.durationSeconds,
      );
      await this.client.generatedArtifact.update({
        where: { id: artifact.id },
        data: { status: "TECHNICALLY_VALID" },
      });
      return { artifact, check, frames, valid: true as const };
    } catch (error) {
      await this.client.$transaction([
        this.client.artifactTechnicalCheck.upsert({
          where: {
            generatedArtifactId_checkerVersion: {
              generatedArtifactId: artifact.id,
              checkerVersion: TECHNICAL_CHECKER_VERSION,
            },
          },
          create: {
            id: randomUUID(),
            generatedArtifactId: artifact.id,
            checkerVersion: TECHNICAL_CHECKER_VERSION,
            status: "FAIL",
            safeResultCode: "ARTIFACT_INVALID",
          },
          update: {
            status: "FAIL",
            safeResultCode: "ARTIFACT_INVALID",
          },
        }),
        this.client.generatedArtifact.update({
          where: { id: artifact.id },
          data: { status: "TECHNICALLY_INVALID" },
        }),
        this.client.generationJob.update({
          where: { id: jobId },
          data: {
            status: "TECHNICAL_FAILED",
            safeResultCode: "ARTIFACT_INVALID",
            finishedAt: new Date(),
          },
        }),
        this.client.generationBatch.update({
          where: { id: job.generationBatchId },
          data: { status: "PAUSED", rowVersion: { increment: 1 } },
        }),
      ]);
      return {
        artifact,
        valid: false as const,
        safeResultCode: "ARTIFACT_INVALID",
        reason: error instanceof Error ? error.message : "Artifact validation failed",
      };
    }
  }

  async getArtifact(artifactId: string): Promise<any> {
    const artifact = await this.client.generatedArtifact.findUnique({
      where: { id: artifactId },
      include: {
        generationJob: { include: { generationBatchTarget: true } },
        technicalChecks: true,
        reviewFrames: true,
        aiQaRuns: { include: { result: true } },
        humanQaDecisions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!artifact) throw new ProjectAssetError("ARTIFACT_INVALID", "Artifact was not found", 404);
    return artifact;
  }

  async getArtifactView(artifactId: string): Promise<any> {
    const artifact = await this.getArtifact(artifactId);
    return this.publicValue({
      ...artifact,
      contentUrl: `/api/generated-artifacts/${artifact.id}/content`,
      reviewFrames: artifact.reviewFrames.map((frame: any) => ({
        ...frame,
        contentUrl: `/api/generated-artifacts/${artifact.id}/review-frames/${frame.role}`,
      })),
    });
  }

  async resolveArtifactPath(artifactId: string): Promise<string> {
    const artifact = await this.getArtifact(artifactId);
    return this.storage.resolveVerified(
      artifact.storageKey,
      artifact.sha256,
      Number(artifact.byteSize),
    );
  }

  async resolveFramePath(artifactId: string, role: "FIRST" | "MIDDLE" | "FINAL"): Promise<string> {
    const frame = await this.client.artifactReviewFrame.findFirst({
      where: { generatedArtifactId: artifactId, role },
      orderBy: { createdAt: "desc" },
    });
    if (!frame) throw new ProjectAssetError("QA_NOT_READY", "Review frame was not found", 404);
    return this.storage.resolveVerified(frame.storageKey, frame.sha256, Number(frame.byteSize));
  }

  private async extractFrames(artifactId: string, videoPath: string, duration: number) {
    const temporary = await mkdtemp(path.join(tmpdir(), "comfyuiflow-review-"));
    const definitions = [
      { role: "FIRST" as const, timestamp: 0 },
      { role: "MIDDLE" as const, timestamp: Math.max(0, duration / 2) },
      { role: "FINAL" as const, timestamp: Math.max(0, duration - 0.15) },
    ];
    const created = [];
    try {
      for (const definition of definitions) {
        const output = path.join(temporary, `${definition.role.toLowerCase()}.png`);
        await execute("ffmpeg", [
          "-v",
          "error",
          "-ss",
          definition.timestamp.toFixed(6),
          "-i",
          videoPath,
          "-frames:v",
          "1",
          "-y",
          output,
        ]);
        const preserved = await this.storage.preserve(createReadStream(output));
        created.push(
          await this.client.artifactReviewFrame.create({
            data: {
              id: randomUUID(),
              generatedArtifactId: artifactId,
              role: definition.role,
              requestedTimestamp: definition.timestamp,
              actualTimestamp: definition.timestamp,
              extractorVersion: REVIEW_FRAME_EXTRACTOR_VERSION,
              storageKey: preserved.storageKey,
              sha256: preserved.sha256,
              byteSize: BigInt(preserved.byteSize),
              mimeType: preserved.detectedMimeType,
            },
          }),
        );
      }
      return created;
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
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
    const raw = JSON.parse(stdout) as any;
    const video = raw.streams?.find((stream: any) => stream.codec_type === "video");
    const audio = raw.streams?.find((stream: any) => stream.codec_type === "audio");
    const [numerator, denominator] = String(video?.avg_frame_rate ?? "0/1")
      .split("/")
      .map(Number);
    return {
      container: String(raw.format?.format_name ?? "unknown").split(",")[0]!,
      videoCodec: video?.codec_name ? String(video.codec_name) : null,
      audioCodec: audio?.codec_name ? String(audio.codec_name) : null,
      width: Number(video?.width ?? 0),
      height: Number(video?.height ?? 0),
      fps: denominator ? numerator! / denominator : 0,
      durationSeconds: Number(raw.format?.duration ?? video?.duration ?? 0),
      bitrate: raw.format?.bit_rate ? Number(raw.format.bit_rate) : null,
      audioFacts: {
        present: Boolean(audio),
        channels: audio?.channels ? Number(audio.channels) : null,
        sampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null,
      },
    };
  }

  private async failJob(jobId: string, code: string, message: string) {
    const job = await this.client.generationJob.update({
      where: { id: jobId },
      data: { status: "TECHNICAL_FAILED", safeResultCode: code, finishedAt: new Date() },
    });
    await this.client.generationBatch.update({
      where: { id: job.generationBatchId },
      data: { status: "PAUSED", rowVersion: { increment: 1 } },
    });
    return { valid: false as const, safeResultCode: code, reason: message };
  }

  private async *bytes(value: Uint8Array) {
    yield value;
  }

  private publicValue(value: unknown): any {
    if (typeof value === "bigint") return Number(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.publicValue(item));
    if (typeof value === "object" && value !== null)
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !["storageKey", "providerReferenceJson", "claimOwner"].includes(key))
          .map(([key, item]) => [key, this.publicValue(item)]),
      );
    return value;
  }
}
