import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assemblePortraitVideos,
  PLAN_ASSEMBLER_VERSION,
  probeVideoFacts,
} from "./generation-plan-assembly-service.js";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export const PLAN_DRAFT_CONTRACT_VERSION = "generation-plan-draft-v1";

interface DraftSource {
  ordinal: number;
  generationSpecId: string;
  artifactId: string;
  sha256: string;
  byteSize: number;
  detectedMimeType: string;
  humanQaState: string;
  warnings: string[];
}

export function computeDraftSelection(
  approvedVersionId: string,
  specs: Array<{
    id: string;
    ordinal: number;
    artifacts: Array<{
      id: string;
      sha256: string;
      byteSize: number | bigint;
      detectedMimeType: string;
      status: string;
      retainedAt: Date | string;
      humanQaDecisions: Array<{ decision: string; createdAt: Date | string }>;
      aiQaRuns: Array<{ result: null | { overallStatus: string; summary: string } }>;
    }>;
  }>,
) {
  const missingOrdinals: number[] = [];
  const sources: DraftSource[] = [];
  for (const spec of [...specs].sort((a, b) => a.ordinal - b.ordinal)) {
    const artifact = [...spec.artifacts]
      .filter(
        (item) => item.status === "TECHNICALLY_VALID" && item.detectedMimeType === "video/mp4",
      )
      .sort(
        (a, b) =>
          new Date(b.retainedAt).getTime() - new Date(a.retainedAt).getTime() ||
          b.id.localeCompare(a.id),
      )[0];
    if (!artifact) {
      missingOrdinals.push(spec.ordinal);
      continue;
    }
    const humanQaState =
      [...artifact.humanQaDecisions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]?.decision ?? "PENDING";
    const qa = artifact.aiQaRuns.find((run) => run.result)?.result;
    const warnings = [
      ...(humanQaState === "PASS" ? [] : [`人工审核：${humanQaState}`]),
      ...(qa && qa.overallStatus !== "PASS" ? [`AI QA ${qa.overallStatus}：${qa.summary}`] : []),
    ];
    sources.push({
      ordinal: spec.ordinal,
      generationSpecId: spec.id,
      artifactId: artifact.id,
      sha256: artifact.sha256,
      byteSize: Number(artifact.byteSize),
      detectedMimeType: artifact.detectedMimeType,
      humanQaState,
      warnings,
    });
  }
  const eligible = specs.length > 0 && missingOrdinals.length === 0;
  const sourceSetHash = eligible
    ? canonicalSha256({
        contractVersion: PLAN_DRAFT_CONTRACT_VERSION,
        approvedVersionId,
        sources: sources.map((source) => ({
          ordinal: source.ordinal,
          generationSpecId: source.generationSpecId,
          artifactId: source.artifactId,
          sha256: source.sha256,
          byteSize: source.byteSize,
          detectedMimeType: source.detectedMimeType,
        })),
      })
    : null;
  const warnings = sources.flatMap((source) =>
    source.warnings.map((warning) => ({ ordinal: source.ordinal, warning })),
  );
  return {
    eligible,
    missingOrdinals,
    sources,
    sourceSetHash,
    warnings,
    warningsHash: canonicalSha256(warnings),
  };
}

export class GenerationPlanDraftService {
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

  async getState(planId: string) {
    const snapshot = await this.loadSnapshot(planId);
    return this.stateView(snapshot.plan, snapshot.selection);
  }

