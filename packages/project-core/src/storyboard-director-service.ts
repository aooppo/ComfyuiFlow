import { randomUUID } from "node:crypto";
import { ProjectAssetError } from "./contracts.js";
import { canonicalSha256 } from "./canonical-json.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";
import {
  adoptWorkflowRepairProposalSchema,
  createRepairDirectorRunSchema,
  createDirectorRunSchema,
  directorPreviewInputSchema,
  repairDirectorPreviewInputSchema,
  rejectDirectorProposalSchema,
  adoptDirectorProposalSchema,
  type AdoptWorkflowRepairProposalInput,
  type CreateRepairDirectorRunInput,
  type DirectorPreviewInput,
  type CreateDirectorRunInput,
  type RepairDirectorPreviewInput,
  type AdoptDirectorProposalInput,
} from "./storyboard-director-contracts.js";
import { directorProfile } from "./storyboard-director-profiles.js";
import { WorkflowRepairService } from "./workflow-agent/workflow-repair-service.js";

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
      (input.selectedAssetVersionFileIds !== undefined && selectedIds.length < 1) ||
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
      canConfirm: references.length > 0,
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

  async previewRepair(planId: string, rawInput: RepairDirectorPreviewInput) {
    const input = repairDirectorPreviewInputSchema.parse(rawInput);
    const context = await this.loadRepairContext(
      planId,
      input.proposalHash,
      input.impactHash,
      input.action,
    );
    const base = await this.preview(context.storyboardId, {
      profileId: input.profileId,
      maxShotCount: input.action === "REWRITE_SHOT" ? 1 : 2,
      ...(input.selectedAssetVersionFileIds
        ? { selectedAssetVersionFileIds: input.selectedAssetVersionFileIds }
        : {}),
    });
    const scope = {
      schemaVersion: "shot-repair-director-preview-v1" as const,
      runKind: "SHOT_REPAIR" as const,
      shotExecutionPlanId: planId,
      sourceStoryboardVersionId: context.sourceStoryboardVersionId,
      blockedShotKey: context.blockedShotKey,
      repairAction: input.action,
      repairProposalHash: input.proposalHash,
      impactHash: input.impactHash,
      neighboringShotKeys: context.neighboringShotKeys,
      baseScopeHash: base.scopeHash,
    };
    const scopeHash = canonicalSha256(scope);
    return {
      ...base,
      ...scope,
      scopeHash,
      requestHash: canonicalSha256({ ...scope, scopeHash }),
      previewHash: canonicalSha256({ ...scope, scopeHash, kind: "SHOT_REPAIR_DIRECTOR_PREVIEW" }),
      externalCalls: 0 as const,
      generationAuthorized: false as const,
      directorAuthorized: false as const,
    };
  }

  async confirmRepair(
    planId: string,
    expectedStoryboardRowVersion: number,
    rawInput: CreateRepairDirectorRunInput,
  ) {
    const input = createRepairDirectorRunSchema.parse(rawInput);
    const preview = await this.previewRepair(planId, {
      proposalHash: input.proposalHash,
      impactHash: input.impactHash,
      action: input.action,
      profileId: input.profileId,
      ...(input.selectedAssetVersionFileIds
        ? { selectedAssetVersionFileIds: input.selectedAssetVersionFileIds }
        : {}),
    });
    if (!preview.canConfirm) throw error("DIRECTOR_REFERENCE_SELECTION_INVALID", 409);
    if (preview.previewHash !== input.previewHash) throw error("DIRECTOR_PREVIEW_STALE", 409);
    try {
      return await this.client.$transaction(async (tx) => {
        const board = await tx.storyboard.findUnique({ where: { id: preview.storyboardId } });
        if (
          !board ||
          board.rowVersion !== expectedStoryboardRowVersion ||
          board.headVersionId !== preview.sourceStoryboardVersionId
        )
          throw error("STORYBOARD_CONFLICT", 412);
        const existing = await tx.storyboardDirectorRun.findFirst({
          where: { storyboardId: board.id, idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
        if (
          await tx.storyboardDirectorRun.findFirst({
            where: { storyboardId: board.id, status: { in: ["QUEUED", "RUNNING"] } },
          })
        )
          throw error("DIRECTOR_RUN_ALREADY_ACTIVE", 409);
        const run = await tx.storyboardDirectorRun.create({
          data: {
            projectId: board.projectId,
            storyboardId: board.id,
            providerId: preview.providerId,
            requestedModelId: preview.modelId,
            contractVersion: preview.contractVersion,
            promptTemplateVersion: preview.promptTemplateVersion,
            requestHash: preview.requestHash,
            status: "QUEUED",
            safeResultCode: "DIRECTOR_REPAIR_QUEUED",
            providerCallCount: 0,
            maxShotCount: preview.maxShotCount,
            headVersionId: preview.sourceStoryboardVersionId,
            headContentHash: preview.headContentHash,
            scopeHash: preview.scopeHash,
            priceSnapshotHash: preview.priceSnapshotHash,
            billingChannel: preview.billingChannel,
            maxCostUsd: preview.maxCostUsd,
            priceEffectiveAt: new Date(preview.priceEffectiveAt),
            priceExpiresAt: new Date(preview.priceExpiresAt),
            idempotencyKey: input.idempotencyKey,
            runKind: "SHOT_REPAIR",
            sourceStoryboardVersionId: preview.sourceStoryboardVersionId,
            blockedShotKey: preview.blockedShotKey,
            repairAction: input.action,
            impactHash: input.impactHash,
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

  private async loadRepairContext(
    planId: string,
    proposalHash: string,
    impactHash: string,
    action: "REWRITE_SHOT" | "SPLIT_SHOT",
  ) {
    const repair = await new WorkflowRepairService(this.client).preview(planId);
    const proposal = repair.proposals.find((item) => item.proposalHash === proposalHash);
    if (
      !proposal ||
      proposal.action !== action ||
      !proposal.requiresAiDirector ||
      repair.impactHash !== impactHash
    )
      throw error("REPAIR_PROPOSAL_STALE", 409);
    const plan = await this.client.shotExecutionPlan.findUnique({
      where: { id: planId },
      include: {
        generationSpec: true,
        generationPlanVersion: {
          include: {
            generationPlan: {
              include: {
                storyboardVersion: { include: { shots: { orderBy: { ordinal: "asc" } } } },
              },
            },
          },
        },
      },
    });
    if (!plan) throw error("GENERATION_TARGET_INVALID", 404);
    const source = plan.generationPlanVersion.generationPlan.storyboardVersion;
    const index = source.shots.findIndex((shot) => shot.shotKey === plan.generationSpec.shotKey);
    if (index < 0) throw error("GENERATION_TARGET_INVALID", 409);
    return {
      storyboardId: plan.generationPlanVersion.generationPlan.storyboardId,
      sourceStoryboardVersionId: source.id,
      blockedShotKey: plan.generationSpec.shotKey,
      neighboringShotKeys: [
        source.shots[index - 1]?.shotKey,
        source.shots[index + 1]?.shotKey,
      ].filter((value): value is string => Boolean(value)),
    };
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
    if (proposal.proposalKind === "SHOT_REPAIR")
      throw error("WORKFLOW_REPAIR_ADOPT_ROUTE_REQUIRED", 409);
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

  async adoptRepair(
    proposalId: string,
    expectedStoryboardRowVersion: number,
    raw: AdoptWorkflowRepairProposalInput,
  ) {
    const input = adoptWorkflowRepairProposalSchema.parse(raw);
    const proposal = await this.loadProposal(proposalId);
    if (
      proposal.proposalKind !== "SHOT_REPAIR" ||
      proposal.run.runKind !== "SHOT_REPAIR" ||
      !proposal.run.sourceStoryboardVersionId ||
      !proposal.run.blockedShotKey ||
      !proposal.run.repairAction ||
      !proposal.impactHash
    )
      throw error("DIRECTOR_REPAIR_PROPOSAL_INVALID", 409);
    if (input.proposalHash !== proposal.outputHash || input.impactHash !== proposal.impactHash)
      throw error("REPAIR_PROPOSAL_STALE", 409);
    if (proposal.decisions.length > 0) throw error("DIRECTOR_PROPOSAL_ALREADY_DECIDED", 409);
    const expectedRepairShots = (proposal.normalizedProposalJson as any)?.shots;
    const expectedKeys = Array.isArray(expectedRepairShots)
      ? expectedRepairShots.map((shot: any) => shot?.shotKey)
      : [];
    if (
      input.shots.some((shot, index) => shot.ordinal !== index + 1) ||
      input.shots.length !== expectedKeys.length ||
      input.shots.some((shot, index) => shot.shotKey !== expectedKeys[index]) ||
      (proposal.run.repairAction === "REWRITE_SHOT" &&
        (input.shots.length !== 1 || input.shots[0]?.shotKey !== proposal.run.blockedShotKey)) ||
      (proposal.run.repairAction === "SPLIT_SHOT" && input.shots.length < 2)
    )
      throw error("DIRECTOR_REPAIR_PROPOSAL_INVALID", 422);
    const aliases = new Set(proposal.run.inputReferences.map((reference) => reference.alias));
    if (input.shots.some((shot) => shot.referenceAliases.some((alias) => !aliases.has(alias))))
      throw error("DIRECTOR_REPAIR_PROPOSAL_INVALID", 422);

    const source = await this.client.storyboardVersion.findUnique({
      where: { id: proposal.run.sourceStoryboardVersionId },
      include: {
        shots: { include: { requirements: true }, orderBy: { ordinal: "asc" } },
        manifest: { include: { bindings: true } },
      },
    });
    if (!source || source.storyboardId !== proposal.storyboardId)
      throw error("DIRECTOR_REPAIR_SOURCE_INVALID", 409);
    const blockedIndex = source.shots.findIndex(
      (shot) => shot.shotKey === proposal.run.blockedShotKey,
    );
    if (blockedIndex < 0) throw error("DIRECTOR_REPAIR_SOURCE_INVALID", 409);

    const currentPlan = await this.client.shotExecutionPlan.findFirst({
      where: {
        planningOutcome: "BLOCKED",
        generationSpec: { shotKey: proposal.run.blockedShotKey },
        generationPlanVersion: {
          generationPlan: { storyboardVersionId: source.id },
        },
      },
      include: { generationPlanVersion: { include: { generationPlan: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (
      !currentPlan ||
      currentPlan.generationPlanVersion.generationPlan.headVersionId !==
        currentPlan.generationPlanVersionId
    )
      throw error("REPAIR_PROPOSAL_STALE", 409);
    const repair = await new WorkflowRepairService(this.client).preview(currentPlan.id);
    const currentRepair = repair.proposals.find(
      (item) => item.action === proposal.run.repairAction,
    );
    if (!currentRepair || repair.impactHash !== proposal.impactHash)
      throw error("REPAIR_PROPOSAL_STALE", 409);

    const referenceFiles = new Map<string, any>();
    for (const reference of proposal.run.inputReferences) {
      const file = await this.client.assetVersionFile.findUnique({
        where: { id: reference.assetVersionFileId },
        include: {
          productionAssetVersion: { include: { productionAsset: true } },
          projectAsset: { include: { storedObject: true } },
        },
      });
      await this.assertReferenceCurrent(reference, file, proposal.projectId);
      referenceFiles.set(reference.alias, file);
    }
    const sourceBindings = source.manifest?.bindings ?? [];
    const bindingFiles = new Map<string, any>();
    for (const binding of sourceBindings) {
      const file = await this.client.assetVersionFile.findUnique({
        where: { id: binding.assetVersionFileId },
        include: {
          productionAssetVersion: { include: { productionAsset: true } },
          projectAsset: { include: { storedObject: true } },
        },
      });
      await this.assertBindingCurrent(binding, file, proposal.projectId);
      bindingFiles.set(binding.assetVersionFileId, file);
    }

    const replacementShots = input.shots.map((shot) => ({ ...shot }));
    const mergedShots = [
      ...source.shots.slice(0, blockedIndex).map(dbShot),
      ...replacementShots,
      ...source.shots.slice(blockedIndex + 1).map(dbShot),
    ].map((shot, index) => ({ ...shot, ordinal: index + 1 }));
    const unaffectedKeys = new Set(
      source.shots
        .filter((shot) => shot.shotKey !== proposal.run.blockedShotKey)
        .map((shot) => shot.shotKey),
    );
    const sourceShotByKey = new Map(source.shots.map((shot) => [shot.shotKey, shot]));
    const sourceBindingsByRequirement = new Map<string, typeof sourceBindings>();
    for (const binding of sourceBindings) {
      const values = sourceBindingsByRequirement.get(binding.requirementId) ?? [];
      values.push(binding);
      sourceBindingsByRequirement.set(binding.requirementId, values);
    }

    const result = await this.client.$transaction(
      async (tx) => {
        const board = await tx.storyboard.findUnique({ where: { id: proposal.storyboardId } });
        if (
          !board ||
          board.rowVersion !== expectedStoryboardRowVersion ||
          board.headVersionId !== source.id
        )
          throw error("STORYBOARD_CONFLICT", 412);
        const prior = await tx.storyboardDirectorProposalDecision.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (prior) {
          if (prior.proposalId !== proposalId || prior.type !== "ADOPTED")
            throw error("IDEMPOTENCY_CONFLICT", 409);
          return {
            decision: prior,
            affectedShotKeys: [
              proposal.run.blockedShotKey!,
              ...currentRepair.transitiveInvalidationShotKeys,
            ],
          };
        }
        const versionId = randomUUID();
        await tx.storyboardVersion.create({
          data: {
            id: versionId,
            projectId: board.projectId,
            storyboardId: board.id,
            versionNumber: board.rowVersion + 1,
            parentVersionId: source.id,
            source: "AI_DIRECTOR",
            creativeBrief: board.creativeBrief,
            contractVersion: "storyboard-version-v1",
            contentHash: canonicalSha256({
              creativeBrief: board.creativeBrief,
              narrativeSummary: input.narrativeSummary,
              shots: mergedShots,
              repair: {
                proposalHash: input.proposalHash,
                impactHash: input.impactHash,
                action: proposal.run.repairAction,
              },
            }),
            sourceProposalId: proposal.id,
          },
        });
        const newShotIds = new Map<string, string>();
        for (const shot of mergedShots) {
          const id = randomUUID();
          newShotIds.set(shot.shotKey, id);
          await tx.storyboardShot.create({
            data: {
              id,
              projectId: board.projectId,
              storyboardVersionId: versionId,
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
            },
          });
        }

        const copiedBindings: Array<{
          requirementId: string;
          productionAssetVersionId: string;
          characterStateVersionId: string | null;
          assetVersionFileId: string;
          projectAssetId: string;
        }> = [];
        const requirementEvidence: Array<{ id: string; inputHash: string }> = [];
        for (const shot of mergedShots) {
          const newShotId = newShotIds.get(shot.shotKey)!;
          if (unaffectedKeys.has(shot.shotKey)) {
            const oldShot = sourceShotByKey.get(shot.shotKey)!;
            for (const requirement of oldShot.requirements) {
              const id = randomUUID();
              await tx.shotAssetRequirement.create({
                data: {
                  id,
                  projectId: board.projectId,
                  storyboardVersionId: versionId,
                  storyboardShotId: newShotId,
                  requirementKey: requirement.requirementKey,
                  contractVersion: requirement.contractVersion,
                  inputJson: requirement.inputJson as never,
                  inputHash: requirement.inputHash,
                },
              });
              requirementEvidence.push({ id, inputHash: requirement.inputHash });
              for (const binding of sourceBindingsByRequirement.get(requirement.id) ?? []) {
                copiedBindings.push({
                  requirementId: id,
                  productionAssetVersionId: binding.productionAssetVersionId,
                  characterStateVersionId: binding.characterStateVersionId,
                  assetVersionFileId: binding.assetVersionFileId,
                  projectAssetId: binding.projectAssetId,
                });
              }
            }
            continue;
          }
          for (const alias of shot.referenceAliases) {
            const reference = proposal.run.inputReferences.find((item) => item.alias === alias)!;
            const file = referenceFiles.get(alias)!;
            const requirementKey = `director-repair:${alias}`;
            const candidateInput = {
              contractVersion: "asset-candidate-v1" as const,
              projectId: board.projectId,
              requirementId: requirementKey,
              assetType: file.productionAssetVersion.productionAsset.type,
              productionAssetId: reference.productionAssetId,
              productionAssetVersionId: reference.productionAssetVersionId,
              referenceUsages: [file.referenceUsage],
              viewpoints: file.viewpoint ? [file.viewpoint] : [],
              shotScales: file.shotScale ? [file.shotScale] : [],
              mediaCapability: {
                mediaType: "IMAGE" as const,
                acceptedMimeTypes: [file.projectAsset.storedObject.detectedMimeType],
              },
              policy: { allowUnspecifiedViewpoint: true, allowUnspecifiedShotScale: true },
            };
            const id = randomUUID();
            const inputHash = canonicalSha256(candidateInput);
            await tx.shotAssetRequirement.create({
              data: {
                id,
                projectId: board.projectId,
                storyboardVersionId: versionId,
                storyboardShotId: newShotId,
                requirementKey,
                contractVersion: "asset-candidate-v1",
                inputJson: candidateInput as never,
                inputHash,
              },
            });
            requirementEvidence.push({ id, inputHash });
            copiedBindings.push({
              requirementId: id,
              productionAssetVersionId: reference.productionAssetVersionId,
              characterStateVersionId: null,
              assetVersionFileId: reference.assetVersionFileId,
              projectAssetId: reference.projectAssetId,
            });
          }
        }
        const manifestId = randomUUID();
        const candidateSnapshot = {
          schemaVersion: "repair-binding-revalidation-v1",
          sourceManifestId: source.manifest?.id ?? null,
          proposalId,
          revalidatedAssetVersionFileIds: [
            ...new Set(copiedBindings.map((binding) => binding.assetVersionFileId)),
          ].sort(),
        };
        await tx.assetResolutionManifest.create({
          data: {
            id: manifestId,
            projectId: board.projectId,
            storyboardVersionId: versionId,
            policyVersion: "repair-binding-revalidation-v1",
            requirementsHash: canonicalSha256(requirementEvidence),
            candidateSnapshotJson: candidateSnapshot as never,
            candidateResultHash: canonicalSha256(candidateSnapshot),
            finalBindingsHash: canonicalSha256(copiedBindings),
          },
        });
        if (copiedBindings.length > 0)
          await tx.shotAssetBinding.createMany({
            data: copiedBindings.map((binding) => ({
              ...binding,
              projectId: board.projectId,
              manifestId,
            })),
          });
        const advanced = await tx.storyboard.updateMany({
          where: {
            id: board.id,
            rowVersion: expectedStoryboardRowVersion,
            headVersionId: source.id,
          },
          data: {
            headVersionId: versionId,
            approvedVersionId: null,
            rowVersion: { increment: 1 },
          },
        });
        if (advanced.count !== 1) throw error("STORYBOARD_CONFLICT", 412);
        const affectedShotKeys = [
          proposal.run.blockedShotKey!,
          ...currentRepair.transitiveInvalidationShotKeys,
        ];
        const affectedSpecIds = await tx.generationSpec.findMany({
          where: {
            generationPlanVersionId: currentPlan.generationPlanVersionId,
            shotKey: { in: affectedShotKeys },
          },
          select: { id: true },
        });
        await tx.shotExecutionPlan.updateMany({
          where: {
            generationPlanVersionId: currentPlan.generationPlanVersionId,
            generationSpecId: { in: affectedSpecIds.map((item) => item.id) },
            lifecycleStatus: { in: ["DRAFT", "FROZEN"] },
          },
          data: {
            lifecycleStatus: "INVALIDATED",
            invalidatedAt: new Date(),
            invalidationCode: "STORYBOARD_REPAIR_ADOPTED",
          },
        });
        const decision = await tx.storyboardDirectorProposalDecision.create({
          data: {
            projectId: board.projectId,
            proposalId,
            type: "ADOPTED",
            adoptedVersionId: versionId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        return { decision, affectedShotKeys };
      },
      { isolationLevel: "Serializable" },
    );
    return {
      ...result,
      storyboardVersionAppended: true as const,
      externalCalls: 0 as const,
      generationAuthorized: false as const,
    };
  }

  private async assertReferenceCurrent(reference: any, file: any, projectId: string) {
    if (
      !file ||
      file.projectId !== projectId ||
      file.status !== "ACTIVE" ||
      file.approvalStatus !== "ACCEPTED" ||
      file.productionAssetVersion.status !== "ACTIVE" ||
      file.productionAssetVersion.productionAsset.status !== "ACTIVE" ||
      file.projectAsset.status !== "READY" ||
      file.projectAsset.mediaType !== "IMAGE" ||
      file.projectAsset.storedObject.verificationStatus !== "VERIFIED" ||
      file.projectAsset.storedObject.sha256 !== reference.sha256
    )
      throw error("DIRECTOR_REFERENCE_DRIFT", 409);
    await this.storage.resolveVerified(
      file.projectAsset.storedObject.storageKey,
      reference.sha256,
      Number(reference.byteSize),
    );
  }

  private async assertBindingCurrent(binding: any, file: any, projectId: string) {
    if (
      !file ||
      file.projectId !== projectId ||
      file.status !== "ACTIVE" ||
      file.approvalStatus !== "ACCEPTED" ||
      file.productionAssetVersionId !== binding.productionAssetVersionId ||
      file.projectAssetId !== binding.projectAssetId ||
      file.productionAssetVersion.status !== "ACTIVE" ||
      file.productionAssetVersion.productionAsset.status !== "ACTIVE" ||
      file.projectAsset.status !== "READY" ||
      file.projectAsset.mediaType !== "IMAGE" ||
      file.projectAsset.storedObject.verificationStatus !== "VERIFIED"
    )
      throw error("DIRECTOR_REFERENCE_DRIFT", 409);
    await this.storage.resolveVerified(
      file.projectAsset.storedObject.storageKey,
      file.projectAsset.storedObject.sha256,
      Number(file.projectAsset.storedObject.byteSize),
    );
  }
}

function dbShot(shot: any) {
  return {
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
    referenceAliases: [] as string[],
  };
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
