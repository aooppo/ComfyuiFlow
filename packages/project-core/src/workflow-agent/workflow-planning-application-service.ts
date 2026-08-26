import {
  ShotRequirementSpecV2Schema,
  WorkflowPlanningRequestSchema,
  type ShotRequirementSpecV2,
} from "@comfyuiflow/contracts";
import { GenerationAdapterRegistry } from "../generation-adapter.js";
import { canonicalSha256 } from "../canonical-json.js";
import { ProjectAssetError } from "../contracts.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { computeShotRequirementHash } from "./requirement-analyzer.js";
import { ExecutionPlanService } from "./execution-plan-service.js";
import { GenerationRegistryLoader } from "./registry.js";
import { WorkflowAgentService } from "./workflow-agent-service.js";

type PlanningPreference = ReturnType<
  typeof WorkflowPlanningRequestSchema.parse
>["shotPreferences"][number];

const versionInclude = {
  generationPlan: { include: { project: true, storyboard: true } },
  specs: {
    include: {
      references: {
        include: {
          productionAssetVersion: { include: { productionAsset: true } },
          assetVersionFile: true,
        },
      },
    },
    orderBy: { ordinal: "asc" as const },
  },
} as const;

export class WorkflowPlanningApplicationService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly registryLoader = new GenerationRegistryLoader(),
    private readonly adapters = new GenerationAdapterRegistry(),
  ) {}

  async previewAndPersist(versionId: string, rawRequest: unknown) {
    const request = WorkflowPlanningRequestSchema.parse(rawRequest);
    const version = await this.client.generationPlanVersion.findUnique({
      where: { id: versionId },
      include: versionInclude,
    });
    if (!version)
      throw new ProjectAssetError(
        "GENERATION_PLAN_VERSION_NOT_FOUND",
        "Generation plan version was not found",
        404,
      );
    if (version.generationPlan.project.status !== "ACTIVE")
      throw new ProjectAssetError("PROJECT_ARCHIVED", "Restore this project before planning", 409);
    if (version.generationPlan.storyboard.status !== "ACTIVE")
      throw new ProjectAssetError(
        "STORYBOARD_ARCHIVED",
        "Restore this storyboard before planning",
        409,
      );
    if (version.generationPlan.headVersionId !== version.id)
      throw new ProjectAssetError(
        "GENERATION_PLAN_STALE",
        "Workflow planning requires the current Shot Plan version",
        409,
      );

    const preferences = new Map(request.shotPreferences.map((item) => [item.shotKey, item]));
    const knownShotKeys = new Set(version.specs.map((spec) => spec.shotKey));
    if ([...preferences.keys()].some((key) => !knownShotKeys.has(key)))
      throw new ProjectAssetError(
        "GENERATION_TARGET_INVALID",
        "A planning preference references an unknown Shot",
        422,
      );

    const registry = await this.registryLoader.load();
    const persistence = new ExecutionPlanService(this.client);
    const implementationRecords = await persistence.syncRegistry(registry);
    const recordIds = [...implementationRecords.values()].flatMap((record) =>
      record ? [record.id] : [],
    );
    const evidence =
      recordIds.length > 0
        ? await this.client.generationImplementationEvidence.findMany({
            where: { implementationId: { in: recordIds } },
            orderBy: [{ implementationId: "asc" }, { recordedAt: "asc" }],
          })
        : [];
    const runtimeFacts = new Map();
    const compilationFacts = new Map();
    for (const [identity, record] of implementationRecords) {
      if (!record) continue;
      const ownEvidence = evidence.filter((item) => item.implementationId === record.id);
      const real = ownEvidence.filter((item) =>
        ["REAL_GENERATION_JOB", "LEGACY_REAL_ARTIFACT"].includes(item.sourceType),
      );
      let adapterImplemented = true;
      try {
        this.adapters.resolveIdentity(record.adapterId, record.adapterVersion);
      } catch {
        adapterImplemented = false;
      }
      const readinessPassed = ownEvidence.some(
        (item) => item.sourceType === "READINESS" && item.technicalResult === "TECHNICALLY_VALID",
      );
      const staticValidationPassed = ownEvidence.some(
        (item) =>
          item.sourceType === "STATIC_VALIDATION" && item.technicalResult === "TECHNICALLY_VALID",
      );
      runtimeFacts.set(identity, {
        lifecycleStatus: record.status,
        providerConfigured: readinessPassed,
        readinessPassed,
        adapterImplemented,
        evidence: {
          passes: real.filter((item) => item.technicalResult === "TECHNICALLY_VALID").length,
          attempts: real.length,
        },
      });
      compilationFacts.set(identity, {
        catalogReady: staticValidationPassed,
        staticValidationPassed,
        preprocessingReady: staticValidationPassed,
      });
    }

    const planningShots = version.specs.map((stored) => ({
      generationSpecId: stored.id,
      spec: this.toRequirementSpec(version, stored, preferences.get(stored.shotKey)),
    }));
    const preview = new WorkflowAgentService(registry, this.adapters).plan({
      shots: planningShots,
      runtimeFacts,
      compilationFacts,
      now: new Date(),
    });
    const persisted: Array<{ id: string }> = [];
    for (const shot of preview.shots) {
      const implementationDatabaseId = shot.implementationIdentity
        ? (implementationRecords.get(shot.implementationIdentity)?.id ?? null)
        : null;
      persisted.push(
        await persistence.persistDraft(
          {
            projectId: version.projectId,
            generationPlanVersionId: version.id,
            generationSpecId: shot.generationSpecId,
            implementationIdentity: shot.implementationIdentity,
            planningInputHash: shot.planningInputHash,
            requirementsHash: shot.requirementsHash,
            capabilitySnapshotHash: shot.capabilitySnapshotHash,
            payload: shot.payload,
            planTemplateSha256: shot.planTemplateSha256,
            estimatedCostMicros: shot.estimatedCostMicros,
            maximumCostMicros: shot.maximumCostMicros,
            currency: shot.currency,
            planningOutcome: shot.planningOutcome,
            blockerCode: shot.blockerCodes[0] ?? null,
          },
          implementationDatabaseId,
        ),
      );
    }
    const executable = preview.shots.filter(
      (shot) => shot.planningOutcome === "READY" || shot.planningOutcome === "TRIAL",
    );
    const currencies = new Set(
      executable.flatMap((shot) => (shot.currency ? [shot.currency] : [])),
    );
    const priceExpiries = executable.flatMap((shot) =>
      shot.pricingExpiresAt ? [shot.pricingExpiresAt] : [],
    );
    const estimatedCostBigInt = executable.reduce(
      (sum, shot) => sum + BigInt(shot.estimatedCostMicros ?? 0),
      0n,
    );
    const maximumCostBigInt = executable.reduce(
      (sum, shot) => sum + BigInt(shot.maximumCostMicros ?? 0),
      0n,
    );
    const costCore =
      executable.length === preview.shots.length &&
      executable.every(
        (shot) =>
          shot.estimatedCostMicros !== null &&
          shot.maximumCostMicros !== null &&
          shot.currency &&
          shot.pricingExpiresAt,
      ) &&
      currencies.size === 1 &&
      estimatedCostBigInt <= BigInt(Number.MAX_SAFE_INTEGER) &&
      maximumCostBigInt <= BigInt(Number.MAX_SAFE_INTEGER)
        ? {
            schemaVersion: "batch-cost-snapshot-v1" as const,
            currency: [...currencies][0]!,
            estimatedCostMicros: Number(estimatedCostBigInt),
            maximumCostMicros: Number(maximumCostBigInt),
            generationCalls: executable.length,
            qaCalls: executable.length,
            pricingExpiresAt: [...priceExpiries].sort()[0]!,
            retryPolicy: "NO_RETRY_NO_FALLBACK" as const,
          }
        : null;
    const costSnapshot = costCore ? { ...costCore, snapshotHash: canonicalSha256(costCore) } : null;
    const continuationCore = {
      schemaVersion: "qa-continuation-policy-v1" as const,
      mode: version.generationPlan.project.continuationMode,
      hardCriteria: [
        "IDENTITY",
        "PRODUCT_STRUCTURE",
        "VISUAL_DAMAGE",
        "UNEXPECTED_OBJECTS",
        "CROSS_FRAME_CONTINUITY",
      ] as const,
      hardFailConfidence: "HIGH" as const,
    };
    const continuationPolicy = {
      ...continuationCore,
      policyHash: canonicalSha256(continuationCore),
    };
    const confirmationTargets = preview.shots.map((shot, index) => ({
      shotExecutionPlanId: persisted[index]!.id,
      planTemplateSha256: shot.planTemplateSha256,
      executionDisposition: "EXECUTE" as const,
    }));
    const confirmationCore = {
      engineVersion: "WORKFLOW_AGENT_V1" as const,
      generationPlanVersionId: version.id,
      dependencyPolicyHash: preview.dependencyPolicyHash,
      targets: confirmationTargets,
      costSnapshot,
      continuationPolicy,
    };
    const confirmationPreviewHash = canonicalSha256(confirmationCore);
    return {
      schemaVersion: preview.schemaVersion,
      projectId: version.projectId,
      generationPlanVersionId: version.id,
      registrySha256: preview.registrySha256,
      dependencyPolicyHash: preview.dependencyPolicyHash,
      counts: preview.counts,
      shots: preview.shots.map((shot, index) => ({
        planId: persisted[index]?.id,
        shotKey: shot.shotKey,
        ordinal: shot.ordinal,
        planningOutcome: shot.planningOutcome,
        blockerCodes: shot.blockerCodes,
        implementationId:
          typeof shot.payload.implementationId === "string" ? shot.payload.implementationId : null,
        modelProfileId:
          typeof shot.payload.modelProfileId === "string" ? shot.payload.modelProfileId : null,
        executorType:
          typeof shot.payload.executorType === "string" ? shot.payload.executorType : null,
        estimatedCostMicros: shot.estimatedCostMicros,
        currency: shot.currency,
        pricingExpiresAt: shot.pricingExpiresAt,
        planTemplateSha256: shot.planTemplateSha256,
      })),
      targets: confirmationTargets,
      costSnapshot,
      continuationPolicy,
      canConfirm:
        preview.counts.blocked === 0 && preview.counts.waiting === 0 && costSnapshot !== null,
      previewHash: confirmationPreviewHash,
      planningPreviewHash: preview.previewHash,
      externalCalls: 0 as const,
      generationAuthorized: false as const,
    };
  }

  private toRequirementSpec(
    version: Awaited<ReturnType<ProjectPrisma["generationPlanVersion"]["findUnique"]>> & {
      generationPlan: any;
      specs: any[];
    },
    stored: any,
    preference?: PlanningPreference,
  ): ShotRequirementSpecV2 {
    if (stored.contractVersion === "shot-requirement-spec-v2" && stored.requirementSpecJson) {
      const parsed = ShotRequirementSpecV2Schema.parse(stored.requirementSpecJson);
      return preference
        ? ShotRequirementSpecV2Schema.parse({
            ...parsed,
            modelSelection: preference.modelSelection,
            requirementHash: computeShotRequirementHash({
              ...parsed,
              modelSelection: preference.modelSelection,
            }),
          })
        : parsed;
    }
    const references = stored.references
      .map((reference: any) => ({
        assetVersionFileId: reference.assetVersionFileId,
        sha256: reference.expectedSha256,
        semanticRole: this.semanticRole(reference),
      }))
      .sort((left: any, right: any) =>
        `${left.semanticRole}:${left.assetVersionFileId}`.localeCompare(
          `${right.semanticRole}:${right.assetVersionFileId}`,
        ),
      );
    const capability =
      stored.capabilityRequirements && typeof stored.capabilityRequirements === "object"
        ? (stored.capabilityRequirements as Record<string, unknown>)
        : {};
    const aspectRatio = ["PORTRAIT_9_16", "LANDSCAPE_16_9", "SQUARE_1_1", "PORTRAIT_4_5"].includes(
      String(capability.aspectRatio),
    )
      ? (capability.aspectRatio as ShotRequirementSpecV2["aspectRatio"])
      : version.generationPlan.project.targetAspectRatio;
    const unhashed = {
      schemaVersion: "shot-requirement-spec-v2" as const,
      projectId: version.projectId,
      storyboardId: version.generationPlan.storyboardId,
      storyboardVersionId: version.generationPlan.storyboardVersionId,
      generationPlanVersionId: version.id,
      storyboardShotId: stored.storyboardShotId,
      shotKey: stored.shotKey,
      ordinal: stored.ordinal,
      startState: stored.startState,
      action: stored.action,
      endState: stored.endState,
      camera: stored.camera,
      composition: stored.composition,
      durationSeconds: stored.durationSeconds,
      aspectRatio,
      references,
      dependencies: [],
      modelSelection: preference?.modelSelection ?? { mode: "AUTO" as const },
    };
    return ShotRequirementSpecV2Schema.parse({
      ...unhashed,
      requirementHash: computeShotRequirementHash(unhashed),
    });
  }

  private semanticRole(reference: any): string {
    const type = reference.productionAssetVersion?.productionAsset?.type;
    const usage = reference.referenceUsage;
    const viewpoint = reference.assetVersionFile?.viewpoint;
    if (type === "SCENE" && usage === "SCENE_STYLE") return "scene";
    if (type === "PROP" && usage === "PROP_DETAIL") return "product";
    if (type === "CHARACTER" && usage === "FACE") return "character_face";
    if (
      type === "CHARACTER" &&
      ["FULL_BODY", "IDENTITY"].includes(usage) &&
      ["REAR", "REAR_THREE_QUARTER"].includes(viewpoint)
    )
      return "character_rear";
    if (type === "CHARACTER" && usage === "FULL_BODY") return "character_full_body";
    return String(usage).toLowerCase();
  }
}
