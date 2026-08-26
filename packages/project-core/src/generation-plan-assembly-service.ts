import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const execute = promisify(execFile);
export const PLAN_ASSEMBLY_CONTRACT_VERSION = "generation-plan-assembly-v1" as const;
export const PLAN_ASSEMBLER_VERSION = "ffmpeg-portrait-concat-v1" as const;

export interface AssemblySelectionArtifact {
  id: string;
  sha256: string;
  byteSize: number | bigint;
  detectedMimeType: string;
  retainedAt: string | Date;
  status: string;
  storageKey?: string;
  humanQaDecisions: Array<{ decision: string; createdAt: string | Date }>;
}

export interface AssemblySelectionSpec {
  id: string;
  ordinal: number;
  artifacts: AssemblySelectionArtifact[];
  frozenReuseArtifactId?: string;
}

export interface AssemblySourceSelection {
  ordinal: number;
  generationSpecId: string;
  artifactId: string;
  sha256: string;
  byteSize: number;
  detectedMimeType: string;
}

export interface AssemblySelection {
  eligible: boolean;
  missingOrdinals: number[];
  sources: AssemblySourceSelection[];
  sourceSetHash: string | null;
}

export async function assemblePortraitVideos(sourcePaths: string[], outputPath: string) {
  const filterInputs = sourcePaths
    .map(
      (_, index) =>
        `[${index}:v]scale=768:1344:force_original_aspect_ratio=decrease,pad=768:1344:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p,setpts=PTS-STARTPTS[v${index}]`,
    )
    .join(";");
  const concat = `${sourcePaths.map((_, index) => `[v${index}]`).join("")}concat=n=${sourcePaths.length}:v=1:a=0[outv]`;
  try {
    await execute("ffmpeg", [
      "-v",
      "error",
      ...sourcePaths.flatMap((sourcePath) => ["-i", sourcePath]),
      "-filter_complex",
      `${filterInputs};${concat}`,
      "-map",
      "[outv]",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      "-an",
      "-y",
      outputPath,
    ]);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    throw new ProjectAssetError(
      code === "ENOENT" ? "LOCAL_ASSEMBLER_UNAVAILABLE" : "ASSEMBLY_MEDIA_INVALID",
      code === "ENOENT"
        ? "Local FFmpeg is unavailable"
        : "The accepted videos could not be combined locally",
      500,
    );
  }
}

export async function probeVideoFacts(videoPath: string) {
  let stdout: string;
  try {
    ({ stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ]));
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    throw new ProjectAssetError(
      code === "ENOENT" ? "LOCAL_ASSEMBLER_UNAVAILABLE" : "ASSEMBLY_MEDIA_INVALID",
      code === "ENOENT" ? "Local FFprobe is unavailable" : "Video validation failed",
      500,
    );
  }
  const raw = JSON.parse(stdout) as any;
  const video = raw.streams?.find((stream: any) => stream.codec_type === "video");
  const audio = raw.streams?.find((stream: any) => stream.codec_type === "audio");
  const [numerator, denominator] = String(video?.avg_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  return {
    container: String(raw.format?.format_name ?? "unknown").split(",")[0]!,
    videoCodec: video?.codec_name ? String(video.codec_name) : "",
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    fps: denominator ? numerator! / denominator : 0,
    durationSeconds: Number(raw.format?.duration ?? video?.duration ?? 0),
    hasAudio: Boolean(audio),
  };
}

function descendingArtifact(left: AssemblySelectionArtifact, right: AssemblySelectionArtifact) {
  const timeDifference = new Date(right.retainedAt).getTime() - new Date(left.retainedAt).getTime();
  return timeDifference || right.id.localeCompare(left.id);
}

