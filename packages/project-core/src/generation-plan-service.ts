import { randomUUID } from "node:crypto";
import type { GenerationSpecV1 } from "@comfyuiflow/contracts";
import { GenerationSpecV1Schema } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import {
  DETERMINISTIC_SHOT_PLANNER_VERSION,
  buildGenerationSpecs,
  hashGenerationSpec,
} from "./deterministic-shot-planner.js";
import {
  appendGenerationPlanVersionSchema,
  generationPlanDecisionSchema,
  type AppendGenerationPlanVersionInput,
  type GenerationPlanDecisionInput,
} from "./generation-plan-contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const specsInclude = {
  references: { orderBy: { requirementId: "asc" as const } },
};

const versionInclude = {
  specs: { include: specsInclude, orderBy: { ordinal: "asc" as const } },
};

type StoredSpec = {
  contractVersion: string;
  storyboardShotId: string;
  shotKey: string;
  ordinal: number;
  startState: string;
  action: string;
  endState: string;
  camera: string;
  composition: string;
  continuityRequirements: unknown;
  durationSeconds: number;
  positivePrompt: string | null;
  capabilityRequirements: unknown | null;
  inputHash: string;
  referencesHash: string;
  outputHash: string;
  references: Array<{
    requirementId: string;
    productionAssetVersionId: string;
    characterStateVersionId: string | null;
    assetVersionFileId: string;
    projectAssetId: string;
    expectedSha256: string;
    referenceUsage: GenerationSpecV1["references"][number]["referenceUsage"];
  }>;
};

type PlanForNormalization = {
  projectId: string;
  storyboardId: string;
  storyboardVersionId: string;
  manifestId: string;
  headVersion: { specs: StoredSpec[] } | null;
};

