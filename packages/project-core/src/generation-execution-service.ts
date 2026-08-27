import { randomUUID } from "node:crypto";
import type {
  GenerationAuthorizationV3,
  GenerationExecutionPreviewV1,
  GenerationExecutionSlotV1,
  HumanQaDecisionV1,
} from "@comfyuiflow/contracts";
import {
  GenerationAuthorizationV3Schema,
  GenerationExecutionPreviewV1Schema,
  GenerationExecutionPreviewV3Schema,
  GenerationPlanV3Schema,
  GenerationSpecV3Schema,
  MaterializedGraphSnapshotV3Schema,
  PlanningInputSnapshotV3Schema,
  ReferencePlanV3Schema,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import type { Prisma } from "./generated/client/index.js";
import {
  createGenerationBatchInputSchema,
  generationExecutionPreviewInputSchema,
  generationExecutionPreviewV3InputSchema,
  humanQaDecisionInputSchema,
  type CreateGenerationBatchInput,
  type GenerationExecutionPreviewInput,
  type GenerationExecutionPreviewV3Input,
} from "./generation-execution-contracts.js";
import { generationProviderRegistry } from "./generation-provider.js";
import { GenerationPlanService } from "./generation-plan-service.js";
import { compileH3GenerationPrompt } from "./h3-generation-prompt.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";
import { CapabilityRegistryLoader } from "./workflow-agent/capability-registry.js";
import { CapabilityCompilerRegistry } from "./workflow-agent/compiler-registry.js";

type PreviewShot = GenerationExecutionPreviewV1["shots"][number];

type ContinuityBinding = NonNullable<PreviewShot["continuity"]>;

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
    private readonly options: {
      allowTestFixtures?: boolean;
      v3QaReadiness?: () => Promise<{ configured: boolean; reason?: string }>;
    } = {},
  ) {}

  async preview(versionId: string, rawInput: GenerationExecutionPreviewInput) {
    return (await this.buildPreview(versionId, rawInput)).public;
  }

  async previewV3(planId: string, rawInput: GenerationExecutionPreviewV3Input) {
    return this.buildPreviewV3(planId, rawInput);
  }

  async latestCapabilityBatchForStoryboardVersion(storyboardVersionId: string) {
    const plans = await this.client.generationPlanV3Record.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const plan = plans.find((candidate) => {
      try {
        return GenerationPlanV3Schema.parse(candidate.payloadJson).storyboardRevisionRefs.some(
          (reference) => reference.id === storyboardVersionId,
        );
      } catch {
        return false;
      }
    });
    if (!plan) return { plan: null, batch: null };
    const batch = await this.client.generationBatchV3Record.findFirst({
      where: { generationPlanId: plan.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return {
      plan: { id: plan.id, planDigest: plan.planDigest },
      batch: batch ? await this.getBatchV3(batch.id) : null,
    };
  }

  private async v3QaPricing() {
    const providerId = this.environment.VIDEO_QA_PROVIDER_PROFILE ?? "";
    const modelId = this.environment.VIDEO_QA_MODEL_ID ?? "";
    const billingChannel = this.environment.VIDEO_QA_BILLING_CHANNEL ?? "";
    const effectiveAt = this.environment.VIDEO_QA_PRICE_EFFECTIVE_AT ?? "";
    const expiresAt = this.environment.VIDEO_QA_PRICE_EXPIRES_AT ?? "";
    const maximumCostMicros = Number(this.environment.VIDEO_QA_MAX_COST_MICROS ?? "");
    const live = this.environment.VIDEO_QA_LIVE_ENABLED === "true";
    const priceCurrent =
      Number.isSafeInteger(maximumCostMicros) &&
      maximumCostMicros >= 0 &&
      Number.isFinite(Date.parse(effectiveAt)) &&
      Date.parse(effectiveAt) <= Date.now() &&
      Number.isFinite(Date.parse(expiresAt)) &&
      Date.parse(expiresAt) > Date.now();
    const staticallyConfigured =
      live &&
      providerId === "codexmanager-local" &&
      modelId === "gpt-5.4" &&
      Boolean(billingChannel) &&
      priceCurrent &&
      Boolean(this.environment.CODEX_MANAGER_API_KEY);
    const readiness = staticallyConfigured
      ? await (this.options.v3QaReadiness?.() ??
          Promise.resolve({ configured: false, reason: "V3 QA health check is unavailable" }))
      : { configured: false, reason: "V3 QA configuration is incomplete" };
    const configured = staticallyConfigured && readiness.configured;
    return {
      configured,
      maximumCostMicros: priceCurrent ? maximumCostMicros : null,
      view: configured ? { providerId, modelId, billingChannel, effectiveAt, expiresAt } : null,
    };
  }

  private async buildPreviewV3(planId: string, rawInput: GenerationExecutionPreviewV3Input) {
    const input = generationExecutionPreviewV3InputSchema.parse(rawInput);
    const record = await this.client.generationPlanV3Record.findUnique({ where: { id: planId } });
    if (!record)
      throw this.error("GENERATION_TARGET_INVALID", "Generation Plan V3 was not found", 404);
    const plan = GenerationPlanV3Schema.parse(record.payloadJson);
    if (plan.id !== record.id || plan.planDigest !== record.planDigest)
      throw this.error("GENERATION_PLAN_STALE", "Generation Plan V3 identity changed", 409);
    const selected = new Set(input.shotIds);
    if (
      selected.size !== input.shotIds.length ||
      [...selected].some((id) => !plan.shotIds.includes(id))
    )
      throw this.error(
        "GENERATION_TARGET_INVALID",
        "Every selected Shot must belong to the exact Generation Plan V3",
        422,
      );

    const refsByShot = new Map(
      plan.shotIds.map((shotId, index) => [shotId, plan.generationSpecRefs[index]!]),
    );
    const selectedRefs = input.shotIds.map((shotId) => refsByShot.get(shotId)!);
    const specRecords = await this.client.generationSpecV3Record.findMany({
      where: { id: { in: selectedRefs.map((reference) => reference.id) } },
    });
    if (specRecords.length !== selectedRefs.length)
      throw this.error("GENERATION_PLAN_STALE", "A frozen Generation Spec V3 is missing", 409);
    const specById = new Map(specRecords.map((item) => [item.id, item]));
    const snapshotRecords = await this.client.planningInputSnapshotV3Record.findMany({
      where: {
        id: { in: specRecords.map((item) => item.planningInputSnapshotId) },
      },
    });
    const snapshotById = new Map(snapshotRecords.map((item) => [item.id, item]));
    const dynamicReferenceRecords = await this.client.referencePlanV3Record.findMany({
      where: { generationSpecId: { in: specRecords.map((item) => item.id) } },
    });
    const dynamicReferenceBySpecId = new Map(
      dynamicReferenceRecords.map((item) => [item.generationSpecId, item]),
    );
    const dynamicGraphRecords = await this.client.materializedGraphSnapshotV3Record.findMany({
      where: { generationSpecId: { in: specRecords.map((item) => item.id) } },
    });
    const dynamicGraphBySpecId = new Map(
      dynamicGraphRecords.map((item) => [item.generationSpecId, item]),
    );
    const storyboardShots = await this.client.storyboardShot.findMany({
      where: { id: { in: input.shotIds } },
      select: { id: true, ordinal: true, storyboardVersionId: true },
    });
    const shotById = new Map(storyboardShots.map((item) => [item.id, item]));
    const storyboardVersionIds = [...new Set(specRecords.map((item) => item.storyboardVersionId))];
    if (storyboardVersionIds.length !== 1)
      throw this.error("GENERATION_PLAN_STALE", "Selected Shots span Storyboard versions", 409);
    const storyboardVersionId = storyboardVersionIds[0];
    if (!storyboardVersionId)
      throw this.error("GENERATION_PLAN_STALE", "Storyboard version is missing", 409);
    const storyboardVersion = await this.client.storyboardVersion.findUnique({
      where: { id: storyboardVersionId },
      include: { storyboard: true, project: true },
    });
    if (
      !storyboardVersion ||
      storyboardVersion.projectId !== record.projectId ||
      storyboardVersion.project.status !== "ACTIVE" ||
      storyboardVersion.storyboard.status !== "ACTIVE" ||
      storyboardVersion.storyboard.headVersionId !== storyboardVersion.id
    )
      throw this.error(
        "GENERATION_PLAN_STALE",
        "The Storyboard head or active scope changed after planning",
        409,
      );

    const registry = await new CapabilityRegistryLoader().load();
    const compilerRegistry = new CapabilityCompilerRegistry();
    const targets = input.shotIds
      .map((shotId) => {
        const reference = refsByShot.get(shotId)!;
        const stored = specById.get(reference.id);
        const shot = shotById.get(shotId);
        if (!stored || !shot || shot.storyboardVersionId !== storyboardVersion.id)
          throw this.error("GENERATION_PLAN_STALE", "A selected Shot changed after planning", 409);
        const spec = GenerationSpecV3Schema.parse(stored.payloadJson);
        const snapshotRecord = snapshotById.get(stored.planningInputSnapshotId);
        if (
          spec.version !== reference.version ||
          !snapshotRecord ||
          spec.storyboardRevisionRef.id !== storyboardVersion.id ||
          spec.storyboardRevisionRef.version !== storyboardVersion.contentHash
        )
          throw this.error("GENERATION_PLAN_STALE", "Generation Spec V3 lineage changed", 409);
        const snapshot = PlanningInputSnapshotV3Schema.parse(snapshotRecord.payloadJson);
        const implementation = registry.resolveExact(spec.implementationRef);
        const compiler = registry.compilersByRef.get(
          `${spec.compilerRef.id}@${spec.compilerRef.version}`,
        );
        if (!compiler)
          throw this.error("GENERATION_PLAN_STALE", "Compiler version is unavailable", 409);
        const blockers = [...snapshot.unresolvedRequirementCodes];
        if (!(["READY", "TRIAL"] as const).includes(implementation.lifecycle as any))
          blockers.push("IMPLEMENTATION_NOT_SELECTABLE");
        if (implementation.testOnly || implementation.costPolicy.kind === "TEST_ZERO_CALL")
          blockers.push("TEST_ONLY_IMPLEMENTATION");
        const exactComposition =
          `${implementation.runtimeRef.id}@${implementation.runtimeRef.version}` ===
            `${spec.runtimeRef.id}@${spec.runtimeRef.version}` &&
          `${implementation.providerRef.id}@${implementation.providerRef.version}` ===
            `${spec.providerRef.id}@${spec.providerRef.version}` &&
          `${implementation.modelRef.id}@${implementation.modelRef.version}` ===
            `${spec.modelRef.id}@${spec.modelRef.version}` &&
          `${implementation.adapterRef.id}@${implementation.adapterRef.version}` ===
            `${spec.adapterRef.id}@${spec.adapterRef.version}` &&
          `${implementation.compilerRef.id}@${implementation.compilerRef.version}` ===
            `${spec.compilerRef.id}@${spec.compilerRef.version}`;
        if (!exactComposition) blockers.push("IMPLEMENTATION_VERSION_MISMATCH");
        let compiled: { compiledRequestDigest: string };
        if (compiler.compilerKey === "hailuo03-reference-dynamic-v3") {
          const referenceRecord = dynamicReferenceBySpecId.get(spec.id);
          const graphRecord = dynamicGraphBySpecId.get(spec.id);
          if (!referenceRecord || !graphRecord)
            throw this.error(
              "GENERATION_PLAN_STALE",
              "The frozen dynamic ReferencePlan or graph snapshot is missing",
              409,
            );
          try {
            const referencePlan = ReferencePlanV3Schema.parse(referenceRecord.payloadJson);
            const graphSnapshot = MaterializedGraphSnapshotV3Schema.parse(graphRecord.payloadJson);
            if (
              referencePlan.generationSpecId !== spec.id ||
              referencePlan.referencePlanDigest !== graphSnapshot.referencePlanDigest ||
              graphSnapshot.generationSpecRef.id !== spec.id ||
              graphSnapshot.generationSpecRef.version !== spec.version ||
              graphSnapshot.materializedGraphSha256 !== graphRecord.materializedGraphSha256 ||
              graphSnapshot.validation.status !== "VALID"
            )
              throw new Error("DYNAMIC_GRAPH_LINEAGE_MISMATCH");
            const replayed = compilerRegistry.compile(compiler, referencePlan) as {
              compiledRequestDigest: string;
              materializedGraphSha256: string;
            };
            if (replayed.materializedGraphSha256 !== graphSnapshot.materializedGraphSha256)
              blockers.push("MATERIALIZED_GRAPH_DIGEST_MISMATCH");
            compiled = replayed;
          } catch (error) {
            if (error instanceof ProjectAssetError) throw error;
            throw this.error(
              "GENERATION_PLAN_STALE",
              "The frozen dynamic graph can no longer be validated",
              409,
            );
          }
        } else {
          compiled = compilerRegistry.compile(compiler, {
            compilerRef: spec.compilerRef,
            prompt: spec.generationIntent.prompt,
            durationSeconds: spec.generationIntent.durationSeconds,
            bindings: snapshot.bindings.map((binding) => ({
              sourceRef: binding.sourceRef,
              sha256: binding.sha256,
              modality: binding.modality,
              order: binding.order,
              roleLabel: binding.roleLabel,
              necessity: binding.necessity,
            })),
          });
        }
        if (compiled.compiledRequestDigest !== spec.compiledRequestDigest)
          blockers.push("COMPILED_REQUEST_DIGEST_MISMATCH");
        if (implementation.costPolicy.kind === "MONETARY") {
          const now = Date.now();
          if (
            Date.parse(implementation.costPolicy.effectiveAt) > now ||
            Date.parse(implementation.costPolicy.expiresAt) <= now
          )
            blockers.push("COST_POLICY_EXPIRED");
        }
        const targetCore = {
          shotId,
          generationSpecRef: { id: spec.id, version: spec.version },
          implementationRef: spec.implementationRef,
          runtimeRef: spec.runtimeRef,
          providerRef: spec.providerRef,
          modelRef: spec.modelRef,
          adapterRef: spec.adapterRef,
          compilerRef: spec.compilerRef,
          compiledRequestDigest: spec.compiledRequestDigest,
          inputHash: spec.inputHash,
          dependencyHash: spec.dependencyHash,
          outputHash: spec.outputHash,
          costPolicy: implementation.costPolicy,
        };
        return {
          ...targetCore,
          ordinal: shot.ordinal,
          lifecycle: implementation.lifecycle as "READY" | "TRIAL",
          targetDigest: canonicalSha256(targetCore),
          blockers: [...new Set(blockers)].sort(),
        };
      })
      .sort(
        (left, right) => left.ordinal - right.ordinal || left.shotId.localeCompare(right.shotId),
      );

    const monetary = targets.filter((target) => target.costPolicy.kind === "MONETARY");
    const currencies = new Set(
      monetary.map((target) =>
        target.costPolicy.kind === "MONETARY" ? target.costPolicy.currency : "",
      ),
    );
    if (currencies.size > 1)
      for (const target of targets) target.blockers.push("COST_CURRENCY_MISMATCH");
    const maximumCostMicros =
      monetary.length === 0
        ? null
        : monetary.reduce(
            (sum, target) =>
              sum +
              (target.costPolicy.kind === "MONETARY" ? target.costPolicy.maximumCostMicros : 0),
            0,
          );
    const pricingExpiresAt =
      monetary.length === 0
        ? null
        : monetary
            .map((target) =>
              target.costPolicy.kind === "MONETARY" ? target.costPolicy.expiresAt : "",
            )
            .sort()[0]!;
    const costPolicyDigest = canonicalSha256(
      targets.map((target) => ({
        shotId: target.shotId,
        implementationRef: target.implementationRef,
        costPolicy: target.costPolicy,
      })),
    );
    const qa = await this.v3QaPricing();
    const qaBlockers = qa.configured ? [] : ["V3_AI_QA_NOT_READY"];
    const maximumTotalCostMicros =
      maximumCostMicros === null || qa.maximumCostMicros === null
        ? null
        : maximumCostMicros + qa.maximumCostMicros * targets.length;
    const core = {
      schemaVersion: "capability-generation-execution-preview-v3" as const,
      projectId: record.projectId,
      generationPlanId: record.id,
      planDigest: record.planDigest,
      selectedShotIds: targets.map((target) => target.shotId),
      targets,
      ready: targets.every((target) => target.blockers.length === 0),
      submissionBlockers: [
        ...(this.environment.PROJECT_GENERATION_LIVE_ENABLED === "true" ? [] : ["LIVE_DISABLED"]),
        ...qaBlockers,
      ],
      expectedCalls: targets.length,
      maximumCalls: targets.length,
      maximumAiQaCalls: targets.length,
      costPolicyDigest,
      maximumCostMicros,
      maximumAiQaCostMicros:
        qa.maximumCostMicros === null ? null : qa.maximumCostMicros * targets.length,
      maximumTotalCostMicros,
      aiQa: qa.view,
      currency: currencies.size === 1 ? [...currencies][0]! : null,
      localComputeResources: [
        ...new Set(
          targets.flatMap((target) =>
            target.costPolicy.kind === "LOCAL_COMPUTE" && target.costPolicy.resourceClass
              ? [target.costPolicy.resourceClass]
              : [],
          ),
        ),
      ].sort(),
      pricingExpiresAt,
      noRetry: true as const,
      noFallback: true as const,
      externalCalls: 0 as const,
      generationAuthorized: false as const,
    };
    return GenerationExecutionPreviewV3Schema.parse({
      ...core,
      previewHash: canonicalSha256(core),
    });
  }

  private async buildPreview(versionId: string, rawInput: GenerationExecutionPreviewInput) {
    const input = generationExecutionPreviewInputSchema.parse(rawInput);
    if (input.providerProfileId === "fake-video-v1" && !this.options.allowTestFixtures)
      throw this.error(
        "FAKE_PRODUCT_RETIRED",
        "Fake generation is retained for tests and historical reads only",
        410,
      );
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

    const continuityPlan = input.keyframePlanVersionId
      ? await this.resolveContinuityPlan(
          input.keyframePlanVersionId,
          plan.projectId,
          plan.storyboardVersionId,
          specs.map((spec) => spec.ordinal),
        )
      : null;

    const compiled = new Map<string, string>();
    const shots: PreviewShot[] = [];
    for (const spec of specs) {
      const blockers: string[] = [];
      const positivePrompt = spec.positivePrompt ?? "";
      const capability = (spec.capabilityRequirements ?? {}) as Record<string, unknown>;
      if (
        spec.contractVersion !== "generation-spec-v1" ||
        !positivePrompt ||
        spec.durationSeconds !== 4 ||
        capability.durationSeconds !== 4 ||
        capability.aspectRatio !== "PORTRAIT_9_16" ||
        capability.mode !== "REFERENCE_TO_VIDEO" ||
        capability.audioRequired !== false
      )
        blockers.push("GENERATION_PROFILE_INCOMPATIBLE");

      const slotResult = await this.resolveSlots(spec.references, blockers);
      const requestedTier = input.requiredVideoControlTier ?? "ORDINARY_REFERENCE";
      if (this.videoTierRank(requestedTier) > this.videoTierRank(provider.videoControlTier))
        blockers.push("VIDEO_CAPABILITY_INSUFFICIENT");
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
      let promptSummary = positivePrompt.slice(0, 2_000);
      let resolvedSlots = slotResult.slots;
      const continuity = continuityPlan?.shots.get(spec.ordinal) ?? null;
      if (continuityPlan && !continuity) blockers.push("KEYFRAME_SCOPE_CHANGED");
      if (continuity && resolvedSlots.length === 5) {
        resolvedSlots = resolvedSlots.map((slot) =>
          slot.role === "SCENE"
            ? {
                ...slot,
                sha256: continuity.startKeyframeHash,
                displayName: `已批准起始关键帧 K${spec.ordinal - 1}`,
                sourceKind: "KEYFRAME_ARTIFACT" as const,
                keyframeArtifactId: continuity.startKeyframeArtifactId,
              }
            : { ...slot, sourceKind: "PROJECT_ASSET" as const },
        );
      }
      if (resolvedSlots.length === 5) {
        const prompt = compileH3GenerationPrompt({
          positivePrompt: spec.positivePrompt ?? "",
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
        promptSummary = spec.positivePrompt?.slice(0, 2_000) ?? "";
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
          slots: resolvedSlots,
          continuity,
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
        slots: resolvedSlots,
        continuity,
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
      continuityProfileVersionId: continuityPlan?.continuityProfileVersionId ?? null,
      keyframePlanVersionId: continuityPlan?.keyframePlanVersionId ?? null,
      continuityScopeHash: continuityPlan?.scopeHash ?? null,
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

  private videoTierRank(tier: "ORDINARY_REFERENCE" | "LOCKED_START" | "LOCKED_START_END") {
    return { ORDINARY_REFERENCE: 0, LOCKED_START: 1, LOCKED_START_END: 2 }[tier];
  }

  private async resolveContinuityPlan(
    keyframePlanVersionId: string,
    projectId: string,
    storyboardVersionId: string,
    ordinals: number[],
  ) {
    const plan = await this.client.keyframePlanVersion.findUnique({
      where: { id: keyframePlanVersionId },
      include: {
        continuityProfileVersion: { include: { continuityProfile: true } },
        targets: {
          orderBy: { boundaryIndex: "asc" },
          include: {
            shotBoundary: true,
            attempts: {
              include: {
                artifact: { include: { decisions: { orderBy: { createdAt: "desc" } } } },
              },
            },
          },
        },
      },
    });
    if (!plan || plan.projectId !== projectId)
      throw this.error("KEYFRAME_SCOPE_CHANGED", "Approved keyframe plan was not found", 409);
    const profile = plan.continuityProfileVersion;
    if (
      plan.status !== "APPROVED" ||
      profile.storyboardVersionId !== storyboardVersionId ||
      profile.continuityProfile.approvedVersionId !== profile.id
    )
      throw this.error(
        "KEYFRAME_SCOPE_CHANGED",
        "Approve a current keyframe contact sheet before video preview",
        409,
      );
    const approvedByBoundary = new Map<
      number,
      { artifactId: string; sha256: string; boundaryHash: string }
    >();
    for (const target of plan.targets) {
      const artifact = target.attempts[0]?.artifact;
      if (!artifact || artifact.decisions[0]?.decision !== "APPROVED")
        throw this.error("KEYFRAME_SCOPE_CHANGED", "Every boundary keyframe must be approved", 409);
      await this.storage.resolveVerified(
        artifact.storageKey,
        artifact.sha256,
        Number(artifact.byteSize),
      );
      approvedByBoundary.set(target.boundaryIndex, {
        artifactId: artifact.id,
        sha256: artifact.sha256,
        boundaryHash: target.shotBoundary.stateHash,
      });
    }
    const shots = new Map<number, ContinuityBinding>();
    for (const ordinal of ordinals) {
      const start = approvedByBoundary.get(ordinal - 1);
      const end = approvedByBoundary.get(ordinal);
      if (!start || !end)
        throw this.error("KEYFRAME_SCOPE_CHANGED", "Shot boundary keyframes are incomplete", 409);
      shots.set(ordinal, {
        startBoundaryHash: start.boundaryHash,
        endBoundaryHash: end.boundaryHash,
        startKeyframeArtifactId: start.artifactId,
        startKeyframeHash: start.sha256,
        endKeyframeArtifactId: end.artifactId,
        endKeyframeHash: end.sha256,
        endKeyframeSoftTarget: true,
        warnings: ["当前 H3 为普通参考：结束关键帧只用于 AI QA 对比，不能硬锁最后一帧"],
      });
    }
    return {
      continuityProfileVersionId: profile.id,
      keyframePlanVersionId: plan.id,
      scopeHash: canonicalSha256({
        profileOutputHash: profile.outputHash,
        keyframePlanHash: plan.planHash,
        providerProfileId: plan.providerProfileId,
        shots: [...shots.entries()],
      }),
      shots,
    };
  }

  async createBatch(
    rawInput: CreateGenerationBatchInput,
    idempotencyKey: string,
    expectedPlanRowVersion?: number,
  ): Promise<any> {
    if (!idempotencyKey.trim())
      throw this.error("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    const input = createGenerationBatchInputSchema.parse(rawInput);
    if ("engineVersion" in input && input.engineVersion === "CAPABILITY_V3")
      return this.createCapabilityBatch(input, idempotencyKey);
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
    if ("engineVersion" in input) {
      if (expectedPlanRowVersion === undefined)
        throw this.error("PRECONDITION_REQUIRED", "If-Match is required", 428);
      return this.createWorkflowAgentBatch(input, idempotencyKey, expectedPlanRowVersion);
    }
    const built = await this.buildPreview(input.generationPlanVersionId, {
      providerProfileId: input.providerProfileId,
      generationSpecIds: input.generationSpecIds,
      ...(input.retryOfJobId ? { retryOfJobId: input.retryOfJobId } : {}),
      ...(input.retryRequirements ? { retryRequirements: input.retryRequirements } : {}),
      ...(input.keyframePlanVersionId
        ? { keyframePlanVersionId: input.keyframePlanVersionId }
        : {}),
      ...(input.requiredVideoControlTier
        ? { requiredVideoControlTier: input.requiredVideoControlTier }
        : {}),
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
            continuityProfileVersionId: built.public.continuityProfileVersionId,
            keyframePlanVersionId: built.public.keyframePlanVersionId,
            continuityScopeHash: built.public.continuityScopeHash,
            videoControlTier: provider.videoControlTier,
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
              startBoundaryHash: shot.continuity?.startBoundaryHash ?? null,
              endBoundaryHash: shot.continuity?.endBoundaryHash ?? null,
              startKeyframeHash: shot.continuity?.startKeyframeHash ?? null,
              endKeyframeHash: shot.continuity?.endKeyframeHash ?? null,
              endKeyframeSoftTarget: shot.continuity?.endKeyframeSoftTarget ?? false,
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

  private async createCapabilityBatch(
    input: Extract<CreateGenerationBatchInput, { engineVersion: "CAPABILITY_V3" }>,
    idempotencyKey: string,
  ) {
    const existing = await this.client.generationBatchV3Record.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (
        existing.previewHash !== input.previewHash ||
        existing.generationPlanId !== input.generationPlanId
      )
        throw this.error(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for another Generation Batch V3",
          409,
        );
      return this.getBatchV3(existing.id);
    }
    const preview = await this.buildPreviewV3(input.generationPlanId, {
      schemaVersion: "capability-generation-execution-preview-request-v3",
      shotIds: input.shotIds,
    });
    if (
      preview.previewHash !== input.previewHash ||
      preview.planDigest !== input.planDigest ||
      preview.costPolicyDigest !== input.costPolicyDigest ||
      preview.maximumCalls !== input.maximumCalls ||
      preview.maximumAiQaCalls !== input.maximumAiQaCalls ||
      preview.maximumCostMicros !== input.maximumCostMicros ||
      preview.submissionBlockers.length > 0
    )
      throw this.error(
        "PREVIEW_STALE",
        "The selected Shot scope, exact versions, or cost facts changed",
        409,
      );
    if (!preview.ready)
      throw this.error(
        preview.targets.flatMap((target) => target.blockers)[0] ?? "PRE_DISPATCH_BLOCKED",
        "One or more selected Shots are no longer executable",
        409,
      );
    if (this.environment.PROJECT_GENERATION_LIVE_ENABLED !== "true")
      throw this.error(
        "LIVE_DISABLED",
        "The server LIVE generation switch is disabled; no Batch was created",
        409,
      );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1_000);
    if (preview.pricingExpiresAt && Date.parse(preview.pricingExpiresAt) <= expiresAt.getTime())
      throw this.error(
        "COST_UNAVAILABLE",
        "Pricing expires before this exact authorization scope",
        409,
      );
    const scopeCore = {
      generationPlanId: preview.generationPlanId,
      planDigest: preview.planDigest,
      shotIds: preview.selectedShotIds,
      generationSpecRefs: preview.targets.map((target) => target.generationSpecRef),
      implementationRefs: preview.targets.map((target) => target.implementationRef),
      providerRefs: preview.targets.map((target) => target.providerRef),
      targetDigests: preview.targets.map((target) => target.targetDigest),
      expectedCalls: preview.expectedCalls,
      maximumCalls: preview.maximumCalls,
      maximumAiQaCalls: preview.maximumAiQaCalls,
      costPolicyDigest: preview.costPolicyDigest,
      maximumCostMicros: preview.maximumCostMicros,
      maximumAiQaCostMicros: preview.maximumAiQaCostMicros,
      maximumTotalCostMicros: preview.maximumTotalCostMicros,
      aiQa: preview.aiQa,
      expiresAt: expiresAt.toISOString(),
      noRetry: true as const,
      noFallback: true as const,
    };
    const scopeHash = canonicalSha256(scopeCore);
    const authorization = GenerationAuthorizationV3Schema.parse({
      id: randomUUID(),
      planDigest: preview.planDigest,
      shotIds: preview.selectedShotIds,
      generationSpecRefs: preview.targets.map((target) => target.generationSpecRef),
      implementationRefs: preview.targets.map((target) => target.implementationRef),
      providerRefs: preview.targets.map((target) => target.providerRef),
      expectedCalls: preview.expectedCalls,
      maximumCalls: preview.maximumCalls,
      maximumAiQaCalls: preview.maximumAiQaCalls,
      consumedAiQaCalls: 0,
      costPolicyDigest: preview.costPolicyDigest,
      maximumCostMicros: preview.maximumCostMicros,
      maximumAiQaCostMicros: preview.maximumAiQaCostMicros,
      maximumTotalCostMicros: preview.maximumTotalCostMicros,
      aiQa: preview.aiQa,
      expiresAt: expiresAt.toISOString(),
      noRetry: true,
      noFallback: true,
      consumedCalls: 0,
      state: "ACTIVE",
    } satisfies GenerationAuthorizationV3);
    const batchId = randomUUID();
    try {
      await this.client.$transaction(
        async (tx) => {
          const currentPlan = await tx.generationPlanV3Record.findUnique({
            where: { id: preview.generationPlanId },
            select: { planDigest: true },
          });
          if (!currentPlan || currentPlan.planDigest !== preview.planDigest)
            throw this.error("GENERATION_PLAN_STALE", "Generation Plan V3 changed", 409);
          await tx.generationAuthorizationV3Record.create({
            data: {
              id: authorization.id,
              projectId: preview.projectId,
              generationPlanId: preview.generationPlanId,
              planDigest: authorization.planDigest,
              scopeJson: scopeCore as Prisma.InputJsonValue,
              scopeHash,
              expectedCalls: authorization.expectedCalls,
              maximumCalls: authorization.maximumCalls,
              maximumCostMicros: authorization.maximumCostMicros,
              maximumAiQaCalls: authorization.maximumAiQaCalls,
              consumedAiQaCalls: 0,
              maximumAiQaCostMicros: authorization.maximumAiQaCostMicros,
              maximumTotalCostMicros: authorization.maximumTotalCostMicros,
              aiQaProviderId: authorization.aiQa?.providerId ?? null,
              aiQaModelId: authorization.aiQa?.modelId ?? null,
              aiQaPricingJson: authorization.aiQa as Prisma.InputJsonValue,
              expiresAt,
              noRetry: true,
              noFallback: true,
              state: "ACTIVE",
            },
          });
          await tx.generationBatchV3Record.create({
            data: {
              id: batchId,
              projectId: preview.projectId,
              generationPlanId: preview.generationPlanId,
              generationAuthorizationId: authorization.id,
              planDigest: preview.planDigest,
              previewHash: preview.previewHash,
              scopeHash,
              selectedShotIdsJson: preview.selectedShotIds as Prisma.InputJsonValue,
              expectedCalls: preview.expectedCalls,
              maximumCalls: preview.maximumCalls,
              maximumAiQaCalls: preview.maximumAiQaCalls,
              costPolicyDigest: preview.costPolicyDigest,
              maximumCostMicros: preview.maximumCostMicros,
              maximumAiQaCostMicros: preview.maximumAiQaCostMicros,
              maximumTotalCostMicros: preview.maximumTotalCostMicros,
              aiQaProviderId: preview.aiQa?.providerId ?? null,
              aiQaModelId: preview.aiQa?.modelId ?? null,
              aiQaPricingJson: preview.aiQa as Prisma.InputJsonValue,
              currency: preview.currency,
              idempotencyKey,
            },
          });
          await tx.generationBatchTargetV3Record.createMany({
            data: preview.targets.map((target) => ({
              id: randomUUID(),
              projectId: preview.projectId,
              generationBatchId: batchId,
              shotId: target.shotId,
              generationSpecId: target.generationSpecRef.id,
              ordinal: target.ordinal,
              targetDigest: target.targetDigest,
              implementationKey: target.implementationRef.id,
              implementationVersion: target.implementationRef.version,
              adapterKey: target.adapterRef.id,
              adapterVersion: target.adapterRef.version,
              compilerKey: target.compilerRef.id,
              compilerVersion: target.compilerRef.version,
            })),
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (cause) {
      if (cause instanceof ProjectAssetError) throw cause;
      if (cause instanceof Error && /P2002|unique/i.test(cause.message))
        throw this.error(
          "GENERATION_BATCH_CONFLICT",
          "This exact Generation Plan V3 scope was already confirmed",
          409,
        );
      throw cause;
    }
    return this.getBatchV3(batchId);
  }

  async getBatchV3(batchId: string) {
    const batch = await this.client.generationBatchV3Record.findUnique({
      where: { id: batchId },
      include: {
        authorization: true,
        targets: { orderBy: [{ ordinal: "asc" }, { id: "asc" }] },
      },
    });
    if (!batch)
      throw this.error("GENERATION_TARGET_INVALID", "Generation Batch V3 was not found", 404);
    const attempts = await this.client.generationAttemptV3Record.findMany({
      where: { generationBatchTargetId: { in: batch.targets.map((target) => target.id) } },
      orderBy: [{ attemptNumber: "asc" }, { createdAt: "asc" }],
    });
    const artifacts = await this.client.generationArtifactV3Record.findMany({
      where: { attemptId: { in: attempts.map((attempt) => attempt.id) } },
    });
    const decisions = await this.client.generationOwnerDecisionV3Record.findMany({
      where: { artifactId: { in: artifacts.map((artifact) => artifact.id) } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const qaRuns = await this.client.aiQaRunV3Record.findMany({
      where: { attemptId: { in: attempts.map((attempt) => attempt.id) } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const qaResults = await this.client.aiQaResultV3Record.findMany({
      where: { aiQaRunId: { in: qaRuns.map((run) => run.id) } },
    });
    return {
      schemaVersion: "capability-generation-batch-v3" as const,
      id: batch.id,
      projectId: batch.projectId,
      generationPlanId: batch.generationPlanId,
      planDigest: batch.planDigest,
      previewHash: batch.previewHash,
      scopeHash: batch.scopeHash,
      state: batch.state,
      safeResultCode: batch.safeResultCode,
      expectedCalls: batch.expectedCalls,
      maximumCalls: batch.maximumCalls,
      maximumAiQaCalls: batch.maximumAiQaCalls,
      maximumCostMicros: batch.maximumCostMicros === null ? null : Number(batch.maximumCostMicros),
      maximumAiQaCostMicros:
        batch.maximumAiQaCostMicros === null ? null : Number(batch.maximumAiQaCostMicros),
      maximumTotalCostMicros:
        batch.maximumTotalCostMicros === null ? null : Number(batch.maximumTotalCostMicros),
      aiQa: batch.aiQaPricingJson,
      currency: batch.currency,
      authorization: {
        id: batch.authorization.id,
        state: batch.authorization.state,
        consumedCalls: batch.authorization.consumedCalls,
        consumedAiQaCalls: batch.authorization.consumedAiQaCalls,
        expiresAt: batch.authorization.expiresAt.toISOString(),
        noRetry: batch.authorization.noRetry,
        noFallback: batch.authorization.noFallback,
      },
      targets: batch.targets.map((target) => {
        const targetAttempts = attempts.filter(
          (attempt) => attempt.generationBatchTargetId === target.id,
        );
        return {
          id: target.id,
          shotId: target.shotId,
          generationSpecId: target.generationSpecId,
          ordinal: target.ordinal,
          targetDigest: target.targetDigest,
          implementationRef: {
            id: target.implementationKey,
            version: target.implementationVersion,
          },
          adapterRef: { id: target.adapterKey, version: target.adapterVersion },
          compilerRef: { id: target.compilerKey, version: target.compilerVersion },
          state: target.state,
          safeResultCode: target.safeResultCode,
          providerCallCount: target.providerCallCount,
          attempts: targetAttempts.map((attempt) => {
            const artifact = artifacts.find((item) => item.attemptId === attempt.id);
            return {
              id: attempt.id,
              attemptNumber: attempt.attemptNumber,
              state: attempt.state,
              safeResultCode: attempt.safeResultCode,
              materializedGraphSha256: attempt.materializedGraphSha256,
              providerCallCount: attempt.providerCallCount,
              retryOfAttemptId: attempt.retryOfAttemptId,
              aiQa: qaRuns
                .filter((run) => run.attemptId === attempt.id)
                .map((run) => ({
                  id: run.id,
                  status: run.status,
                  safeResultCode: run.safeResultCode,
                  providerId: run.providerId,
                  modelId: run.requestedModelId,
                  result: qaResults.find((result) => result.aiQaRunId === run.id)
                    ? {
                        overallStatus: qaResults.find((result) => result.aiQaRunId === run.id)!
                          .overallStatus,
                        summary: qaResults.find((result) => result.aiQaRunId === run.id)!.summary,
                      }
                    : null,
                })),
              artifact: artifact
                ? {
                    id: artifact.id,
                    technicalStatus: artifact.technicalStatus,
                    technicalResultCode: artifact.technicalResultCode,
                    aiQaStatus: artifact.aiQaStatus,
                    contentUrl: `/api/capability-v3-artifacts/${artifact.id}/content`,
                    reviewUrl: `/api/capability-v3-artifacts/${artifact.id}`,
                    decisions: decisions
                      .filter((decision) => decision.artifactId === artifact.id)
                      .map((decision) => ({
                        id: decision.id,
                        decision: decision.decision,
                        reasonCode: decision.reasonCode,
                        notes: decision.notes,
                        createdAt: decision.createdAt.toISOString(),
                      })),
                  }
                : null,
            };
          }),
        };
      }),
      createdAt: batch.createdAt.toISOString(),
    };
  }

  private async createWorkflowAgentBatch(
    input: Extract<CreateGenerationBatchInput, { engineVersion: "WORKFLOW_AGENT_V1" }>,
    idempotencyKey: string,
    expectedPlanRowVersion: number,
  ) {
    const { snapshotHash: submittedCostHash, ...costCore } = input.costSnapshot;
    if (canonicalSha256(costCore) !== submittedCostHash)
      throw this.error("PREVIEW_STALE", "Cost snapshot changed; review it again", 409);
    const { policyHash: submittedPolicyHash, ...policyCore } = input.continuationPolicy;
    if (canonicalSha256(policyCore) !== submittedPolicyHash)
      throw this.error("PREVIEW_STALE", "Continuation policy changed; review it again", 409);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1_000);
    if (Date.parse(input.costSnapshot.pricingExpiresAt) <= expiresAt.getTime())
      throw this.error("COST_UNAVAILABLE", "Pricing expires before this authorization", 409);
    const batchId = randomUUID();
    await this.client.$transaction(
      async (tx) => {
        const version = await tx.generationPlanVersion.findUnique({
          where: { id: input.generationPlanVersionId },
          include: {
            generationPlan: { include: { project: true, storyboard: true } },
            shotExecutionPlans: {
              where: { id: { in: input.targets.map((target) => target.shotExecutionPlanId) } },
              include: { generationSpec: true, implementation: true },
            },
          },
        });
        if (!version)
          throw this.error(
            "GENERATION_PLAN_VERSION_NOT_FOUND",
            "Generation plan version was not found",
            404,
          );
        const plan = version.generationPlan;
        if (plan.project.status !== "ACTIVE")
          throw this.error("PROJECT_ARCHIVED", "Restore this project before generation", 409);
        if (plan.storyboard.status !== "ACTIVE")
          throw this.error("STORYBOARD_ARCHIVED", "Restore this storyboard before generation", 409);
        if (
          plan.rowVersion !== expectedPlanRowVersion ||
          plan.headVersionId !== version.id ||
          plan.approvedVersionId !== version.id
        )
          throw this.error("GENERATION_PLAN_STALE", "The approved Shot Plan changed", 412);
        if (version.shotExecutionPlans.length !== input.targets.length)
          throw this.error(
            "GENERATION_TARGET_INVALID",
            "Every selected Workflow Plan must belong to this Shot Plan version",
            422,
          );
        const submittedById = new Map(
          input.targets.map((target) => [target.shotExecutionPlanId, target]),
        );
        const orderedPlans = [...version.shotExecutionPlans].sort(
          (left, right) =>
            left.generationSpec.ordinal - right.generationSpec.ordinal ||
            left.id.localeCompare(right.id),
        );
        const reusedArtifactIds = input.targets.flatMap((target) =>
          target.executionDisposition === "REUSE_ARTIFACT" ? [target.sourceArtifactId] : [],
        );
        const reusedArtifacts =
          reusedArtifactIds.length > 0
            ? await tx.generatedArtifact.findMany({
                where: { id: { in: reusedArtifactIds } },
                include: {
                  generationJob: {
                    include: { generationBatchTarget: { include: { shotExecutionPlan: true } } },
                  },
                  reviewFrames: true,
                },
              })
            : [];
        const reusedById = new Map(reusedArtifacts.map((artifact) => [artifact.id, artifact]));
        for (const shotPlan of orderedPlans) {
          const submitted = submittedById.get(shotPlan.id);
          if (!submitted || submitted.planTemplateSha256 !== shotPlan.planTemplateSha256)
            throw this.error(
              "EXECUTION_PLAN_SHA_MISMATCH",
              "A Workflow Plan changed after preview",
              409,
            );
          if (
            shotPlan.lifecycleStatus !== "DRAFT" ||
            !["READY", "TRIAL"].includes(shotPlan.planningOutcome)
          )
            throw this.error(
              "PRE_DISPATCH_BLOCKED",
              "Every Workflow Plan must be a current READY or TRIAL draft",
              409,
            );
          if (
            !shotPlan.implementation ||
            !shotPlan.executorType ||
            !shotPlan.adapterId ||
            !shotPlan.adapterVersion
          )
            throw this.error(
              "ADAPTER_NOT_IMPLEMENTED",
              "A Workflow Plan has no executable adapter",
              409,
            );
          const payload = shotPlan.payloadJson as Record<string, any>;
          if (payload.dependencyPolicyHash !== input.dependencyPolicyHash)
            throw this.error("PREVIEW_STALE", "Dependency policy changed after preview", 409);
          if (
            payload.implementationId !== shotPlan.implementation.implementationKey ||
            payload.implementationVersion !== shotPlan.implementation.version ||
            payload.adapterId !== shotPlan.adapterId ||
            payload.adapterVersion !== shotPlan.adapterVersion
          )
            throw this.error(
              "EXECUTION_PLAN_SHA_MISMATCH",
              "Frozen implementation identity does not match the plan",
              409,
            );
          if (submitted.executionDisposition === "REUSE_ARTIFACT") {
            const artifact = reusedById.get(submitted.sourceArtifactId);
            const sourceTarget = artifact?.generationJob.generationBatchTarget;
            const sourcePlan = sourceTarget?.shotExecutionPlan;
            if (
              !artifact ||
              artifact.projectId !== version.projectId ||
              artifact.status !== "TECHNICALLY_VALID" ||
              artifact.detectedMimeType !== "video/mp4" ||
              !sourcePlan ||
              sourcePlan.requirementsHash !== shotPlan.requirementsHash ||
              sourcePlan.planTemplateSha256 !== shotPlan.planTemplateSha256 ||
              !sourceTarget.materializedExecutionSha256
            )
              throw this.error(
                "GENERATION_TARGET_INVALID",
                "The exact artifact is not reusable for this frozen Workflow Plan",
                409,
              );
            const dependencyFrames = artifact.reviewFrames.filter(
              (frame) =>
                frame.role === "FINAL" && frame.extractorVersion === "dependency-final-frame-v1",
            );
            if (dependencyFrames.length !== 1)
              throw this.error(
                "UPSTREAM_ARTIFACT_NOT_READY",
                "Reusable artifact dependency frame is unavailable",
                409,
              );
          }
        }
        const selectedHashes = new Set(orderedPlans.map((shotPlan) => shotPlan.planTemplateSha256));
        for (const shotPlan of orderedPlans) {
          const payload = shotPlan.payloadJson as Record<string, any>;
          for (const binding of Array.isArray(payload.inputBindings) ? payload.inputBindings : []) {
            if (
              binding?.type === "PREVIOUS_SHOT_FINAL_FRAME" &&
              !selectedHashes.has(binding.sourceShotExecutionPlanSha256)
            )
              throw this.error(
                "UPSTREAM_ARTIFACT_NOT_READY",
                "A required upstream Workflow Plan is outside the confirmed scope",
                409,
              );
          }
        }
        const executableTargets = input.targets.filter(
          (target) => target.executionDisposition === "EXECUTE",
        );
        const executablePlanIds = new Set(
          executableTargets.map((target) => target.shotExecutionPlanId),
        );
        const executablePlans = orderedPlans.filter((shotPlan) =>
          executablePlanIds.has(shotPlan.id),
        );
        const qaCost = (
          shotPlan: (typeof executablePlans)[number],
          field: "qaEstimatedCostMicros" | "qaMaximumCostMicros",
        ) => {
          const pricing = (shotPlan.payloadJson as Record<string, any>).pricing;
          const value = pricing?.[field];
          if (value === undefined) return 0n;
          if (!Number.isSafeInteger(value) || value < 0)
            throw this.error("COST_UNAVAILABLE", "QA pricing is invalid", 409);
          return BigInt(value);
        };
        const estimatedCostMicrosBigInt = executablePlans.reduce(
          (sum, shotPlan) =>
            sum + (shotPlan.estimatedCostMicros ?? 0n) + qaCost(shotPlan, "qaEstimatedCostMicros"),
          0n,
        );
        const maximumCostMicrosBigInt = executablePlans.reduce(
          (sum, shotPlan) =>
            sum + (shotPlan.maximumCostMicros ?? 0n) + qaCost(shotPlan, "qaMaximumCostMicros"),
          0n,
        );
        const estimatedCostMicros = Number(estimatedCostMicrosBigInt);
        const maximumCostMicros = Number(maximumCostMicrosBigInt);
        const currencies = new Set(executablePlans.map((shotPlan) => shotPlan.currency));
        const pricingExpiries = executablePlans
          .map((shotPlan) => {
            const pricing = (shotPlan.payloadJson as Record<string, any>).pricing;
            const generationExpiry = pricing?.expiresAt;
            const qaExpiry = pricing?.qaExpiresAt ?? generationExpiry;
            if (typeof generationExpiry !== "string" || typeof qaExpiry !== "string") return null;
            return new Date(
              Math.min(Date.parse(generationExpiry), Date.parse(qaExpiry)),
            ).toISOString();
          })
          .filter((value): value is string => typeof value === "string")
          .sort();
        if (
          executablePlans.some(
            (shotPlan) =>
              shotPlan.estimatedCostMicros === null ||
              shotPlan.maximumCostMicros === null ||
              shotPlan.currency === null,
          ) ||
          currencies.size > 1 ||
          pricingExpiries.length !== executablePlans.length
        )
          throw this.error(
            "COST_UNAVAILABLE",
            "Every executable Workflow Plan requires current exact pricing",
            409,
          );
        if (
          !Number.isSafeInteger(estimatedCostMicros) ||
          !Number.isSafeInteger(maximumCostMicros) ||
          estimatedCostMicrosBigInt !== BigInt(input.costSnapshot.estimatedCostMicros) ||
          maximumCostMicrosBigInt !== BigInt(input.costSnapshot.maximumCostMicros) ||
          (executablePlans.length > 0 &&
            ([...currencies][0] !== input.costSnapshot.currency ||
              pricingExpiries[0] !== input.costSnapshot.pricingExpiresAt)) ||
          executableTargets.length !== input.costSnapshot.generationCalls ||
          executableTargets.length !== input.costSnapshot.qaCalls
        )
          throw this.error("PREVIEW_STALE", "Batch cost or call scope changed after preview", 409);
        if (
          plan.project.maximumGenerationCostMicros !== null &&
          maximumCostMicrosBigInt > plan.project.maximumGenerationCostMicros
        )
          throw this.error(
            "BATCH_COST_LIMIT_EXCEEDED",
            "Batch maximum cost exceeds the Project limit",
            409,
          );
        if (
          plan.project.generationCostCurrency &&
          plan.project.generationCostCurrency !== input.costSnapshot.currency
        )
          throw this.error(
            "BATCH_COST_LIMIT_EXCEEDED",
            "Batch currency does not match the Project limit",
            409,
          );
        if (plan.project.continuationMode !== input.continuationPolicy.mode)
          throw this.error("PREVIEW_STALE", "QA continuation policy changed after preview", 409);
        const canonicalTargets = orderedPlans.map((shotPlan) => {
          const submitted = submittedById.get(shotPlan.id)!;
          return {
            shotExecutionPlanId: shotPlan.id,
            planTemplateSha256: shotPlan.planTemplateSha256,
            executionDisposition: submitted.executionDisposition,
            ...(submitted.executionDisposition === "REUSE_ARTIFACT"
              ? { sourceArtifactId: submitted.sourceArtifactId }
              : {}),
          };
        });
        const previewHash = canonicalSha256({
          engineVersion: "WORKFLOW_AGENT_V1",
          generationPlanVersionId: version.id,
          dependencyPolicyHash: input.dependencyPolicyHash,
          targets: canonicalTargets,
          costSnapshot: input.costSnapshot,
          continuationPolicy: input.continuationPolicy,
        });
        if (previewHash !== input.previewHash)
          throw this.error("PREVIEW_STALE", "Workflow preview changed before confirmation", 409);
        const scopeHash = canonicalSha256({
          previewHash,
          dependencyPolicyHash: input.dependencyPolicyHash,
          targets: canonicalTargets,
          maximumGenerationCalls: executableTargets.length,
          maximumAiQaCalls: executableTargets.length,
          maximumCostMicros,
          continuationPolicyHash: input.continuationPolicy.policyHash,
          retryPolicy: "NO_RETRY_NO_FALLBACK",
        });
        await tx.generationBatch.create({
          data: {
            id: batchId,
            projectId: version.projectId,
            generationPlanVersionId: version.id,
            engineVersion: "WORKFLOW_AGENT_V1",
            estimatedCostMicros,
            maximumCostMicros,
            currency: input.costSnapshot.currency,
            pricingSnapshotHash: input.costSnapshot.snapshotHash,
            continuationPolicyHash: input.continuationPolicy.policyHash,
            previewHash,
            scopeHash,
            idempotencyKey,
          },
        });
        for (const shotPlan of orderedPlans) {
          const submitted = submittedById.get(shotPlan.id)!;
          const targetId = randomUUID();
          await tx.generationBatchTarget.create({
            data: {
              id: targetId,
              projectId: version.projectId,
              generationBatchId: batchId,
              generationSpecId: shotPlan.generationSpecId,
              ordinal: shotPlan.generationSpec.ordinal,
              targetHash: canonicalSha256({
                planTemplateSha256: shotPlan.planTemplateSha256,
                executionDisposition: submitted.executionDisposition,
                sourceArtifactId:
                  submitted.executionDisposition === "REUSE_ARTIFACT"
                    ? submitted.sourceArtifactId
                    : null,
              }),
              referencesHash: shotPlan.requirementsHash,
              shotExecutionPlanId: shotPlan.id,
              executionDisposition: submitted.executionDisposition,
              ...(submitted.executionDisposition === "REUSE_ARTIFACT"
                ? { sourceArtifactId: submitted.sourceArtifactId }
                : {}),
            },
          });
          if (submitted.executionDisposition === "EXECUTE") {
            const generationJobId = randomUUID();
            await tx.generationJob.create({
              data: {
                id: generationJobId,
                projectId: version.projectId,
                generationBatchId: batchId,
                generationBatchTargetId: targetId,
                providerIdempotencyKey: generationJobId,
              },
            });
          }
        }
        const frozen = await tx.shotExecutionPlan.updateMany({
          where: {
            id: { in: orderedPlans.map((shotPlan) => shotPlan.id) },
            lifecycleStatus: "DRAFT",
          },
          data: { lifecycleStatus: "FROZEN", frozenAt: now },
        });
        if (frozen.count !== orderedPlans.length)
          throw this.error(
            "EXECUTION_PLAN_SHA_MISMATCH",
            "Workflow Plans changed while confirming",
            409,
          );
        await tx.executionAuthorization.create({
          data: {
            id: randomUUID(),
            projectId: version.projectId,
            generationBatchId: batchId,
            scopeHash,
            maximumGenerationCalls: executableTargets.length,
            maximumAiQaCalls: executableTargets.length,
            maximumCostMicros,
            currency: input.costSnapshot.currency,
            pricingSnapshotHash: input.costSnapshot.snapshotHash,
            confirmedAt: now,
            expiresAt,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    return this.getBatch(batchId);
  }

  async assertContinuityCurrent(batchId: string) {
    const batch = await this.client.generationBatch.findUnique({
      where: { id: batchId },
      include: {
        generationPlanVersion: { include: { generationPlan: true } },
        targets: {
          orderBy: { ordinal: "asc" },
          include: {
            shotExecutionPlan: {
              select: {
                id: true,
                planningOutcome: true,
                planTemplateSha256: true,
                implementation: {
                  select: {
                    implementationKey: true,
                    version: true,
                    providerProfileId: true,
                    modelProfileId: true,
                    executorType: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!batch)
      throw this.error("GENERATION_TARGET_INVALID", "Generation batch was not found", 404);
    if (!batch.keyframePlanVersionId) return { current: true as const };
    const continuity = await this.resolveContinuityPlan(
      batch.keyframePlanVersionId,
      batch.projectId,
      batch.generationPlanVersion.generationPlan.storyboardVersionId,
      batch.targets.map((target) => target.ordinal),
    );
    if (batch.continuityScopeHash !== continuity.scopeHash)
      throw this.error("KEYFRAME_SCOPE_CHANGED", "Continuity scope changed before submission", 409);
    for (const target of batch.targets) {
      const expected = continuity.shots.get(target.ordinal);
      if (
        !expected ||
        target.startBoundaryHash !== expected.startBoundaryHash ||
        target.endBoundaryHash !== expected.endBoundaryHash ||
        target.startKeyframeHash !== expected.startKeyframeHash ||
        target.endKeyframeHash !== expected.endKeyframeHash
      )
        throw this.error(
          "KEYFRAME_SCOPE_CHANGED",
          "A shot boundary changed before submission",
          409,
        );
    }
    return { current: true as const };
  }

  async getBatch(batchId: string): Promise<any> {
    const capabilityV3 = await this.client.generationBatchV3Record.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (capabilityV3) return this.getBatchV3(batchId);
    await this.finishBatchIfTerminal(batchId);
    const batch = await this.client.generationBatch.findUnique({
      where: { id: batchId },
      include: {
        authorization: { include: { consumptions: true } },
        targets: {
          orderBy: { ordinal: "asc" },
          include: {
            sourceArtifact: {
              include: {
                technicalChecks: true,
                reviewFrames: true,
                aiQaRuns: { include: { result: true } },
                humanQaDecisions: { orderBy: { createdAt: "desc" } },
              },
            },
          },
        },
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
    const finalOwnerReview = {
      schemaVersion: "final-owner-review-v1" as const,
      ready: batch.targets.every((target) => {
        const job = batch.jobs.find((candidate) => candidate.generationBatchTargetId === target.id);
        const artifact =
          target.sourceArtifact ??
          job?.artifacts.find((candidate) => candidate.status === "TECHNICALLY_VALID") ??
          null;
        return Boolean(
          artifact?.technicalChecks.some((check) => check.status === "PASS") &&
          artifact.humanQaDecisions.length === 0,
        );
      }),
      ownerDecisionRequired: true as const,
      items: batch.targets.map((target) => {
        const job = batch.jobs.find((candidate) => candidate.generationBatchTargetId === target.id);
        const artifact =
          target.sourceArtifact ??
          job?.artifacts.find((candidate) => candidate.status === "TECHNICALLY_VALID") ??
          null;
        const qa = artifact?.aiQaRuns.find((run) => run.status === "COMPLETED")?.result ?? null;
        const human = artifact?.humanQaDecisions[0] ?? null;
        return {
          ordinal: target.ordinal,
          generationSpecId: target.generationSpecId,
          executionDisposition: target.executionDisposition,
          artifactId: artifact?.id ?? null,
          technicalStatus: artifact?.technicalChecks.some((check) => check.status === "PASS")
            ? "PASS"
            : artifact
              ? "FAILED"
              : "PENDING",
          aiQaStatus: qa?.overallStatus ?? null,
          continuationDecision: qa?.continuationDecision ?? null,
          humanDecision: human?.decision ?? null,
          ownerDecisionRequired: !human,
        };
      }),
    };
    return { ...this.serialize(batch), finalOwnerReview };
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
    reservation?: { reservedCostMicros?: number; materializedPlanSha256?: string },
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
        const requestedReservation = reservation?.reservedCostMicros ?? 0;
        if (!Number.isSafeInteger(requestedReservation) || requestedReservation < 0)
          throw this.error("COST_UNAVAILABLE", "The operation cost reservation is invalid", 409);
        const reservedTotal = authorization.consumptions.reduce(
          (sum, item) => sum + (item.reservedCostMicros ?? 0n),
          0n,
        );
        if (
          authorization.maximumCostMicros !== null &&
          reservedTotal + BigInt(requestedReservation) > authorization.maximumCostMicros
        )
          throw this.error("BATCH_COST_LIMIT_EXCEEDED", "Execution cost budget is exhausted", 409);
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
              ...(reservation?.reservedCostMicros !== undefined
                ? { reservedCostMicros: reservation.reservedCostMicros }
                : {}),
              ...(reservation?.materializedPlanSha256
                ? { materializedPlanSha256: reservation.materializedPlanSha256 }
                : {}),
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
        status: input.decision === "FAIL" ? "QA_FAIL" : "QA_PASS",
        safeResultCode:
          input.decision === "PASS"
            ? "OWNER_QA_PASS"
            : input.decision === "RISK_ACCEPTED"
              ? "OWNER_QA_RISK_ACCEPTED"
              : "OWNER_QA_FAIL",
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
                "providerTaskId",
                "executionInputSnapshotJson",
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