export function computeAssemblySelection(
  approvedVersionId: string,
  specs: AssemblySelectionSpec[],
): AssemblySelection {
  const orderedSpecs = [...specs].sort((left, right) => left.ordinal - right.ordinal);
  const missingOrdinals: number[] = [];
  const sources: AssemblySourceSelection[] = [];

  for (const spec of orderedSpecs) {
    const selected = [...spec.artifacts]
      .filter((artifact) => {
        const latestDecision = [...artifact.humanQaDecisions].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        )[0];
        return (
          artifact.status === "TECHNICALLY_VALID" &&
          artifact.detectedMimeType === "video/mp4" &&
          latestDecision?.decision === "PASS" &&
          (!spec.frozenReuseArtifactId || artifact.id === spec.frozenReuseArtifactId)
        );
      })
      .sort(descendingArtifact)[0];
    if (!selected) {
      missingOrdinals.push(spec.ordinal);
      continue;
    }
    sources.push({
      ordinal: spec.ordinal,
      generationSpecId: spec.id,
      artifactId: selected.id,
      sha256: selected.sha256,
      byteSize: Number(selected.byteSize),
      detectedMimeType: selected.detectedMimeType,
    });
  }

  const eligible = orderedSpecs.length > 0 && missingOrdinals.length === 0;
  return {
    eligible,
    missingOrdinals,
    sources,
    sourceSetHash: eligible
      ? canonicalSha256({
          contractVersion: PLAN_ASSEMBLY_CONTRACT_VERSION,
          approvedVersionId,
          sources,
        })
      : null,
  };
}

export class GenerationPlanAssemblyService {
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

  async getAssemblyState(planId: string): Promise<any> {
    const snapshot = await this.loadSnapshot(planId);
    return this.stateView(snapshot.plan, snapshot.selection);
  }

  async createAssembly(input: {
    planId: string;
    expectedSourceSetHash?: string;
    idempotencyKey: string;
  }): Promise<{ created: boolean; assembly: any; state: any }> {
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 120) {
      throw new ProjectAssetError(
        "IDEMPOTENCY_KEY_INVALID",
        "A non-empty Idempotency-Key of at most 120 characters is required",
      );
    }
    const snapshot = await this.loadSnapshot(input.planId);
    const { plan, selection, artifactsById } = snapshot;
    if (!selection.eligible || !selection.sourceSetHash) {
      throw new ProjectAssetError(
        "ASSEMBLY_NOT_READY",
        `Owner PASS is still required for shot${selection.missingOrdinals.length === 1 ? "" : "s"} ${selection.missingOrdinals.join(", ")}`,
        409,
      );
    }
    const approvedVersionId = plan.approvedVersionId!;
    const sourceSetHash = selection.sourceSetHash!;
    if (input.expectedSourceSetHash && input.expectedSourceSetHash !== sourceSetHash) {
      throw new ProjectAssetError(
        "SOURCE_SET_CHANGED",
        "The accepted shot set changed; refresh before assembling",
        409,
      );
    }

