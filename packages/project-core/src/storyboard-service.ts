import { randomUUID } from "node:crypto";
import { FakeStoryboardProvider, FAKE_STORYBOARD_MODEL_ID } from "@comfyuiflow/ai-providers";
import { AssetCandidateService } from "./asset-candidate-service.js";
import { assetCandidateRequirementSchema } from "./asset-candidate-contracts.js";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";
import {
  appendStoryboardVersionSchema,
  createStoryboardSchema,
  storyboardDecisionSchema,
  storyboardResolutionSchema,
  type AppendStoryboardVersionInput,
  type CreateStoryboardInput,
  type StoryboardResolutionInput,
} from "./storyboard-contracts.js";
import { storyboardGate, type StoryboardGate } from "./storyboard-gate.js";

const versionInclude = {
  shots: {
    include: { requirements: true },
    orderBy: { ordinal: "asc" as const },
  },
  manifest: { include: { bindings: true } },
  decisions: { orderBy: { createdAt: "desc" as const } },
} as const;

export class StoryboardService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly gate: StoryboardGate = storyboardGate(),
    private readonly fakeProvider = new FakeStoryboardProvider(),
  ) {}

  async list(projectId: string, limit = 50) {
    await this.requireProject(projectId, false);
    return this.client.storyboard.findMany({
      where: { projectId },
      include: { headVersion: { include: { shots: { orderBy: { ordinal: "asc" } } } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async create(projectId: string, rawInput: CreateStoryboardInput) {
    const input = createStoryboardSchema.parse(rawInput);
    await this.requireProject(projectId, true);
    return this.client.storyboard.create({ data: { projectId, ...input } });
  }

  async get(storyboardId: string) {
    const storyboard = await this.client.storyboard.findUnique({
      where: { id: storyboardId },
      include: {
        headVersion: { include: versionInclude },
        approvedVersion: { select: { id: true, versionNumber: true, contentHash: true } },
      },
    });
    if (!storyboard) throw this.notFound();
    return storyboard;
  }

  async listVersions(storyboardId: string) {
    await this.get(storyboardId);
    return this.client.storyboardVersion.findMany({
      where: { storyboardId },
      select: {
        id: true,
        versionNumber: true,
        parentVersionId: true,
        source: true,
        contentHash: true,
        createdAt: true,
        _count: { select: { shots: true } },
      },
      orderBy: { versionNumber: "desc" },
    });
  }

  async getVersion(versionId: string) {
    const version = await this.client.storyboardVersion.findUnique({
      where: { id: versionId },
      include: versionInclude,
    });
    if (!version) {
      throw new ProjectAssetError(
        "STORYBOARD_VERSION_NOT_FOUND",
        "Storyboard version was not found",
        404,
      );
    }
    return version;
  }

  async generate(storyboardId: string, expectedRowVersion: number) {
    const storyboard = await this.get(storyboardId);
    await this.requireProject(storyboard.projectId, true);
    if (storyboard.rowVersion !== expectedRowVersion) throw this.conflict();
    const request = {
      taskType: "STORYBOARD_GENERATION_V1" as const,
      contractVersion: "storyboard-generation-v1" as const,
      modelRef: { providerId: "fake", modelId: FAKE_STORYBOARD_MODEL_ID },
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      creativeBrief: storyboard.creativeBrief,
      shotCount: 3 as const,
      promptTemplateVersion: "storyboard-three-shot-v1" as const,
      assetRequirements: [],
    };
    const requestHash = canonicalSha256(request);
    try {
      const proposal = await this.fakeProvider.generateStoryboard(request);
      return await this.appendVersion(
        storyboard.id,
        expectedRowVersion,
        {
          parentVersionId: storyboard.headVersionId,
          creativeBrief: storyboard.creativeBrief,
          shots: proposal.shots,
        },
        {
          requestHash,
          responseId: proposal.responseId,
          resolvedModelId: proposal.resolvedModelId,
        },
      );
    } catch (error) {
      await this.client.storyboardDirectorRun.create({
        data: {
          projectId: storyboard.projectId,
          storyboardId: storyboard.id,
          providerId: "fake",
          requestedModelId: FAKE_STORYBOARD_MODEL_ID,
          contractVersion: "storyboard-generation-v1",
          promptTemplateVersion: "storyboard-three-shot-v1",
          requestHash,
          status: "FAILED",
          safeResultCode: "FAKE_STORYBOARD_FAILED",
          providerCallCount: 0,
          finishedAt: new Date(),
        },
      });
      if (error instanceof ProjectAssetError) throw error;
      throw new ProjectAssetError(
        "FAKE_STORYBOARD_FAILED",
        "The local storyboard proposal could not be created",
        500,
      );
    }
  }

  async save(
    storyboardId: string,
    expectedRowVersion: number,
    rawInput: AppendStoryboardVersionInput,
  ) {
    return this.appendVersion(
      storyboardId,
      expectedRowVersion,
      appendStoryboardVersionSchema.parse(rawInput),
    );
  }

  async previewAssets(versionId: string) {
    const version = await this.getVersion(versionId);
    const requirements = version.shots.flatMap((shot) => shot.requirements);
    const candidateService = new AssetCandidateService(this.client);
    const results = [];
    for (const requirement of requirements) {
      const input = assetCandidateRequirementSchema.parse(requirement.inputJson);
      results.push({
        requirementId: requirement.id,
        result: await candidateService.preview(input),
      });
    }
    const gaps = results.flatMap(({ requirementId, result }) =>
      result.gaps.map((code) => ({ requirementId, code })),
    );
    return {
      versionId,
      policyVersion: "deterministic-assets-v1" as const,
      results,
      gaps,
      resultHash: canonicalSha256(results),
      formalSelectionCreated: false as const,
    };
  }

  async resolveAssets(versionId: string, rawInput: StoryboardResolutionInput) {
    this.requireGate();
    const input = storyboardResolutionSchema.parse(rawInput);
    const version = await this.getVersion(versionId);
    const storyboard = await this.client.storyboard.findUnique({
      where: { id: version.storyboardId },
    });
    if (!storyboard || storyboard.headVersionId !== version.id) throw this.conflict();
    const preview = await this.previewAssets(versionId);
    if (preview.resultHash !== input.candidateResultHash) {
      throw new ProjectAssetError(
        "CANDIDATE_GAP",
        "Asset candidates changed; review the latest preview",
        409,
      );
    }
    if (preview.gaps.length > 0) {
      throw new ProjectAssetError("CANDIDATE_GAP", "Resolve every asset gap first", 409);
    }
    const requirementIds = version.shots.flatMap((shot) =>
      shot.requirements.map((requirement) => requirement.id),
    );
    const selectedIds = new Set(input.selections.map((selection) => selection.requirementId));
    if (
      selectedIds.size !== requirementIds.length ||
      requirementIds.some((id) => !selectedIds.has(id))
    ) {
      throw new ProjectAssetError(
        "ASSET_REQUIREMENTS_INCOMPLETE",
        "Every asset requirement needs a selection",
        422,
      );
    }
    return this.client.$transaction(async (tx) => {
      const existing = await tx.assetResolutionManifest.findUnique({
        where: { storyboardVersionId: versionId },
        include: { bindings: true },
      });
      if (existing) return existing;
      const bindings: Array<{
        requirementId: string;
        productionAssetVersionId: string;
        characterStateVersionId: string | null;
        assetVersionFileId: string;
        projectAssetId: string;
      }> = [];
      for (const selection of input.selections) {
        const candidate = preview.results.find(
          (entry) => entry.requirementId === selection.requirementId,
        );
        const eligibleIds = new Set(
          (candidate?.result.eligible ?? []).map((entry) => String(entry.bindingId)),
        );
        for (const assetVersionFileId of selection.assetVersionFileIds) {
          if (!eligibleIds.has(assetVersionFileId)) {
            throw new ProjectAssetError(
              "CANDIDATE_GAP",
              "A selected asset is no longer eligible",
              409,
            );
          }
          const file = await tx.assetVersionFile.findUnique({
            where: { id: assetVersionFileId },
            include: { projectAsset: true },
          });
          if (!file || file.projectId !== version.projectId) {
            throw new ProjectAssetError("CROSS_PROJECT", "Asset selection crossed projects", 409);
          }
          if (file.approvalStatus !== "ACCEPTED") {
            throw new ProjectAssetError("UNAPPROVED_ASSET", "Asset is not owner approved", 409);
          }
          if (file.status !== "ACTIVE" || file.projectAsset.status !== "READY") {
            throw new ProjectAssetError("FILE_NOT_READY", "Asset file is not ready", 409);
          }
          const resolvedIdentity = candidate?.result.resolvedIdentity;
          bindings.push({
            requirementId: selection.requirementId,
            productionAssetVersionId: file.productionAssetVersionId,
            characterStateVersionId:
              (resolvedIdentity?.characterStateVersionId as string | null | undefined) ?? null,
            assetVersionFileId,
            projectAssetId: file.projectAssetId,
          });
        }
      }
      const manifestId = randomUUID();
      return tx.assetResolutionManifest.create({
        data: {
          id: manifestId,
          projectId: version.projectId,
          storyboardVersionId: version.id,
          policyVersion: preview.policyVersion,
          requirementsHash: canonicalSha256(
            version.shots.flatMap((shot) =>
              shot.requirements.map((requirement) => ({
                id: requirement.id,
                inputHash: requirement.inputHash,
              })),
            ),
          ),
          candidateSnapshotJson: preview as never,
          candidateResultHash: preview.resultHash,
          finalBindingsHash: canonicalSha256(bindings),
          bindings: { create: bindings as never },
        },
        include: { bindings: true },
      });
    });
  }

  async decide(
    versionId: string,
    expectedRowVersion: number,
    idempotencyKey: string,
    rawInput: { decision: "APPROVED" | "REVOKED"; notes?: string | undefined },
  ) {
    this.requireGate();
    if (!idempotencyKey.trim()) {
      throw new ProjectAssetError("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    }
    const input = storyboardDecisionSchema.parse(rawInput);
    const existing = await this.client.storyboardDecision.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return { decision: existing, generationAuthorized: false as const };
    const version = await this.getVersion(versionId);
    const storyboard = await this.client.storyboard.findUnique({
      where: { id: version.storyboardId },
    });
    if (!storyboard || storyboard.rowVersion !== expectedRowVersion) throw this.conflict();
    if (input.decision === "APPROVED") {
      if (storyboard.headVersionId !== version.id) throw this.conflict();
      const ordinals = version.shots.map((shot) => shot.ordinal);
      if (ordinals.length !== 3 || ordinals.some((value, index) => value !== index + 1)) {
        throw new ProjectAssetError(
          "SHOT_COUNT_INVALID",
          "Approval requires exactly three ordered shots",
          422,
        );
      }
      if (!version.manifest) {
        throw new ProjectAssetError(
          "ASSET_REQUIREMENTS_INCOMPLETE",
          "Freeze the asset resolution manifest before approval",
          422,
        );
      }
      const requirements = version.shots.flatMap((shot) => shot.requirements);
      if (
        requirements.some(
          (requirement) =>
            !version.manifest?.bindings.some((binding) => binding.requirementId === requirement.id),
        )
      ) {
        throw new ProjectAssetError(
          "ASSET_REQUIREMENTS_INCOMPLETE",
          "Every asset requirement needs a frozen binding",
          422,
        );
      }
    } else if (storyboard.approvedVersionId !== version.id) {
      throw new ProjectAssetError(
        "DECISION_CONFLICT",
        "Only the currently approved version can be revoked",
        409,
      );
    }
    const decision = await this.client.$transaction(async (tx) => {
      const created = await tx.storyboardDecision.create({
        data: {
          projectId: version.projectId,
          storyboardId: version.storyboardId,
          storyboardVersionId: version.id,
          manifestId: version.manifest?.id ?? null,
          decision: input.decision,
          idempotencyKey,
          notes: input.notes ?? null,
        },
      });
      const updated = await tx.storyboard.updateMany({
        where: { id: storyboard.id, rowVersion: expectedRowVersion },
        data: {
          approvedVersionId: input.decision === "APPROVED" ? version.id : null,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.conflict();
      return created;
    });
    return { decision, generationAuthorized: false as const };
  }

  private async appendVersion(
    storyboardId: string,
    expectedRowVersion: number,
    rawInput: AppendStoryboardVersionInput,
    run?: { requestHash: string; responseId: string; resolvedModelId: string },
  ) {
    const input = appendStoryboardVersionSchema.parse(rawInput);
    return this.client.$transaction(
      async (tx) => {
        const storyboard = await tx.storyboard.findUnique({ where: { id: storyboardId } });
        if (!storyboard) throw this.notFound();
        const project = await tx.project.findUnique({ where: { id: storyboard.projectId } });
        if (!project || project.status !== "ACTIVE") {
          throw new ProjectAssetError(
            "PROJECT_ARCHIVED",
            "Restore this project before editing storyboards",
            409,
          );
        }
        if (
          storyboard.rowVersion !== expectedRowVersion ||
          storyboard.headVersionId !== input.parentVersionId
        ) {
          throw this.conflict();
        }
        const versionId = randomUUID();
        const shotRows = input.shots.map((shot) => ({ id: randomUUID(), shot }));
        const contentHash = canonicalSha256({
          creativeBrief: input.creativeBrief,
          shots: input.shots,
        });
        await tx.storyboardVersion.create({
          data: {
            id: versionId,
            projectId: storyboard.projectId,
            storyboardId,
            versionNumber: storyboard.rowVersion + 1,
            parentVersionId: input.parentVersionId,
            source: run ? "FAKE_DIRECTOR" : "OWNER",
            creativeBrief: input.creativeBrief,
            contractVersion: "storyboard-version-v1",
            contentHash,
          },
        });
        for (const { id: shotId, shot } of shotRows) {
          await tx.storyboardShot.create({
            data: {
              id: shotId,
              projectId: storyboard.projectId,
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
          for (const requirement of shot.assetRequirements) {
            const candidateInput = assetCandidateRequirementSchema.parse(
              requirement.candidateInput,
            );
            if (candidateInput.projectId !== storyboard.projectId) {
              throw new ProjectAssetError(
                "CROSS_PROJECT",
                "Asset requirement must belong to this project",
                409,
              );
            }
            await tx.shotAssetRequirement.create({
              data: {
                projectId: storyboard.projectId,
                storyboardVersionId: versionId,
                storyboardShotId: shotId,
                requirementKey: requirement.requirementKey,
                contractVersion: requirement.contractVersion,
                inputJson: candidateInput as never,
                inputHash: canonicalSha256(candidateInput),
              },
            });
          }
        }
        if (run) {
          await tx.storyboardDirectorRun.create({
            data: {
              projectId: storyboard.projectId,
              storyboardId,
              providerId: "fake",
              requestedModelId: FAKE_STORYBOARD_MODEL_ID,
              resolvedModelId: run.resolvedModelId,
              contractVersion: "storyboard-generation-v1",
              promptTemplateVersion: "storyboard-three-shot-v1",
              requestHash: run.requestHash,
              responseId: run.responseId,
              status: "COMPLETED",
              safeResultCode: "FAKE_STORYBOARD_COMPLETED",
              providerCallCount: 0,
              generatedVersionId: versionId,
              finishedAt: new Date(),
            },
          });
        }
        const advanced = await tx.storyboard.updateMany({
          where: {
            id: storyboard.id,
            rowVersion: expectedRowVersion,
            headVersionId: input.parentVersionId,
          },
          data: {
            headVersionId: versionId,
            approvedVersionId: null,
            creativeBrief: input.creativeBrief,
            rowVersion: { increment: 1 },
          },
        });
        if (advanced.count !== 1) throw this.conflict();
        return tx.storyboard.findUniqueOrThrow({
          where: { id: storyboard.id },
          include: { headVersion: { include: versionInclude } },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  private requireGate() {
    if (!this.gate.phase2BindingsEnabled) {
      throw new ProjectAssetError(
        "PHASE2_GATE_CLOSED",
        "Formal asset binding and approval remain closed until Phase 2 verification passes",
        409,
      );
    }
  }

  private async requireProject(projectId: string, active: boolean) {
    const project = await this.client.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    if (active && project.status !== "ACTIVE") {
      throw new ProjectAssetError(
        "PROJECT_ARCHIVED",
        "Restore this project before editing storyboards",
        409,
      );
    }
    return project;
  }

  private notFound() {
    return new ProjectAssetError("STORYBOARD_NOT_FOUND", "Storyboard was not found", 404);
  }

  private conflict() {
    return new ProjectAssetError(
      "VERSION_CONFLICT",
      "This storyboard changed; reload the latest version before saving",
      412,
    );
  }
}