  async create(input: { planId: string; expectedSourceSetHash?: string; idempotencyKey: string }) {
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 120)
      throw new ProjectAssetError(
        "IDEMPOTENCY_KEY_INVALID",
        "A non-empty Idempotency-Key of at most 120 characters is required",
      );
    const snapshot = await this.loadSnapshot(input.planId);
    const { plan, selection, artifactsById } = snapshot;
    if (!selection.eligible || !selection.sourceSetHash)
      throw new ProjectAssetError(
        "DRAFT_SOURCE_INCOMPLETE",
        `可播放结果仍缺少 Shot ${selection.missingOrdinals.join(", ")}`,
        409,
      );
    if (input.expectedSourceSetHash && input.expectedSourceSetHash !== selection.sourceSetHash)
      throw new ProjectAssetError("SOURCE_SET_CHANGED", "Draft sources changed; refresh", 409);
    const existing = plan.drafts.find(
      (draft: any) =>
        draft.sourceSetHash === selection.sourceSetHash &&
        draft.warningsHash === selection.warningsHash,
    );
    if (existing)
      return {
        created: false,
        draft: this.draftView(existing, selection.sourceSetHash, selection.warningsHash),
        state: this.stateView(plan, selection),
      };

    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "comfyuiflow-draft-"));
    try {
      const sourcePaths: string[] = [];
      for (const source of selection.sources) {
        const artifact = artifactsById.get(source.artifactId);
        if (!artifact)
          throw new ProjectAssetError(
            "DRAFT_SOURCE_INCOMPLETE",
            "Draft source is unavailable",
            409,
          );
        try {
          sourcePaths.push(
            await this.storage.resolveVerified(
              artifact.storageKey,
              artifact.sha256,
              Number(artifact.byteSize),
            ),
          );
        } catch {
          throw new ProjectAssetError(
            "SOURCE_CONTENT_INVALID",
            "A draft shot file is missing or changed",
            409,
          );
        }
      }
      const sourceFacts = await Promise.all(sourcePaths.map(probeVideoFacts));
      const expectedDuration = sourceFacts.reduce((sum, facts) => sum + facts.durationSeconds, 0);
      const outputPath = path.join(temporaryRoot, "whole-film-draft.mp4");
      await assemblePortraitVideos(sourcePaths, outputPath);
      const facts = await probeVideoFacts(outputPath);
      const tolerance = Math.max(0.25, 0.25 * Math.max(0, sourcePaths.length - 1));
      if (
        facts.container !== "mov" ||
        facts.videoCodec !== "h264" ||
        facts.width !== 768 ||
        facts.height !== 1344 ||
        Math.abs(facts.fps - 24) >= 0.1 ||
        facts.hasAudio ||
        Math.abs(facts.durationSeconds - expectedDuration) > tolerance
      )
        throw new ProjectAssetError("ASSEMBLY_MEDIA_INVALID", "Local draft media is invalid", 500);
      const preserved = await this.storage.preserve(createReadStream(outputPath));
      const created = await this.client.generationPlanDraft.create({
        data: {
          id: randomUUID(),
          projectId: plan.projectId,
          generationPlanId: plan.id,
          generationPlanVersionId: plan.approvedVersionId!,
          sourceSetHash: selection.sourceSetHash,
          warningsJson: selection.warnings,
          warningsHash: selection.warningsHash,
          storageKey: preserved.storageKey,
          sha256: preserved.sha256,
          byteSize: BigInt(preserved.byteSize),
          detectedMimeType: preserved.detectedMimeType,
          container: facts.container,
          videoCodec: facts.videoCodec,
          width: facts.width,
          height: facts.height,
          fps: facts.fps,
          durationSeconds: facts.durationSeconds,
          hasAudio: facts.hasAudio,
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
              humanQaState: source.humanQaState,
              warningsJson: source.warnings,
            })),
          },
        },
        include: { sources: { orderBy: { ordinal: "asc" } } },
      });
      return {
        created: true,
        draft: this.draftView(created, selection.sourceSetHash, selection.warningsHash),
        state: await this.getState(plan.id),
      };
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  async getDraft(draftId: string) {
    const draft = await this.client.generationPlanDraft.findUnique({
      where: { id: draftId },
      include: { sources: { orderBy: { ordinal: "asc" } } },
    });
    if (!draft)
      throw new ProjectAssetError("DRAFT_NOT_FOUND", "Whole-film draft was not found", 404);
    return draft;
  }

  async resolvePath(draftId: string) {
    const draft = await this.getDraft(draftId);
    return this.storage.resolveVerified(draft.storageKey, draft.sha256, Number(draft.byteSize));
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
                    job: {
                      include: {
                        artifacts: {
                          include: {
                            humanQaDecisions: { orderBy: { createdAt: "desc" } },
                            aiQaRuns: {
                              where: { status: "COMPLETED" },
                              include: { result: true },
                              orderBy: { createdAt: "desc" },
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
        },
        drafts: {
          orderBy: { createdAt: "desc" },
          include: { sources: { orderBy: { ordinal: "asc" } } },
        },
      },
    });
    if (!plan) throw new ProjectAssetError("PLAN_NOT_FOUND", "Shot Plan was not found", 404);
    if (!plan.approvedVersionId || !plan.approvedVersion)
      throw new ProjectAssetError("PLAN_NOT_APPROVED", "Approve the Shot Plan first", 409);
    const artifactsById = new Map<string, any>();
    const specs = plan.approvedVersion.specs.map((spec) => {
      const artifacts = spec.generationTargets.flatMap((target) => target.job?.artifacts ?? []);
      artifacts.forEach((artifact) => artifactsById.set(artifact.id, artifact));
      return { id: spec.id, ordinal: spec.ordinal, artifacts };
    });
    return {
      plan,
      artifactsById,
      selection: computeDraftSelection(plan.approvedVersionId, specs),
    };
  }

  private stateView(plan: any, selection: ReturnType<typeof computeDraftSelection>) {
    const drafts = plan.drafts.map((draft: any) =>
      this.draftView(draft, selection.sourceSetHash, selection.warningsHash),
    );
    return {
      eligible: selection.eligible,
      approvedVersionId: plan.approvedVersionId,
      missingOrdinals: selection.missingOrdinals,
      sourceSetHash: selection.sourceSetHash,
      warnings: selection.warnings,
      sources: selection.sources,
      currentDraft: drafts.find((draft: any) => !draft.stale) ?? null,
      history: drafts,
      externalCalls: 0,
      finalApproval: false,
    };
  }

  private draftView(draft: any, currentSourceHash: string | null, currentWarningsHash: string) {
    return {
      id: draft.id,
      sourceSetHash: draft.sourceSetHash,
      warnings: draft.warningsJson,
      sha256: draft.sha256,
      byteSize: Number(draft.byteSize),
      detectedMimeType: draft.detectedMimeType,
      width: draft.width,
      height: draft.height,
      fps: draft.fps,
      durationSeconds: draft.durationSeconds,
      createdAt: draft.createdAt,
      contentUrl: `/api/generation-plan-drafts/${draft.id}/content`,
      downloadUrl: `/api/generation-plan-drafts/${draft.id}/content?download=1`,
      sources: draft.sources.map((source: any) => ({
        ordinal: source.ordinal,
        generationSpecId: source.generationSpecId,
        artifactId: source.generatedArtifactId,
        humanQaState: source.humanQaState,
        warnings: source.warningsJson,
      })),
      stale:
        draft.sourceSetHash !== currentSourceHash || draft.warningsHash !== currentWarningsHash,
      final: false,
    };
  }
}