    const existing = plan.assemblies.find(
      (assembly: any) => assembly.sourceSetHash === sourceSetHash,
    );
    if (existing) {
      return {
        created: false,
        assembly: this.assemblyView(existing, sourceSetHash),
        state: this.stateView(plan, selection),
      };
    }

    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "comfyuiflow-assembly-"));
    try {
      const selectedArtifacts = selection.sources.map((source) => {
        const artifact = artifactsById.get(source.artifactId);
        if (!artifact)
          throw new ProjectAssetError(
            "SOURCE_CONTENT_INVALID",
            `Accepted source for shot ${source.ordinal} is unavailable`,
            409,
          );
        return artifact;
      });
      const sourcePaths: string[] = [];
      try {
        for (const artifact of selectedArtifacts) {
          sourcePaths.push(
            await this.storage.resolveVerified(
              artifact.storageKey,
              artifact.sha256,
              Number(artifact.byteSize),
            ),
          );
        }
      } catch {
        throw new ProjectAssetError(
          "SOURCE_CONTENT_INVALID",
          "An accepted shot file is missing or changed",
          409,
        );
      }

      const sourceFacts = await Promise.all(sourcePaths.map(probeVideoFacts));
      const expectedDuration = sourceFacts.reduce(
        (total, facts) => total + facts.durationSeconds,
        0,
      );
      const outputPath = path.join(temporaryRoot, "approved-shot-plan.mp4");
      await assemblePortraitVideos(sourcePaths, outputPath);
      const outputFacts = await probeVideoFacts(outputPath);
      const durationTolerance = Math.max(0.25, 0.25 * Math.max(0, sourcePaths.length - 1));
      if (
        outputFacts.container !== "mov" ||
        outputFacts.videoCodec !== "h264" ||
        outputFacts.width !== 768 ||
        outputFacts.height !== 1344 ||
        Math.abs(outputFacts.fps - 24) >= 0.1 ||
        outputFacts.hasAudio ||
        Math.abs(outputFacts.durationSeconds - expectedDuration) > durationTolerance
      ) {
        throw new ProjectAssetError(
          "ASSEMBLY_MEDIA_INVALID",
          "The local combined video did not match the approved media profile",
          500,
        );
      }

      const preserved = await this.storage.preserve(createReadStream(outputPath));
      let created: any;
      try {
        created = await this.client.generationPlanAssembly.create({
          data: {
            id: randomUUID(),
            projectId: plan.projectId,
            generationPlanId: plan.id,
            generationPlanVersionId: approvedVersionId,
            sourceSetHash,
            storageKey: preserved.storageKey,
            sha256: preserved.sha256,
            byteSize: BigInt(preserved.byteSize),
            detectedMimeType: preserved.detectedMimeType,
            container: outputFacts.container,
            videoCodec: outputFacts.videoCodec,
            width: outputFacts.width,
            height: outputFacts.height,
            fps: outputFacts.fps,
            durationSeconds: outputFacts.durationSeconds,
            hasAudio: outputFacts.hasAudio,
            assemblerVersion: PLAN_ASSEMBLER_VERSION,
            sources: {
              create: selection.sources.map((source) => ({
                id: randomUUID(),
                projectId: plan.projectId,
                generationSpecId: source.generationSpecId,
                generatedArtifactId: source.artifactId,
                ordinal: source.ordinal,
                sourceSha256: source.sha256,
                sourceByteSize: BigInt(source.byteSize),
                sourceMimeType: source.detectedMimeType,
              })),
            },
          },
          include: { sources: { orderBy: { ordinal: "asc" } } },
        });
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
        created = await this.client.generationPlanAssembly.findUnique({
          where: {
            generationPlanVersionId_sourceSetHash: {
              generationPlanVersionId: approvedVersionId,
              sourceSetHash,
            },
          },
          include: { sources: { orderBy: { ordinal: "asc" } } },
        });
        if (!created) throw error;
        const refreshed = await this.getAssemblyState(plan.id);
        return {
          created: false,
          assembly: this.assemblyView(created, sourceSetHash),
          state: refreshed,
        };
      }

      const refreshed = await this.getAssemblyState(plan.id);
      return {
        created: true,
        assembly: this.assemblyView(created, sourceSetHash),
        state: refreshed,
      };
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  async getAssembly(assemblyId: string): Promise<any> {
    const assembly = await this.client.generationPlanAssembly.findUnique({
      where: { id: assemblyId },
      include: { sources: { orderBy: { ordinal: "asc" } } },
    });
    if (!assembly)
      throw new ProjectAssetError("ASSEMBLY_NOT_FOUND", "Combined video was not found", 404);
    return assembly;
  }

  async resolveAssemblyPath(assemblyId: string): Promise<string> {
    const assembly = await this.getAssembly(assemblyId);
    try {
      return await this.storage.resolveVerified(
        assembly.storageKey,
        assembly.sha256,
        Number(assembly.byteSize),
      );
    } catch {
      throw new ProjectAssetError(
        "ASSEMBLY_CONTENT_MISMATCH",
        "Combined video is unavailable or changed",
        500,
      );
    }
  }

  private async loadSnapshot(planId: string) {
    const plan = await this.client.generationPlan.findUnique({
      where: { id: planId },
      include: {
        approvedVersion: {
          include: {
            specs: {
              orderBy: { ordinal: "asc" },
              include: {
                generationTargets: {
                  include: {
                    generationBatch: { select: { createdAt: true } },
                    sourceArtifact: {
                      include: { humanQaDecisions: { orderBy: { createdAt: "desc" } } },
                    },
                    job: {
                      include: {
                        artifacts: {
                          include: {
                            humanQaDecisions: { orderBy: { createdAt: "desc" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        assemblies: {
          orderBy: { createdAt: "desc" },
          include: { sources: { orderBy: { ordinal: "asc" } } },
        },
      },
    });
    if (!plan) throw new ProjectAssetError("PLAN_NOT_FOUND", "Shot Plan was not found", 404);
    if (!plan.approvedVersionId || !plan.approvedVersion) {
      throw new ProjectAssetError(
        "PLAN_NOT_APPROVED",
        "Approve the Shot Plan before assembling videos",
        409,
      );
    }

    const artifactsById = new Map<string, any>();
    const specs: AssemblySelectionSpec[] = plan.approvedVersion.specs.map((spec: any) => {
      const latestTarget = [...spec.generationTargets].sort(
        (left: any, right: any) =>
          new Date(right.generationBatch.createdAt).getTime() -
            new Date(left.generationBatch.createdAt).getTime() || right.id.localeCompare(left.id),
      )[0] as any;
      const frozenReuseArtifactId =
        latestTarget?.executionDisposition === "REUSE_ARTIFACT"
          ? (latestTarget.sourceArtifactId ?? undefined)
          : undefined;
      const artifacts =
        frozenReuseArtifactId && latestTarget?.sourceArtifact
          ? [latestTarget.sourceArtifact]
          : spec.generationTargets.flatMap((target: any) => target.job?.artifacts ?? []);
      for (const artifact of artifacts) artifactsById.set(artifact.id, artifact);
      return {
        id: spec.id,
        ordinal: spec.ordinal,
        artifacts,
        ...(frozenReuseArtifactId ? { frozenReuseArtifactId } : {}),
      };
    });
    const selection = computeAssemblySelection(plan.approvedVersionId, specs);
    return { plan, selection, artifactsById };
  }

  private stateView(plan: any, selection: AssemblySelection) {
    const assemblies = plan.assemblies.map((assembly: any) =>
      this.assemblyView(assembly, selection.sourceSetHash),
    );
    return {
      eligible: selection.eligible,
      approvedVersionId: plan.approvedVersionId,
      missingOrdinals: selection.missingOrdinals,
      sourceSetHash: selection.sourceSetHash,
      sources: selection.sources,
      currentAssembly: assemblies.find((assembly: any) => !assembly.stale) ?? null,
      assemblies,
    };
  }

  private assemblyView(assembly: any, currentSourceSetHash: string | null) {
    return {
      id: assembly.id,
      sourceSetHash: assembly.sourceSetHash,
      sha256: assembly.sha256,
      byteSize: Number(assembly.byteSize),
      detectedMimeType: assembly.detectedMimeType,
      container: assembly.container,
      videoCodec: assembly.videoCodec,
      width: assembly.width,
      height: assembly.height,
      fps: assembly.fps,
      durationSeconds: assembly.durationSeconds,
      hasAudio: assembly.hasAudio,
      assemblerVersion: assembly.assemblerVersion,
      createdAt:
        assembly.createdAt instanceof Date
          ? assembly.createdAt.toISOString()
          : String(assembly.createdAt),
      stale: currentSourceSetHash === null || assembly.sourceSetHash !== currentSourceSetHash,
      contentUrl: `/api/generation-plan-assemblies/${assembly.id}/content`,
      downloadUrl: `/api/generation-plan-assemblies/${assembly.id}/content?download=1`,
      sources: assembly.sources.map((source: any) => ({
        ordinal: source.ordinal,
        generationSpecId: source.generationSpecId,
        artifactId: source.generatedArtifactId,
        sha256: source.sourceSha256,
        byteSize: Number(source.sourceByteSize),
        detectedMimeType: source.sourceMimeType,
      })),
    };
  }

  private isUniqueViolation(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