export class GenerationPlanService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async create(storyboardVersionId: string, idempotencyKey: string) {
    this.requireIdempotencyKey(idempotencyKey);
    const version = await this.client.storyboardVersion.findUnique({
      where: { id: storyboardVersionId },
      include: {
        project: true,
        storyboard: true,
        shots: { include: { requirements: true }, orderBy: { ordinal: "asc" } },
        manifest: {
          include: {
            bindings: {
              include: {
                productionAssetVersion: true,
                characterStateVersion: true,
                assetVersionFile: {
                  include: { projectAsset: { include: { storedObject: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!version)
      throw this.error(
        "GENERATION_PLAN_VERSION_NOT_FOUND",
        "Storyboard version was not found",
        404,
      );
    if (version.project.status !== "ACTIVE")
      throw this.error("PROJECT_ARCHIVED", "Restore this project before creating a shot plan", 409);
    if (version.storyboard.status !== "ACTIVE")
      throw this.error(
        "STORYBOARD_ARCHIVED",
        "Restore this storyboard before creating a shot plan",
        409,
      );
    if (version.storyboard.approvedVersionId !== version.id)
      throw this.error(
        "STORYBOARD_NOT_APPROVED",
        "Approve this storyboard version before creating a shot plan",
        409,
      );
    if (!version.manifest)
      throw this.error(
        "MANIFEST_MISSING",
        "The approved storyboard has no frozen asset manifest",
        409,
      );
    this.assertVariableShots(version.shots.map((shot) => shot.ordinal));
    const requirementIds = new Set(
      version.shots.flatMap((shot) => shot.requirements.map((requirement) => requirement.id)),
    );
    if (
      version.manifest.storyboardVersionId !== version.id ||
      version.manifest.bindings.some((binding) => !requirementIds.has(binding.requirementId)) ||
      [...requirementIds].some(
        (requirementId) =>
          !version.manifest!.bindings.some((binding) => binding.requirementId === requirementId),
      )
    ) {
      throw this.error(
        "MANIFEST_STALE",
        "The frozen manifest no longer matches the approved storyboard inputs",
        409,
      );
    }
    for (const binding of version.manifest.bindings) {
      if (
        binding.projectId !== version.projectId ||
        binding.productionAssetVersion.projectId !== version.projectId ||
        binding.assetVersionFile.projectId !== version.projectId ||
        binding.assetVersionFile.projectAsset.projectId !== version.projectId ||
        (binding.characterStateVersion &&
          binding.characterStateVersion.projectId !== version.projectId)
      ) {
        throw this.error("CROSS_PROJECT", "A manifest reference crossed projects", 409);
      }
      if (
        binding.assetVersionFile.status !== "ACTIVE" ||
        binding.assetVersionFile.projectAsset.status !== "READY"
      ) {
        throw this.error("REFERENCE_NOT_READY", "A frozen reference is not ready", 409);
      }
      if (
        binding.assetVersionFile.approvalStatus !== "ACCEPTED" ||
        binding.productionAssetVersion.status !== "ACTIVE" ||
        (binding.characterStateVersion && binding.characterStateVersion.status !== "ACTIVE")
      ) {
        throw this.error("REFERENCE_UNAPPROVED", "A frozen reference is not approved", 409);
      }
    }

    const requestHash = canonicalSha256({
      plannerVersion: DETERMINISTIC_SHOT_PLANNER_VERSION,
      storyboardVersionId: version.id,
      storyboardContentHash: version.contentHash,
      manifestId: version.manifest.id,
      requirementsHash: version.manifest.requirementsHash,
      finalBindingsHash: version.manifest.finalBindingsHash,
    });
    const existing = await this.client.generationPlan.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw this.error(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for different inputs",
          409,
        );
      return this.get(existing.id);
    }

    const references = version.manifest.bindings.map((binding) => ({
      requirementId: binding.requirementId,
      productionAssetVersionId: binding.productionAssetVersionId,
      characterStateVersionId: binding.characterStateVersionId,
      assetVersionFileId: binding.assetVersionFileId,
      projectAssetId: binding.projectAssetId,
      sha256: binding.assetVersionFile.projectAsset.storedObject.sha256,
      referenceUsage: binding.assetVersionFile.referenceUsage,
    }));
    const specs = buildGenerationSpecs({
      projectId: version.projectId,
      targetAspectRatio: version.project.targetAspectRatio,
      storyboardId: version.storyboardId,
      storyboardVersionId: version.id,
      manifestId: version.manifest.id,
      shots: version.shots,
      references,
    });
    const planId = randomUUID();
    const planVersionId = randomUUID();
    try {
      await this.client.$transaction(
        async (tx) => {
          const currentStoryboard = await tx.storyboard.findUnique({
            where: { id: version.storyboardId },
          });
          const currentManifest = await tx.assetResolutionManifest.findUnique({
            where: { id: version.manifest!.id },
          });
          if (currentStoryboard?.approvedVersionId !== version.id)
            throw this.error(
              "STORYBOARD_NOT_APPROVED",
              "Approve this storyboard version before creating a shot plan",
              409,
            );
          if (currentStoryboard.status !== "ACTIVE")
            throw this.error(
              "STORYBOARD_ARCHIVED",
              "Restore this storyboard before creating a shot plan",
              409,
            );
          if (currentManifest?.storyboardVersionId !== version.id)
            throw this.error("MANIFEST_STALE", "The frozen manifest is stale", 409);
          await tx.generationPlan.create({
            data: {
              id: planId,
              projectId: version.projectId,
              storyboardId: version.storyboardId,
              storyboardVersionId: version.id,
              manifestId: version.manifest!.id,
              idempotencyKey,
              requestHash,
              updatedAt: new Date(),
            },
          });
          await this.persistVersion(tx, {
            id: planVersionId,
            projectId: version.projectId,
            planId,
            versionNumber: 1,
            parentVersionId: null,
            source: "DETERMINISTIC_PLANNER",
            specs,
          });
          await tx.generationPlan.update({
            where: { id: planId },
            data: { headVersionId: planVersionId, rowVersion: 1 },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const winner = await this.client.generationPlan.findUnique({
          where: { idempotencyKey },
        });
        if (winner?.requestHash === requestHash) return this.get(winner.id);
      }
      throw error;
    }
    return this.get(planId);
  }

  async get(planId: string) {
    const plan = await this.client.generationPlan.findUnique({
      where: { id: planId },
      include: {
        headVersion: { include: versionInclude },
        approvedVersion: { select: { id: true, versionNumber: true, outputHash: true } },
        decisions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!plan) throw this.error("GENERATION_PLAN_NOT_FOUND", "Generation plan was not found", 404);
    return { ...plan, externalCalls: 0 as const, generationAuthorized: false as const };
  }

  async listForStoryboard(storyboardId: string) {
    const plans = await this.client.generationPlan.findMany({
      where: { storyboardId },
      select: {
        id: true,
        storyboardVersionId: true,
        createdAt: true,
        updatedAt: true,
        headVersion: { select: { versionNumber: true } },
        approvedVersion: { select: { versionNumber: true } },
        versions: {
          select: {
            _count: { select: { generationBatches: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return plans.map(({ versions, ...plan }) => ({
      ...plan,
      generationBatchCount: versions.reduce(
        (total, version) => total + version._count.generationBatches,
        0,
      ),
    }));
  }

  async listVersions(planId: string) {
    await this.get(planId);
    return this.client.generationPlanVersion.findMany({
      where: { generationPlanId: planId },
      select: {
        id: true,
        versionNumber: true,
        parentVersionId: true,
        source: true,
        plannerVersion: true,
        contractVersion: true,
        inputHash: true,
        referencesHash: true,
        outputHash: true,
        createdAt: true,
      },
      orderBy: { versionNumber: "desc" },
    });
  }

  async getVersion(versionId: string) {
    const version = await this.client.generationPlanVersion.findUnique({
      where: { id: versionId },
      include: versionInclude,
    });
    if (!version)
      throw this.error(
        "GENERATION_PLAN_VERSION_NOT_FOUND",
        "Generation plan version was not found",
        404,
      );
    return version;
  }

  async append(
    planId: string,
    expectedRowVersion: number,
    rawInput: AppendGenerationPlanVersionInput,
  ) {
    const input = appendGenerationPlanVersionSchema.parse(rawInput);
    return this.client.$transaction(
      async (tx) => {
        const plan = await tx.generationPlan.findUnique({
          where: { id: planId },
          include: { project: true, storyboard: true, headVersion: { include: versionInclude } },
        });
        if (!plan || !plan.headVersion)
          throw this.error("GENERATION_PLAN_NOT_FOUND", "Generation plan was not found", 404);
        if (plan.project.status !== "ACTIVE")
          throw this.error(
            "PROJECT_ARCHIVED",
            "Restore this project before editing the shot plan",
            409,
          );
        if (plan.storyboard.status !== "ACTIVE")
          throw this.error(
            "STORYBOARD_ARCHIVED",
            "Restore this storyboard before editing the shot plan",
            409,
          );
        if (plan.rowVersion !== expectedRowVersion || plan.headVersionId !== input.parentVersionId)
          throw this.conflict();
        const specs = this.normalizeOwnerSpecs(plan, input.specs);
        const versionId = randomUUID();
        await this.persistVersion(tx, {
          id: versionId,
          projectId: plan.projectId,
          planId: plan.id,
          versionNumber: plan.headVersion.versionNumber + 1,
          parentVersionId: plan.headVersion.id,
          source: "OWNER",
          specs,
        });
        const advanced = await tx.generationPlan.updateMany({
          where: {
            id: plan.id,
            rowVersion: expectedRowVersion,
            headVersionId: input.parentVersionId,
          },
          data: { headVersionId: versionId, approvedVersionId: null, rowVersion: { increment: 1 } },
        });
        if (advanced.count !== 1) throw this.conflict();
        return tx.generationPlan.findUniqueOrThrow({
          where: { id: plan.id },
          include: {
            headVersion: { include: versionInclude },
            approvedVersion: true,
            decisions: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async preflight(versionId: string) {
    const version = await this.client.generationPlanVersion.findUnique({
      where: { id: versionId },
      include: {
        generationPlan: { include: { storyboard: true, manifest: true } },
        specs: {
          include: {
            references: {
              include: {
                requirement: true,
                productionAssetVersion: true,
                characterStateVersion: true,
                assetVersionFile: {
                  include: { projectAsset: { include: { storedObject: true } } },
                },
              },
            },
          },
          orderBy: { ordinal: "asc" },
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
    const blockers = new Set<string>();
    const shotResults: Array<{ ordinal: number; blockers: string[] }> = [];
    if (plan.storyboard.approvedVersionId !== plan.storyboardVersionId)
      blockers.add("STORYBOARD_NOT_APPROVED");
    if (plan.storyboard.status !== "ACTIVE") blockers.add("STORYBOARD_ARCHIVED");
    if (plan.manifest.storyboardVersionId !== plan.storyboardVersionId)
      blockers.add("MANIFEST_STALE");
    if (
      version.specs.length < 1 ||
      version.specs.length > 20 ||
      version.specs.some((spec, index) => spec.ordinal !== index + 1)
    )
      blockers.add("GENERATION_SPEC_INVALID");
    for (const spec of version.specs) {
      const shotBlockers = new Set<string>();
      const contract = this.toContractSpec(plan, spec);
      const expected = hashGenerationSpec(this.withoutHashes(contract));
      if (
        expected.inputHash !== spec.inputHash ||
        expected.referencesHash !== spec.referencesHash ||
        expected.outputHash !== spec.outputHash
      ) {
        blockers.add("INPUT_HASH_MISMATCH");
        shotBlockers.add("INPUT_HASH_MISMATCH");
      }
      for (const reference of spec.references) {
        if (
          reference.projectId !== plan.projectId ||
          reference.requirement.projectId !== plan.projectId ||
          reference.productionAssetVersion.projectId !== plan.projectId ||
          reference.assetVersionFile.projectId !== plan.projectId ||
          reference.assetVersionFile.projectAsset.projectId !== plan.projectId ||
          (reference.characterStateVersion &&
            reference.characterStateVersion.projectId !== plan.projectId)
        ) {
          blockers.add("CROSS_PROJECT");
          shotBlockers.add("CROSS_PROJECT");
        }
        if (
          reference.assetVersionFile.projectAsset.status !== "READY" ||
          reference.assetVersionFile.status !== "ACTIVE"
        ) {
          blockers.add("REFERENCE_NOT_READY");
          shotBlockers.add("REFERENCE_NOT_READY");
        }
        if (
          reference.assetVersionFile.approvalStatus !== "ACCEPTED" ||
          reference.productionAssetVersion.status !== "ACTIVE" ||
          (reference.characterStateVersion && reference.characterStateVersion.status !== "ACTIVE")
        ) {
          blockers.add("REFERENCE_UNAPPROVED");
          shotBlockers.add("REFERENCE_UNAPPROVED");
        }
        if (
          reference.expectedSha256 !== reference.assetVersionFile.projectAsset.storedObject.sha256
        ) {
          blockers.add("INPUT_HASH_MISMATCH");
          shotBlockers.add("INPUT_HASH_MISMATCH");
        }
      }
      shotResults.push({ ordinal: spec.ordinal, blockers: [...shotBlockers].sort() });
    }
    const expectedInputHash = canonicalSha256(version.specs.map((spec) => spec.inputHash));
    const expectedReferencesHash = canonicalSha256(
      version.specs.map((spec) => spec.referencesHash),
    );
    const expectedOutputHash = canonicalSha256(version.specs.map((spec) => spec.outputHash));
    if (
      version.inputHash !== expectedInputHash ||
      version.referencesHash !== expectedReferencesHash ||
      version.outputHash !== expectedOutputHash
    ) {
      blockers.add("INPUT_HASH_MISMATCH");
    }
    return {
      versionId,
      ready: blockers.size === 0,
      blockers: [...blockers].sort(),
      shotResults,
      expectedOutputHash,
      generationAuthorized: false as const,
    };
  }

  async decide(
    versionId: string,
    expectedRowVersion: number,
    idempotencyKey: string,
    rawInput: GenerationPlanDecisionInput,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const input = generationPlanDecisionSchema.parse(rawInput);
    const requestHash = canonicalSha256({ versionId, input });
    const existing = await this.client.generationPlanDecision.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw this.error(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for another decision",
          409,
        );
      return { decision: existing, generationAuthorized: false as const };
    }
    const version = await this.client.generationPlanVersion.findUnique({
      where: { id: versionId },
      include: { generationPlan: { include: { project: true, storyboard: true } } },
    });
    if (!version)
      throw this.error(
        "GENERATION_PLAN_VERSION_NOT_FOUND",
        "Generation plan version was not found",
        404,
      );
    const plan = version.generationPlan;
    if (plan.project.status !== "ACTIVE")
      throw this.error(
        "PROJECT_ARCHIVED",
        "Restore this project before deciding the shot plan",
        409,
      );
    if (plan.storyboard.status !== "ACTIVE")
      throw this.error(
        "STORYBOARD_ARCHIVED",
        "Restore this storyboard before deciding the shot plan",
        409,
      );
    if (plan.rowVersion !== expectedRowVersion || plan.headVersionId !== version.id)
      throw this.conflict();
    if (input.decision === "APPROVED") {
      const result = await this.preflight(version.id);
      if (!result.ready)
        throw this.error(
          result.blockers[0] ?? "GENERATION_SPEC_INVALID",
          "Shot plan preflight has blocking issues",
          409,
        );
    } else if (plan.approvedVersionId !== version.id) {
      throw this.error(
        "DECISION_CONFLICT",
        "Only the currently approved plan version can be revoked",
        409,
      );
    }
    const decision = await this.client.$transaction(
      async (tx) => {
        const [currentProject, currentStoryboard] = await Promise.all([
          tx.project.findUnique({ where: { id: plan.projectId } }),
          tx.storyboard.findUnique({ where: { id: plan.storyboardId } }),
        ]);
        if (currentProject?.status !== "ACTIVE")
          throw this.error(
            "PROJECT_ARCHIVED",
            "Restore this project before deciding the shot plan",
            409,
          );
        if (currentStoryboard?.status !== "ACTIVE")
          throw this.error(
            "STORYBOARD_ARCHIVED",
            "Restore this storyboard before deciding the shot plan",
            409,
          );
        if (
          input.decision === "APPROVED" &&
          currentStoryboard?.approvedVersionId !== plan.storyboardVersionId
        )
          throw this.error(
            "STORYBOARD_NOT_APPROVED",
            "The source storyboard is no longer approved",
            409,
          );
        const created = await tx.generationPlanDecision.create({
          data: {
            projectId: plan.projectId,
            generationPlanId: plan.id,
            generationPlanVersionId: version.id,
            decision: input.decision,
            idempotencyKey,
            requestHash,
            notes: input.notes ?? null,
          },
        });
        const advanced = await tx.generationPlan.updateMany({
          where: { id: plan.id, rowVersion: expectedRowVersion, headVersionId: version.id },
          data: {
            approvedVersionId: input.decision === "APPROVED" ? version.id : null,
            rowVersion: { increment: 1 },
          },
        });
        if (advanced.count !== 1) throw this.conflict();
        return created;
      },
      { isolationLevel: "Serializable" },
    );
    return { decision, generationAuthorized: false as const };
  }

  private normalizeOwnerSpecs(plan: PlanForNormalization, rawSpecs: GenerationSpecV1[]) {
    const expectedByOrdinal = new Map(
      plan.headVersion!.specs.map((spec) => [spec.ordinal, this.toContractSpec(plan, spec)]),
    );
    if (rawSpecs.length !== expectedByOrdinal.size) {
      throw this.error(
        "GENERATION_SPEC_INVALID",
        "Every source shot must have exactly one generation specification",
        422,
      );
    }
    return rawSpecs.map((raw) => {
      const spec = GenerationSpecV1Schema.parse(raw);
      const expected = expectedByOrdinal.get(spec.ordinal);
      if (
        !expected ||
        spec.projectId !== plan.projectId ||
        spec.storyboardId !== plan.storyboardId ||
        spec.storyboardVersionId !== plan.storyboardVersionId ||
        spec.manifestId !== plan.manifestId ||
        spec.storyboardShotId !== expected.storyboardShotId ||
        spec.shotKey !== expected.shotKey ||
        canonicalSha256(spec.references) !== canonicalSha256(expected.references)
      ) {
        throw this.error(
          "INPUT_HASH_MISMATCH",
          "Shot identity or frozen references do not match the plan inputs",
          409,
        );
      }
      return hashGenerationSpec(this.withoutHashes(spec));
    });
  }

  private toContractSpec(
    plan: {
      projectId: string;
      storyboardId: string;
      storyboardVersionId: string;
      manifestId: string;
    },
    spec: StoredSpec,
  ): GenerationSpecV1 {
    if (
      spec.contractVersion !== "generation-spec-v1" ||
      spec.positivePrompt === null ||
      spec.capabilityRequirements === null
    ) {
      throw this.error(
        "GENERATION_SPEC_INVALID",
        "This legacy operation requires a GenerationSpec V1 payload",
        409,
      );
    }
    return GenerationSpecV1Schema.parse({
      schemaVersion: "generation-spec-v1",
      plannerVersion: DETERMINISTIC_SHOT_PLANNER_VERSION,
      projectId: plan.projectId,
      storyboardId: plan.storyboardId,
      storyboardVersionId: plan.storyboardVersionId,
      manifestId: plan.manifestId,
      storyboardShotId: spec.storyboardShotId,
      shotKey: spec.shotKey,
      ordinal: spec.ordinal,
      startState: spec.startState,
      action: spec.action,
      endState: spec.endState,
      camera: spec.camera,
      composition: spec.composition,
      continuityRequirements: spec.continuityRequirements,
      durationSeconds: spec.durationSeconds,
      positivePrompt: spec.positivePrompt,
      references: spec.references.map((reference) => ({
        requirementId: reference.requirementId,
        productionAssetVersionId: reference.productionAssetVersionId,
        characterStateVersionId: reference.characterStateVersionId,
        assetVersionFileId: reference.assetVersionFileId,
        projectAssetId: reference.projectAssetId,
        sha256: reference.expectedSha256,
        referenceUsage: reference.referenceUsage,
      })),
      capabilityRequirements: spec.capabilityRequirements,
      inputHash: spec.inputHash,
      referencesHash: spec.referencesHash,
      outputHash: spec.outputHash,
    });
  }

  private withoutHashes(spec: GenerationSpecV1) {
    return Object.fromEntries(
      Object.entries(spec).filter(
        ([key]) => !["inputHash", "referencesHash", "outputHash"].includes(key),
      ),
    ) as Omit<GenerationSpecV1, "inputHash" | "referencesHash" | "outputHash">;
  }

  private async persistVersion(
    tx: Parameters<Parameters<ProjectPrisma["$transaction"]>[0]>[0],
    input: {
      id: string;
      projectId: string;
      planId: string;
      versionNumber: number;
      parentVersionId: string | null;
      source: "DETERMINISTIC_PLANNER" | "OWNER";
      specs: GenerationSpecV1[];
    },
  ) {
    const inputHash = canonicalSha256(input.specs.map((spec) => spec.inputHash));
    const referencesHash = canonicalSha256(input.specs.map((spec) => spec.referencesHash));
    const outputHash = canonicalSha256(input.specs.map((spec) => spec.outputHash));
    await tx.generationPlanVersion.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        generationPlanId: input.planId,
        versionNumber: input.versionNumber,
        parentVersionId: input.parentVersionId,
        source: input.source,
        plannerVersion: DETERMINISTIC_SHOT_PLANNER_VERSION,
        contractVersion: "generation-spec-v1",
        inputHash,
        referencesHash,
        outputHash,
      },
    });
    for (const spec of input.specs) {
      const specId = randomUUID();
      await tx.generationSpec.create({
        data: {
          id: specId,
          projectId: input.projectId,
          generationPlanVersionId: input.id,
          storyboardShotId: spec.storyboardShotId,
          shotKey: spec.shotKey,
          ordinal: spec.ordinal,
          startState: spec.startState,
          action: spec.action,
          endState: spec.endState,
          camera: spec.camera,
          composition: spec.composition,
          continuityRequirements: spec.continuityRequirements,
          durationSeconds: spec.durationSeconds,
          contractVersion: "generation-spec-v1",
          positivePrompt: spec.positivePrompt,
          capabilityRequirements: spec.capabilityRequirements,
          inputHash: spec.inputHash,
          referencesHash: spec.referencesHash,
          outputHash: spec.outputHash,
        },
      });
      if (spec.references.length)
        await tx.generationSpecReference.createMany({
          data: spec.references.map((reference) => ({
            id: randomUUID(),
            projectId: input.projectId,
            generationSpecId: specId,
            requirementId: reference.requirementId,
            productionAssetVersionId: reference.productionAssetVersionId,
            characterStateVersionId: reference.characterStateVersionId,
            assetVersionFileId: reference.assetVersionFileId,
            projectAssetId: reference.projectAssetId,
            expectedSha256: reference.sha256,
            referenceUsage: reference.referenceUsage,
          })),
        });
    }
  }

  private assertVariableShots(ordinals: number[]) {
    if (
      ordinals.length < 1 ||
      ordinals.length > 20 ||
      ordinals.some((ordinal, index) => ordinal !== index + 1)
    )
      throw this.error(
        "GENERATION_SPEC_INVALID",
        "A generation plan requires 1–20 contiguously ordered storyboard shots",
        422,
      );
  }

  private requireIdempotencyKey(value: string) {
    if (!value.trim())
      throw this.error("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
  }

  private conflict() {
    return this.error(
      "PLAN_VERSION_CONFLICT",
      "This generation plan changed; reload before continuing",
      412,
    );
  }

  private error(code: string, message: string, status: number) {
    return new ProjectAssetError(code, message, status);
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
