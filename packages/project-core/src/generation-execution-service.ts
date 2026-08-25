import { randomUUID } from "node:crypto";
import type {
  GenerationExecutionPreviewV1,
  GenerationExecutionSlotV1,
  HumanQaDecisionV1,
} from "@comfyuiflow/contracts";
import { GenerationExecutionPreviewV1Schema } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import type { Prisma } from "./generated/client/index.js";
import {
  createGenerationBatchInputSchema,
  generationExecutionPreviewInputSchema,
  humanQaDecisionInputSchema,
  type CreateGenerationBatchInput,
  type GenerationExecutionPreviewInput,
} from "./generation-execution-contracts.js";
import { generationProviderRegistry } from "./generation-provider.js";
import { GenerationPlanService } from "./generation-plan-service.js";
import { compileH3GenerationPrompt } from "./h3-generation-prompt.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

type PreviewShot = GenerationExecutionPreviewV1["shots"][number];

const specInclude = {
  references: {
    include: {
      productionAssetVersion: { include: { productionAsset: true } },
      assetVersionFile: true,
      projectAsset: { include: { storedObject: true } },
    },
  },
} as const;

export class GenerationExecutionService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage(),
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async preview(versionId: string, rawInput: GenerationExecutionPreviewInput) {
    return (await this.buildPreview(versionId, rawInput)).public;
  }

  private async buildPreview(versionId: string, rawInput: GenerationExecutionPreviewInput) {
    const input = generationExecutionPreviewInputSchema.parse(rawInput);
    const provider = generationProviderRegistry[input.providerProfileId];
    const version = await this.client.generationPlanVersion.findUnique({
      where: { id: versionId },
      include: {
        generationPlan: { include: { project: true, storyboard: true } },
        specs: { include: specInclude, orderBy: { ordinal: "asc" } },
      },
    });
    if (!version)
      throw this.error("GENERATION_TARGET_INVALID", "Generation plan version was not found", 404);
    const plan = version.generationPlan;
    if (plan.project.status !== "ACTIVE")
      throw this.error("PROJECT_ARCHIVED", "Restore this project before generation", 409);
    if (plan.storyboard.status !== "ACTIVE")
      throw this.error("STORYBOARD_ARCHIVED", "Restore this storyboard before generation", 409);
    if (plan.approvedVersionId !== version.id)
      throw this.error(
        "GENERATION_PLAN_NOT_APPROVED",
        "Approve this exact Shot Plan version before generation",
        409,
      );
    const planPreflight = await new GenerationPlanService(this.client).preflight(version.id);
    if (!planPreflight.ready)
      throw this.error(
        "GENERATION_PLAN_STALE",
        "The approved Shot Plan or its frozen inputs changed; approve a new version",
        409,
      );

    const selected = new Set(input.generationSpecIds);
    const specs = version.specs.filter((spec) => selected.has(spec.id));
    if (specs.length !== selected.size)
      throw this.error(
        "GENERATION_TARGET_INVALID",
        "Every selected shot must belong to this approved plan version",
        422,
      );
    if (input.retryOfJobId) {
      if (input.generationSpecIds.length !== 1)
        throw this.error(
          "GENERATION_TARGET_INVALID",
          "A new attempt can target exactly one reviewed shot",
          422,
        );
      const retrySource = await this.client.generationJob.findUnique({
        where: { id: input.retryOfJobId },
        include: { generationBatchTarget: { include: { generationSpec: true } } },
      });
      if (!retrySource || retrySource.projectId !== plan.projectId)
        throw this.error(
          "GENERATION_TARGET_INVALID",
          "The prior job is not available in this project",
          404,
        );
      if (!["QA_FAIL", "TECHNICAL_FAILED", "CANCELLED"].includes(retrySource.status))
        throw this.error(
          "JOB_NOT_RECONCILABLE",
          "Only a failed or cancelled task can start a new attempt",
          409,
        );
      if (specs[0]?.shotKey !== retrySource.generationBatchTarget.generationSpec.shotKey)
        throw this.error(
          "GENERATION_TARGET_INVALID",
          "A new attempt must target the same storyboard shot",
          422,
        );
    }

    const compiled = new Map<string, string>();
    const shots: PreviewShot[] = [];
    for (const spec of specs) {
      const blockers: string[] = [];
      const capability = spec.capabilityRequirements as Record<string, unknown>;
      if (
        spec.durationSeconds !== 4 ||
        capability.durationSeconds !== 4 ||
        capability.aspectRatio !== "PORTRAIT_9_16" ||
        capability.mode !== "REFERENCE_TO_VIDEO" ||
        capability.audioRequired !== false
      )
        blockers.push("GENERATION_PROFILE_INCOMPATIBLE");

      const slotResult = await this.resolveSlots(spec.references, blockers);
      if (input.providerProfileId === "minimax-h3-4s-v1") {
        if (this.environment.PROJECT_GENERATION_LIVE_ENABLED !== "true")
          blockers.push("LIVE_DISABLED");
        if (
          !this.environment.COMFYUI_API_KEY &&
          !this.environment.COMFY_API_KEY &&
          !this.environment.COMFYUI_AUTH_TOKEN
        )
          blockers.push("WORKFLOW_NOT_READY");
        if (this.environment.PROJECT_COMFYUI_MCP_READY !== "true")
          blockers.push("WORKFLOW_NOT_READY");
        if (!this.environment.CODEX_MANAGER_API_KEY) blockers.push("QA_NOT_READY");
      }

      let compiledPromptHash: string | null = null;
      let targetHash: string | null = null;
      let promptSummary = spec.positivePrompt.slice(0, 2_000);
      if (slotResult.slots.length === 5) {
        const prompt = compileH3GenerationPrompt({
          positivePrompt: spec.positivePrompt,
          sceneName: slotResult.names.scene,
          productName: slotResult.names.product,
          characterName: slotResult.names.character,
        });
        const compiledPrompt = input.retryRequirements
          ? `${prompt.prompt}\n\n[Owner retry requirements]\n${input.retryRequirements}`
          : prompt.prompt;
        compiled.set(spec.id, compiledPrompt);
        compiledPromptHash = input.retryRequirements
          ? canonicalSha256({
              basePromptHash: prompt.sha256,
              retryRequirements: input.retryRequirements,
            })
          : prompt.sha256;
        promptSummary = spec.positivePrompt.slice(0, 2_000);
        if (input.retryRequirements)
          promptSummary = `${promptSummary}\n\n重试要求：${input.retryRequirements}`.slice(
            0,
            2_000,
          );
        targetHash = canonicalSha256({
          generationSpecId: spec.id,
          outputHash: spec.outputHash,
          provider,
          compiledPromptHash,
          slots: slotResult.slots,
        });
      }
      shots.push({
        generationSpecId: spec.id,
        ordinal: spec.ordinal,
        compatible: blockers.length === 0,
        blockers: [...new Set(blockers)],
        promptSummary,
        compiledPromptHash,
        targetHash,
        slots: slotResult.slots,
      });
    }

    const previewCore = {
      schemaVersion: "generation-execution-preview-v1" as const,
      projectId: plan.projectId,
      generationPlanVersionId: version.id,
      provider,
      shots,
      ready: shots.every((shot) => shot.compatible),
      maximumGenerationCalls: shots.filter((shot) => shot.compatible).length,
      maximumAiQaCalls: shots.filter((shot) => shot.compatible).length,
      aiQaProviderId:
        input.providerProfileId === "fake-video-v1"
          ? ("fake" as const)
          : ("codexmanager-local" as const),
      aiQaModelId:
        input.providerProfileId === "fake-video-v1"
          ? ("fake-video-qa-v1" as const)
          : ("gpt-5.4" as const),
      aiQaPriceAvailable: false as const,
      externalCalls: 0 as const,
      retryOfJobId: input.retryOfJobId ?? null,
      retryRequirements: input.retryRequirements ?? null,
    };
    const publicPreview = GenerationExecutionPreviewV1Schema.parse({
      ...previewCore,
      previewHash: canonicalSha256(previewCore),
    });
    return { public: publicPreview, compiled };
  }

  private async resolveSlots(references: any[], blockers: string[]) {
    const eligible: Array<{
      slot: GenerationExecutionSlotV1["role"];
      value: GenerationExecutionSlotV1;
      assetName: string;
      characterVersionId: string | null;
    }> = [];
    for (const reference of references) {
      const file = reference.assetVersionFile;
      const projectAsset = reference.projectAsset;
      const stored = projectAsset.storedObject;
      if (
        file.status !== "ACTIVE" ||
        file.approvalStatus !== "ACCEPTED" ||
        projectAsset.status !== "READY" ||
        stored.verificationStatus !== "VERIFIED"
      ) {
        blockers.push("REFERENCE_NOT_READY");
        continue;
      }
      if (stored.sha256 !== reference.expectedSha256) {
        blockers.push("REFERENCE_HASH_MISMATCH");
        continue;
      }
      try {
        await this.storage.resolveVerified(
          stored.storageKey,
          stored.sha256,
          Number(stored.byteSize),
        );
      } catch {
        blockers.push("REFERENCE_NOT_READY");
        continue;
      }
      if (
        projectAsset.mediaType !== "IMAGE" ||
        !projectAsset.width ||
        !projectAsset.height ||
        projectAsset.width < 256 ||
        projectAsset.height < 256
      ) {
        blockers.push("REFERENCE_NOT_READY");
        continue;
      }
      const type = reference.productionAssetVersion.productionAsset.type;
      const usage = reference.referenceUsage;
      const viewpoint = file.viewpoint;
      let slot: GenerationExecutionSlotV1["role"] | null = null;
      if (type === "SCENE" && usage === "SCENE_STYLE") slot = "SCENE";
      else if (type === "PROP" && usage === "PROP_DETAIL") slot = "PRODUCT";
      else if (type === "CHARACTER" && usage === "FACE") slot = "CHARACTER_FACE";
      else if (
        type === "CHARACTER" &&
        ["FULL_BODY", "IDENTITY"].includes(usage) &&
        ["REAR", "REAR_THREE_QUARTER"].includes(viewpoint)
      )
        slot = "CHARACTER_REAR";
      else if (
        type === "CHARACTER" &&
        usage === "FULL_BODY" &&
        !["REAR", "REAR_THREE_QUARTER"].includes(viewpoint)
      )
        slot = "CHARACTER_FULL_BODY";
      if (!slot) continue;
      eligible.push({
        slot,
        value: {
          role: slot,
          projectAssetId: projectAsset.id,
          assetVersionFileId: file.id,
          productionAssetVersionId: reference.productionAssetVersionId,
          characterStateVersionId: reference.characterStateVersionId,
          sha256: stored.sha256,
          displayName: projectAsset.displayName,
        },
        assetName: reference.productionAssetVersion.productionAsset.name,
        characterVersionId: type === "CHARACTER" ? reference.productionAssetVersionId : null,
      });
    }

    const orderedRoles: GenerationExecutionSlotV1["role"][] = [
      "SCENE",
      "PRODUCT",
      "CHARACTER_FULL_BODY",
      "CHARACTER_FACE",
      "CHARACTER_REAR",
    ];
    const selected: typeof eligible = [];
    for (const role of orderedRoles) {
      const matches = eligible.filter((candidate) => candidate.slot === role);
      if (matches.length === 0) blockers.push("REFERENCE_SLOT_MISSING");
      else if (matches.length > 1) blockers.push("REFERENCE_SLOT_AMBIGUOUS");
      else if (matches[0]) selected.push(matches[0]);
    }
    const characters = selected
      .map((item) => item.characterVersionId)
      .filter((value): value is string => Boolean(value));
    if (characters.length && new Set(characters).size !== 1)
      blockers.push("REFERENCE_CHARACTER_MISMATCH");
    return {
      slots: selected.length === 5 ? selected.map((item) => item.value) : [],
      names: {
        scene: selected.find((item) => item.slot === "SCENE")?.assetName ?? "approved scene",
        product: selected.find((item) => item.slot === "PRODUCT")?.assetName ?? "approved product",
        character:
          selected.find((item) => item.slot === "CHARACTER_FULL_BODY")?.assetName ??
          "approved character",
      },
    };
  }

  async createBatch(rawInput: CreateGenerationBatchInput, idempotencyKey: string): Promise<any> {
    if (!idempotencyKey.trim())
      throw this.error("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    const input = createGenerationBatchInputSchema.parse(rawInput);
    const requestHash = canonicalSha256({ input, idempotencyKey });
    const existing = await this.client.generationBatch.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.previewHash !== input.previewHash)
        throw this.error(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for another generation batch",
          409,
        );
      return this.getBatch(existing.id);
    }
    const built = await this.buildPreview(input.generationPlanVersionId, {
      providerProfileId: input.providerProfileId,
      generationSpecIds: input.generationSpecIds,
      ...(input.retryOfJobId ? { retryOfJobId: input.retryOfJobId } : {}),
      ...(input.retryRequirements ? { retryRequirements: input.retryRequirements } : {}),
    });
    if (built.public.previewHash !== input.previewHash)
      throw this.error("PREVIEW_STALE", "Preview changed; review it again before confirming", 409);
    if (!built.public.ready)
      throw this.error(
        built.public.shots.flatMap((shot) => shot.blockers)[0] ?? "GENERATION_PROFILE_INCOMPATIBLE",
        "One or more selected shots are incompatible",
        409,
      );
    const scopeHash = canonicalSha256({
      previewHash: input.previewHash,
      provider: built.public.provider,
      targets: built.public.shots.map((shot) => ({
        generationSpecId: shot.generationSpecId,
        targetHash: shot.targetHash,
      })),
      maximumGenerationCalls: built.public.maximumGenerationCalls,
      maximumAiQaCalls: built.public.maximumAiQaCalls,
      aiQaProviderId: built.public.aiQaProviderId,
      aiQaModelId: built.public.aiQaModelId,
      frameExtractorVersion: "review-frames-v1",
    });
    const provider = built.public.provider;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1_000);
    const batchId = randomUUID();
    await this.client.$transaction(
      async (tx) => {
        await tx.generationBatch.create({
          data: {
            id: batchId,
            projectId: built.public.projectId,
            generationPlanVersionId: input.generationPlanVersionId,
            providerProfileId: provider.profileId,
            providerId: provider.providerId,
            modelId: provider.modelId,
            workflowId: provider.workflowId,
            workflowVersion: provider.workflowVersion,
            workflowSha256: provider.workflowSha256,
            previewHash: built.public.previewHash,
            scopeHash,
            idempotencyKey,
          },
        });
        for (const shot of built.public.shots) {
          const targetId = randomUUID();
          await tx.generationBatchTarget.create({
            data: {
              id: targetId,
              projectId: built.public.projectId,
              generationBatchId: batchId,
              generationSpecId: shot.generationSpecId,
              ordinal: shot.ordinal,
              targetHash: shot.targetHash!,
              promptHash: shot.compiledPromptHash!,
              referencesHash: canonicalSha256(shot.slots),
              compiledPrompt: built.compiled.get(shot.generationSpecId)!,
              slotManifestJson: shot.slots as Prisma.InputJsonValue,
              ...(input.retryOfJobId ? { retryOfJobId: input.retryOfJobId } : {}),
            },
          });
          await tx.generationJob.create({
            data: {
              id: randomUUID(),
              projectId: built.public.projectId,
              generationBatchId: batchId,
              generationBatchTargetId: targetId,
            },
          });
        }
        await tx.executionAuthorization.create({
          data: {
            id: randomUUID(),
            projectId: built.public.projectId,
            generationBatchId: batchId,
            scopeHash,
            maximumGenerationCalls: built.public.maximumGenerationCalls,
            maximumAiQaCalls: built.public.maximumAiQaCalls,
            confirmedAt: now,
            expiresAt,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    void requestHash;
    return this.getBatch(batchId);
  }

  async getBatch(batchId: string): Promise<any> {
    await this.finishBatchIfTerminal(batchId);
    const batch = await this.client.generationBatch.findUnique({
      where: { id: batchId },
      include: {
        authorization: { include: { consumptions: true } },
        targets: { orderBy: { ordinal: "asc" } },
        jobs: {
          include: {
            generationBatchTarget: true,
            events: { orderBy: { sequence: "asc" } },
            artifacts: {
              include: {
                technicalChecks: true,
                reviewFrames: true,
                aiQaRuns: { include: { result: true } },
                humanQaDecisions: { orderBy: { createdAt: "desc" } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!batch)
      throw this.error("GENERATION_TARGET_INVALID", "Generation batch was not found", 404);
    return this.serialize(batch);
  }

  async getLatestBatchForPlanVersion(generationPlanVersionId: string): Promise<any | null> {
    const [latest] = await this.listBatchesForPlanVersion(generationPlanVersionId, 1);
    return latest ?? null;
  }

  async listBatchesForPlanVersion(generationPlanVersionId: string, limit?: number): Promise<any[]> {
    const batches = await this.client.generationBatch.findMany({
      where: { generationPlanVersionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(limit === undefined ? {} : { take: limit }),
      select: { id: true },
    });
    return Promise.all(batches.map((batch) => this.getBatch(batch.id)));
  }

  async consume(
    jobId: string,
    operation: "GENERATION_SUBMIT" | "AI_QA_REVIEW",
    requestHash: string,
  ): Promise<{ id: string }> {
    return this.client.$transaction(
      async (tx) => {
        const job = await tx.generationJob.findUnique({
          where: { id: jobId },
          include: {
            generationBatch: { include: { authorization: { include: { consumptions: true } } } },
          },
        });
        const authorization = job?.generationBatch.authorization;
        if (!job || !authorization)
          throw this.error(
            "AUTHORIZATION_SCOPE_MISMATCH",
            "Execution authorization is missing",
            409,
          );
        if (authorization.scopeHash !== job.generationBatch.scopeHash)
          throw this.error("AUTHORIZATION_SCOPE_MISMATCH", "Execution authorization changed", 409);
        if (authorization.expiresAt.getTime() <= Date.now())
          throw this.error("AUTHORIZATION_EXPIRED", "Execution authorization expired", 409);
        const count = authorization.consumptions.filter(
          (item) => item.operation === operation,
        ).length;
        const maximum =
          operation === "GENERATION_SUBMIT"
            ? authorization.maximumGenerationCalls
            : authorization.maximumAiQaCalls;
        if (count >= maximum)
          throw this.error("AUTHORIZATION_CONSUMED", "Execution call budget is exhausted", 409);
        try {
          return await tx.authorizationConsumption.create({
            data: {
              id: randomUUID(),
              projectId: job.projectId,
              executionAuthorizationId: authorization.id,
              generationBatchTargetId: job.generationBatchTargetId,
              generationJobId: job.id,
              operation,
              requestHash,
            },
          });
        } catch (error) {
          if (this.isUniqueConflict(error))
            throw this.error(
              "AUTHORIZATION_CONSUMED",
              "This target operation was already attempted",
              409,
            );
          throw error;
        }
      },
      { isolationLevel: "Serializable" },
    );
  }

  async appendEvent(
    jobId: string,
    eventType: string,
    safePayloadJson?: Record<string, unknown>,
  ): Promise<unknown> {
    const count = await this.client.generationJobEvent.count({ where: { generationJobId: jobId } });
    return this.client.generationJobEvent.create({
      data: {
        id: randomUUID(),
        generationJobId: jobId,
        sequence: count + 1,
        eventType,
        ...(safePayloadJson ? { safePayloadJson: safePayloadJson as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async recordHumanQa(
    artifactId: string,
    idempotencyKey: string,
    rawInput: HumanQaDecisionV1,
  ): Promise<any> {
    if (!idempotencyKey.trim())
      throw this.error("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    const input = humanQaDecisionInputSchema.parse(rawInput);
    const requestHash = canonicalSha256({ artifactId, input });
    const existing = await this.client.humanQaDecision.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw this.error("IDEMPOTENCY_CONFLICT", "Idempotency key was reused", 409);
      return existing;
    }
    const artifact = await this.client.generatedArtifact.findUnique({
      where: { id: artifactId },
      include: { technicalChecks: true },
    });
    if (!artifact || !artifact.technicalChecks.some((check) => check.status === "PASS"))
      throw this.error("QA_NOT_READY", "Artifact is not ready for Human QA", 409);
    const decision = await this.client.humanQaDecision.create({
      data: {
        id: randomUUID(),
        projectId: artifact.projectId,
        generatedArtifactId: artifact.id,
        decision: input.decision,
        notes: input.notes ?? null,
        idempotencyKey,
        requestHash,
      },
    });
    const job = await this.client.generationJob.update({
      where: { id: artifact.generationJobId },
      data: {
        status: input.decision === "PASS" ? "QA_PASS" : "QA_FAIL",
        safeResultCode: input.decision === "PASS" ? "OWNER_QA_PASS" : "OWNER_QA_FAIL",
        finishedAt: new Date(),
      },
    });
    await this.finishBatchIfTerminal(job.generationBatchId);
    return decision;
  }

  async requestReconcile(jobId: string) {
    const job = await this.client.generationJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "AMBIGUOUS" || !job.providerTaskId)
      throw this.error(
        "JOB_NOT_RECONCILABLE",
        "Only an ambiguous job with its original provider task ID can be reconciled",
        409,
      );
    await this.client.$transaction([
      this.client.generationJob.update({
        where: { id: job.id },
        data: { safeResultCode: "RECONCILE_REQUESTED", claimOwner: null, leaseExpiresAt: null },
      }),
      this.client.generationBatch.update({
        where: { id: job.generationBatchId },
        data: { status: "RUNNING", rowVersion: { increment: 1 } },
      }),
    ]);
    await this.appendEvent(job.id, "RECONCILE_REQUESTED");
    return { id: job.id, status: job.status, reconcileRequested: true };
  }

  async requestCancel(jobId: string, expectedBatchRowVersion?: number) {
    if (expectedBatchRowVersion === undefined)
      throw this.error("PRECONDITION_REQUIRED", "If-Match is required", 428);
    const job = await this.client.generationJob.findUnique({
      where: { id: jobId },
      include: { generationBatch: true },
    });
    if (!job) throw this.error("GENERATION_TARGET_INVALID", "Generation job was not found", 404);
    if (job.generationBatch.rowVersion !== expectedBatchRowVersion)
      throw this.error(
        "GENERATION_BATCH_CONFLICT",
        "Generation batch changed; refresh before cancelling",
        412,
      );
    if (["QA_PASS", "QA_FAIL", "TECHNICAL_FAILED", "CANCELLED"].includes(job.status))
      throw this.error("JOB_NOT_RECONCILABLE", "This job can no longer be cancelled", 409);
    if (job.status === "QUEUED") {
      await this.client.generationJob.update({
        where: { id: job.id },
        data: {
          status: "CANCELLED",
          safeResultCode: "CANCELLED_BEFORE_START",
          finishedAt: new Date(),
        },
      });
      await this.finishBatchIfTerminal(job.generationBatchId);
      return {
        id: job.id,
        status: "CANCELLED" as const,
        remoteTerminationConfirmed: false,
        refundGuaranteed: false,
      };
    }
    if (!job.providerTaskId)
      throw this.error(
        "JOB_NOT_RECONCILABLE",
        "The provider task is unknown; cancellation cannot be targeted safely",
        409,
      );
    await this.client.generationJob.update({
      where: { id: job.id },
      data: { safeResultCode: "CANCEL_REQUESTED", claimOwner: null, leaseExpiresAt: null },
    });
    await this.appendEvent(job.id, "CANCEL_REQUESTED");
    return {
      id: job.id,
      status: job.status,
      cancelRequested: true,
      remoteTerminationConfirmed: false,
      refundGuaranteed: false,
    };
  }

  private serialize(value: unknown): any {
    if (typeof value === "bigint") return Number(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (typeof value === "object" && value !== null)
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key]) =>
              ![
                "storageKey",
                "providerReferenceJson",
                "compiledPrompt",
                "slotManifestJson",
                "claimOwner",
              ].includes(key),
          )
          .map(([key, item]) => [key, this.serialize(item)]),
      );
    return value;
  }

  private async finishBatchIfTerminal(batchId: string) {
    const batch = await this.client.generationBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
        jobs: { select: { status: true } },
      },
    });
    if (!batch || ["COMPLETED", "CANCELLED"].includes(batch.status)) return;
    const jobs = batch.jobs;
    const terminal = new Set(["QA_PASS", "QA_FAIL", "TECHNICAL_FAILED", "CANCELLED"]);
    if (jobs.length === 0 || jobs.some((job) => !terminal.has(job.status))) return;
    await this.client.generationBatch.updateMany({
      where: { id: batchId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      data: {
        status: jobs.every((job) => job.status === "CANCELLED") ? "CANCELLED" : "COMPLETED",
        rowVersion: { increment: 1 },
      },
    });
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }

  private error(code: string, message: string, status: number) {
    return new ProjectAssetError(code, message, status);
  }
}
