import { randomUUID } from "node:crypto";
import { ProjectAssetError } from "./contracts.js";
import { canonicalSha256 } from "./canonical-json.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";
import {
  createDirectorRunSchema,
  directorPreviewInputSchema,
  rejectDirectorProposalSchema,
  adoptDirectorProposalSchema,
  type DirectorPreviewInput,
  type CreateDirectorRunInput,
  type AdoptDirectorProposalInput,
} from "./storyboard-director-contracts.js";
import { directorProfile } from "./storyboard-director-profiles.js";

const kindRank: Record<string, number> = {
  SCENE: 0,
  CHARACTER: 1,
  PRODUCT: 2,
  PROP: 3,
  OUTFIT: 4,
  HAIR: 4,
  MAKEUP: 4,
  ACCESSORY: 4,
};

export class StoryboardDirectorService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage(),
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async preview(storyboardId: string, rawInput: DirectorPreviewInput) {
    const input = directorPreviewInputSchema.parse(rawInput);
    const storyboard = await this.client.storyboard.findUnique({
      where: { id: storyboardId },
      include: { headVersion: { select: { id: true, versionNumber: true, contentHash: true } } },
    });
    if (!storyboard || storyboard.status !== "ACTIVE" || !storyboard.headVersion)
      throw error("STORYBOARD_NOT_READY", 409);
    const profile = directorProfile(input.profileId, this.environment);
    const rows = await this.client.assetVersionFile.findMany({
      where: {
        projectId: storyboard.projectId,
      },
      include: {
        productionAssetVersion: { include: { productionAsset: true } },
        projectAsset: { include: { storedObject: true } },
      },
    });
    rows.sort(
      (a, b) =>
        (kindRank[a.productionAssetVersion.productionAsset.type] ?? 9) -
          (kindRank[b.productionAssetVersion.productionAsset.type] ?? 9) ||
        a.productionAssetVersion.productionAsset.normalizedName.localeCompare(
          b.productionAssetVersion.productionAsset.normalizedName,
        ) ||
        a.id.localeCompare(b.id),
    );
    const eligible = [] as Array<ReturnType<typeof safeReference>>;
    const rejected: Array<{ assetVersionFileId: string; reason: string }> = [];
    for (const row of rows) {
      const reason =
        row.status !== "ACTIVE"
          ? "参考绑定不是 ACTIVE"
          : row.approvalStatus !== "ACCEPTED"
            ? "参考绑定尚未审批"
            : row.productionAssetVersion.status !== "ACTIVE"
              ? "语义版本不是 ACTIVE"
              : row.productionAssetVersion.productionAsset.status !== "ACTIVE"
                ? "语义素材不是 ACTIVE"
                : row.projectAsset.status !== "READY"
                  ? "图片文件不是 READY"
                  : row.projectAsset.mediaType !== "IMAGE"
                    ? "文件不是图片"
                    : row.projectAsset.storedObject.verificationStatus !== "VERIFIED"
                      ? "文件尚未完成哈希验证"
                      : null;
      if (reason) {
        rejected.push({ assetVersionFileId: row.id, reason });
        continue;
      }
      try {
        await this.storage.resolveVerified(
          row.projectAsset.storedObject.storageKey,
          row.projectAsset.storedObject.sha256,
          Number(row.projectAsset.storedObject.byteSize),
        );
        eligible.push(safeReference(row, eligible.length + 1));
      } catch {
        rejected.push({ assetVersionFileId: row.id, reason: "文件哈希复验失败" });
      }
    }
    const selectedIds =
      input.selectedAssetVersionFileIds ??
      eligible.slice(0, 9).map((item) => item.assetVersionFileId);
    if (
      selectedIds.length < 1 ||
      selectedIds.length > 9 ||
      new Set(selectedIds).size !== selectedIds.length
    )
      throw error("DIRECTOR_REFERENCE_SELECTION_INVALID");
    const byId = new Map(eligible.map((item) => [item.assetVersionFileId, item]));
    const selected = selectedIds.map((id) => byId.get(id));
    if (selected.some((item) => !item)) throw error("DIRECTOR_REFERENCE_INELIGIBLE", 409);
    const references = selected.map((item, index) => ({
      ...item!,
      ordinal: index + 1,
      alias: `ref_${String(index + 1).padStart(2, "0")}`,
    }));
    const scope = {
      contractVersion: "storyboard-generation-v2",
      promptTemplateVersion: "storyboard-director-v2",
      storyboardId,
      headVersionId: storyboard.headVersion.id,
      headContentHash: storyboard.headVersion.contentHash,
      profileId: profile.id,
      providerId: profile.providerId,
      modelId: profile.modelId,
      maxShotCount: input.maxShotCount,
      creativeBrief: storyboard.creativeBrief,
      references,
      priceSnapshotHash: profile.priceSnapshotHash,
    };
    const scopeHash = canonicalSha256(scope);
    return {
      ...scope,
      scopeHash,
      requestHash: canonicalSha256({ ...scope, scopeHash }),
      previewHash: canonicalSha256({ ...scope, scopeHash, kind: "DIRECTOR_PREVIEW" }),
      billingChannel: profile.billingChannel,
      maxCostUsd: profile.maxCostUsd,
      priceEffectiveAt: profile.priceEffectiveAt.toISOString(),
      priceExpiresAt: profile.priceExpiresAt.toISOString(),
      maxExternalCalls: profile.external ? 1 : 0,
      externalCalls: 0,
      retryPolicy: "NO_RETRY_NO_FALLBACK" as const,
      recommended: eligible.slice(0, 9),
      unselected: eligible.filter((item) => !selectedIds.includes(item.assetVersionFileId)),
      rejected,
    };
  }

  async confirm(
    storyboardId: string,
    expectedRowVersion: number,
    rawInput: CreateDirectorRunInput,
  ) {
    const input = createDirectorRunSchema.parse(rawInput);
    const preview = await this.preview(storyboardId, {
      profileId: input.profileId,
      maxShotCount: input.maxShotCount,
      ...(input.selectedAssetVersionFileIds
        ? { selectedAssetVersionFileIds: input.selectedAssetVersionFileIds }
        : {}),
    });
    if (preview.previewHash !== input.previewHash) throw error("DIRECTOR_PREVIEW_STALE", 409);
    try {
      return await this.client.$transaction(async (tx) => {
        const board = await tx.storyboard.findUnique({ where: { id: storyboardId } });
        if (
          !board ||
          board.rowVersion !== expectedRowVersion ||
          board.headVersionId !== preview.headVersionId
        )
          throw error("STORYBOARD_CONFLICT", 412);
        const existing = await tx.storyboardDirectorRun.findFirst({
          where: { storyboardId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
        if (
          await tx.storyboardDirectorRun.findFirst({
            where: { storyboardId, status: { in: ["QUEUED", "RUNNING"] } },
          })
        ) {
          throw error("DIRECTOR_RUN_ALREADY_ACTIVE", 409);
        }
        const run = await tx.storyboardDirectorRun.create({
          data: {
            projectId: board.projectId,
            storyboardId,
            providerId: preview.providerId,
            requestedModelId: preview.modelId,
            contractVersion: preview.contractVersion,
            promptTemplateVersion: preview.promptTemplateVersion,
            requestHash: preview.requestHash,
            status: "QUEUED",
            safeResultCode: "DIRECTOR_QUEUED",
            providerCallCount: 0,
            maxShotCount: preview.maxShotCount,
            headVersionId: preview.headVersionId,
            headContentHash: preview.headContentHash,
            scopeHash: preview.scopeHash,
            priceSnapshotHash: preview.priceSnapshotHash,
            billingChannel: preview.billingChannel,
            maxCostUsd: preview.maxCostUsd,
            priceEffectiveAt: new Date(preview.priceEffectiveAt),
            priceExpiresAt: new Date(preview.priceExpiresAt),
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.storyboardDirectorInputReference.createMany({
          data: preview.references.map((ref) => ({
            id: randomUUID(),
            projectId: board.projectId,
            runId: run.id,
            ordinal: ref.ordinal,
            alias: ref.alias,
            kind: ref.kind,
            displayName: ref.displayName,
            productionAssetId: ref.productionAssetId,
            productionAssetVersionId: ref.productionAssetVersionId,
            assetVersionFileId: ref.assetVersionFileId,
            projectAssetId: ref.projectAssetId,
            semanticFactsJson: ref.semanticFacts as never,
            sha256: ref.sha256,
            byteSize: BigInt(ref.byteSize),
          })),
        });
        await tx.storyboardDirectorAuthorization.create({
          data: {
            projectId: board.projectId,
            runId: run.id,
            maxCalls: 1,
            expiresAt: new Date(preview.priceExpiresAt),
          },
        });
        return run;
      });
    } catch (cause) {
      if (cause instanceof ProjectAssetError) throw cause;
      if (cause instanceof Error && /unique|P2002|one_active_per_storyboard/i.test(cause.message))
        throw error("DIRECTOR_RUN_ALREADY_ACTIVE", 409);
      throw cause;
    }
  }

  async getRun(runId: string) {
    const run = await this.client.storyboardDirectorRun.findUnique({
      where: { id: runId },
      include: { attempts: true, proposal: { select: { id: true, outputHash: true } } },
    });
    if (!run) throw error("DIRECTOR_RUN_NOT_FOUND", 404);
    return run;
  }
  async listProposals(storyboardId: string) {
    return this.client.storyboardDirectorProposal.findMany({
      where: { storyboardId },
      include: { decisions: true },
      orderBy: { createdAt: "desc" },
    });
  }
  async getProposal(proposalId: string) {
    const value = await this.loadProposal(proposalId);
    return {
      id: value.id,
      narrativeSummary: value.narrativeSummary,
      normalizedProposalJson: value.normalizedProposalJson,
      outputHash: value.outputHash,
      createdAt: value.createdAt,
      decisions: value.decisions,
      references: value.run.inputReferences.map((reference) => ({
        alias: reference.alias,
        kind: reference.kind,
        displayName: reference.displayName,
        sha256: reference.sha256,
      })),
    };
  }

  private async loadProposal(proposalId: string) {
    const value = await this.client.storyboardDirectorProposal.findUnique({
      where: { id: proposalId },
      include: {
        run: { include: { inputReferences: { orderBy: { ordinal: "asc" } } } },
        decisions: true,
      },
    });
    if (!value) throw error("DIRECTOR_PROPOSAL_NOT_FOUND", 404);
    return value;
  }
  async reject(proposalId: string, raw: unknown) {
    const input = rejectDirectorProposalSchema.parse(raw);
    const proposal = await this.loadProposal(proposalId);
    const existing = await this.client.storyboardDirectorProposalDecision.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.proposalId !== proposalId || existing.type !== "REJECTED")
        throw error("IDEMPOTENCY_CONFLICT", 409);
      return existing;
    }
    if (proposal.decisions.length > 0) throw error("DIRECTOR_PROPOSAL_ALREADY_DECIDED", 409);
    return this.client.storyboardDirectorProposalDecision.create({
      data: {
        projectId: proposal.projectId,
        proposalId,
        type: "REJECTED",
        ...(input.note ? { note: input.note } : {}),
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async adopt(proposalId: string, expectedRowVersion: number, raw: AdoptDirectorProposalInput) {
    const input = adoptDirectorProposalSchema.parse(raw);
    const proposal = await this.loadProposal(proposalId);
    const prior = await this.client.storyboardDirectorProposalDecision.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (prior) {
      if (prior.proposalId !== proposalId || prior.type !== "ADOPTED")
        throw error("IDEMPOTENCY_CONFLICT", 409);
      return prior;
    }
    if (proposal.decisions.length > 0) throw error("DIRECTOR_PROPOSAL_ALREADY_DECIDED", 409);
    const aliases = new Set(proposal.run.inputReferences.map((ref) => ref.alias));
    if (
      input.shots.some(
        (shot, index) =>
          shot.ordinal !== index + 1 || shot.referenceAliases.some((alias) => !aliases.has(alias)),
      )
    )
      throw error("DIRECTOR_PROPOSAL_INVALID");
    for (const ref of proposal.run.inputReferences) {
      const file = await this.client.assetVersionFile.findUnique({
        where: { id: ref.assetVersionFileId },
        include: {
          productionAssetVersion: { include: { productionAsset: true } },
          projectAsset: { include: { storedObject: true } },
        },
      });
      if (
        !file ||
        file.projectId !== proposal.projectId ||
        file.status !== "ACTIVE" ||
        file.approvalStatus !== "ACCEPTED" ||
        file.productionAssetVersion.status !== "ACTIVE" ||
        file.productionAssetVersion.productionAsset.status !== "ACTIVE" ||
        file.projectAsset.status !== "READY" ||
        file.projectAsset.mediaType !== "IMAGE" ||
        file.projectAsset.storedObject.verificationStatus !== "VERIFIED" ||
        file.projectAsset.storedObject.sha256 !== ref.sha256
      )
        throw error("DIRECTOR_REFERENCE_DRIFT", 409);
      await this.storage.resolveVerified(
        file.projectAsset.storedObject.storageKey,
        ref.sha256,
        Number(ref.byteSize),
      );
    }
    return this.client.$transaction(async (tx) => {
      const board = await tx.storyboard.findUnique({ where: { id: proposal.storyboardId } });
      if (
        !board ||
        board.rowVersion !== expectedRowVersion ||
        board.headVersionId !== proposal.run.headVersionId
      )
        throw error("STORYBOARD_CONFLICT", 412);
      const existing = await tx.storyboardDirectorProposalDecision.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
      const versionId = randomUUID();
      const contentHash = canonicalSha256({
        creativeBrief: board.creativeBrief,
        shots: input.shots,
      });
      await tx.storyboardVersion.create({
        data: {
          id: versionId,
          projectId: board.projectId,
          storyboardId: board.id,
          versionNumber: board.rowVersion + 1,
          parentVersionId: board.headVersionId,
          source: "AI_DIRECTOR",
          creativeBrief: board.creativeBrief,
          contractVersion: "storyboard-version-v1",
          contentHash,
          sourceProposalId: proposal.id,
          shots: {
            create: input.shots.map((shot) => ({
              projectId: board.projectId,
              shotKey: shot.shotKey,
              ordinal: shot.ordinal,
              title: shot.title,
              creativeDescription: shot.creativeDescription,
              startState: shot.startState,
              action: shot.action,
              endState: shot.endState,
              camera: shot.camera,
              composition: shot.composition,
              continuityRequirements: shot.continuityRequirements,
              durationSeconds: shot.durationSeconds,
            })),
          },
        },
      });
      const updated = await tx.storyboard.updateMany({
        where: { id: board.id, rowVersion: expectedRowVersion },
        data: { headVersionId: versionId, approvedVersionId: null, rowVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw error("STORYBOARD_CONFLICT", 412);
      return tx.storyboardDirectorProposalDecision.create({
        data: {
          projectId: board.projectId,
          proposalId,
          type: "ADOPTED",
          adoptedVersionId: versionId,
          idempotencyKey: input.idempotencyKey,
        },
      });
    });
  }
}

function safeReference(row: any, ordinal: number) {
  const type = row.productionAssetVersion.productionAsset.type as string;
  const kind =
    type === "SCENE"
      ? "SCENE"
      : type === "CHARACTER"
        ? "CHARACTER"
        : type === "PRODUCT"
          ? "PRODUCT"
          : type === "PROP"
            ? "PROP"
            : "APPEARANCE";
  return {
    ordinal,
    alias: `ref_${String(ordinal).padStart(2, "0")}`,
    kind,
    displayName: row.productionAssetVersion.displayName,
    productionAssetId: row.productionAssetVersion.productionAssetId,
    productionAssetVersionId: row.productionAssetVersionId,
    assetVersionFileId: row.id,
    projectAssetId: row.projectAssetId,
    semanticFacts: row.productionAssetVersion.factsJson ?? {},
    sha256: row.projectAsset.storedObject.sha256,
    byteSize: Number(row.projectAsset.storedObject.byteSize),
  };
}
function error(code: string, status = 400) {
  return new ProjectAssetError(code, code, status);
}
