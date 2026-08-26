import { randomUUID } from "node:crypto";
import { WorkflowPlanningPreferencesUpdateSchema } from "@comfyuiflow/contracts";
import type { Prisma } from "../generated/client/index.js";
import { canonicalSha256 } from "../canonical-json.js";
import { ProjectAssetError } from "../contracts.js";
import { prisma, type ProjectPrisma } from "../prisma.js";

const headInclude = {
  specs: { include: { references: true }, orderBy: { ordinal: "asc" as const } },
} as const;

export class PlanningPreferenceService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async update(
    planId: string,
    expectedRowVersion: number,
    idempotencyKey: string,
    rawInput: unknown,
    invalidationShotKeys?: readonly string[],
  ) {
    if (!idempotencyKey.trim())
      throw new ProjectAssetError("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    const input = WorkflowPlanningPreferencesUpdateSchema.parse(rawInput);
    const normalizedPreferences = [...input.shotPreferences].sort((left, right) =>
      left.shotKey.localeCompare(right.shotKey),
    );
    const preferenceHash = canonicalSha256({
      schemaVersion: "workflow-planning-preferences-v1",
      shotPreferences: normalizedPreferences,
    });
    const idempotent = await this.client.generationPlanVersion.findUnique({
      where: { planningPreferencesIdempotencyKey: idempotencyKey },
    });
    if (idempotent) {
      if (
        idempotent.generationPlanId !== planId ||
        idempotent.planningPreferencesHash !== preferenceHash ||
        idempotent.parentVersionId !== input.parentVersionId
      )
        throw new ProjectAssetError(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for different planning preferences",
          409,
        );
      return {
        generationPlanVersionId: idempotent.id,
        preferenceHash,
        affectedShotKeys: [],
        externalCalls: 0 as const,
        generationAuthorized: false as const,
      };
    }

    return this.client.$transaction(
      async (tx) => {
        const plan = await tx.generationPlan.findUnique({
          where: { id: planId },
          include: { project: true, storyboard: true, headVersion: { include: headInclude } },
        });
        if (!plan?.headVersion)
          throw new ProjectAssetError(
            "GENERATION_PLAN_NOT_FOUND",
            "Generation plan was not found",
            404,
          );
        if (plan.project.status !== "ACTIVE")
          throw new ProjectAssetError(
            "PROJECT_ARCHIVED",
            "Restore this project before changing planning preferences",
            409,
          );
        if (plan.storyboard.status !== "ACTIVE")
          throw new ProjectAssetError(
            "STORYBOARD_ARCHIVED",
            "Restore this storyboard before changing planning preferences",
            409,
          );
        if (
          plan.rowVersion !== expectedRowVersion ||
          plan.headVersionId !== input.parentVersionId ||
          plan.headVersion.id !== input.parentVersionId
        )
          throw this.conflict();
        if ((plan.headVersion.planningPreferencesHash ?? null) !== input.currentPreferenceHash)
          throw this.conflict();
        const known = new Set(plan.headVersion.specs.map((spec) => spec.shotKey));
        if (normalizedPreferences.some((preference) => !known.has(preference.shotKey)))
          throw new ProjectAssetError(
            "GENERATION_TARGET_INVALID",
            "A planning preference references an unknown Shot",
            422,
          );

        const previous = this.preferenceMap(plan.headVersion.planningPreferencesJson);
        const next = new Map(
          normalizedPreferences.map((preference) => [preference.shotKey, preference]),
        );
        const affectedShotKeys = [...new Set([...previous.keys(), ...next.keys()])]
          .filter(
            (shotKey) =>
              canonicalSha256(previous.get(shotKey) ?? null) !==
              canonicalSha256(next.get(shotKey) ?? null),
          )
          .sort((left, right) => {
            const leftOrdinal =
              plan.headVersion!.specs.find((spec) => spec.shotKey === left)?.ordinal ?? 99;
            const rightOrdinal =
              plan.headVersion!.specs.find((spec) => spec.shotKey === right)?.ordinal ?? 99;
            return leftOrdinal - rightOrdinal || left.localeCompare(right);
          });
        const replanShotKeys = invalidationShotKeys
          ? [...new Set(invalidationShotKeys)]
              .filter((shotKey) => known.has(shotKey))
              .sort((left, right) => {
                const leftOrdinal =
                  plan.headVersion!.specs.find((spec) => spec.shotKey === left)?.ordinal ?? 99;
                const rightOrdinal =
                  plan.headVersion!.specs.find((spec) => spec.shotKey === right)?.ordinal ?? 99;
                return leftOrdinal - rightOrdinal || left.localeCompare(right);
              })
          : affectedShotKeys;
        const newVersionId = randomUUID();
        await tx.generationPlanVersion.create({
          data: {
            id: newVersionId,
            projectId: plan.projectId,
            generationPlanId: plan.id,
            versionNumber: plan.headVersion.versionNumber + 1,
            parentVersionId: plan.headVersion.id,
            source: "OWNER",
            plannerVersion: plan.headVersion.plannerVersion,
            contractVersion: plan.headVersion.contractVersion,
            inputHash: plan.headVersion.inputHash,
            referencesHash: plan.headVersion.referencesHash,
            outputHash: plan.headVersion.outputHash,
            planningPreferencesJson: normalizedPreferences as Prisma.InputJsonValue,
            planningPreferencesHash: preferenceHash,
            planningPreferencesIdempotencyKey: idempotencyKey,
          },
        });
        for (const spec of plan.headVersion.specs) {
          const newSpecId = randomUUID();
          await tx.generationSpec.create({
            data: {
              id: newSpecId,
              projectId: spec.projectId,
              generationPlanVersionId: newVersionId,
              storyboardShotId: spec.storyboardShotId,
              shotKey: spec.shotKey,
              ordinal: spec.ordinal,
              startState: spec.startState,
              action: spec.action,
              endState: spec.endState,
              camera: spec.camera,
              composition: spec.composition,
              continuityRequirements: spec.continuityRequirements as Prisma.InputJsonValue,
              durationSeconds: spec.durationSeconds,
              contractVersion: spec.contractVersion,
              requirementHash: spec.requirementHash,
              positivePrompt: spec.positivePrompt,
              ...(spec.requirementSpecJson !== null
                ? { requirementSpecJson: spec.requirementSpecJson as Prisma.InputJsonValue }
                : {}),
              ...(spec.capabilityRequirements !== null
                ? { capabilityRequirements: spec.capabilityRequirements as Prisma.InputJsonValue }
                : {}),
              inputHash: spec.inputHash,
              referencesHash: spec.referencesHash,
              outputHash: spec.outputHash,
            },
          });
          if (spec.references.length > 0)
            await tx.generationSpecReference.createMany({
              data: spec.references.map((reference) => ({
                id: randomUUID(),
                projectId: reference.projectId,
                generationSpecId: newSpecId,
                requirementId: reference.requirementId,
                productionAssetVersionId: reference.productionAssetVersionId,
                characterStateVersionId: reference.characterStateVersionId,
                assetVersionFileId: reference.assetVersionFileId,
                projectAssetId: reference.projectAssetId,
                expectedSha256: reference.expectedSha256,
                referenceUsage: reference.referenceUsage,
              })),
            });
        }
        const advanced = await tx.generationPlan.updateMany({
          where: {
            id: plan.id,
            rowVersion: expectedRowVersion,
            headVersionId: input.parentVersionId,
          },
          data: {
            headVersionId: newVersionId,
            approvedVersionId: null,
            rowVersion: { increment: 1 },
          },
        });
        if (advanced.count !== 1) throw this.conflict();
        if (replanShotKeys.length > 0) {
          const affectedSpecIds = plan.headVersion.specs
            .filter((spec) => replanShotKeys.includes(spec.shotKey))
            .map((spec) => spec.id);
          await tx.shotExecutionPlan.updateMany({
            where: {
              generationPlanVersionId: plan.headVersion.id,
              generationSpecId: { in: affectedSpecIds },
              lifecycleStatus: { in: ["DRAFT", "FROZEN"] },
            },
            data: {
              lifecycleStatus: "INVALIDATED",
              invalidatedAt: new Date(),
              invalidationCode: "PLANNING_PREFERENCES_CHANGED",
            },
          });
        }
        return {
          generationPlanVersionId: newVersionId,
          parentVersionId: plan.headVersion.id,
          rowVersion: expectedRowVersion + 1,
          preferenceHash,
          affectedShotKeys: replanShotKeys,
          externalCalls: 0 as const,
          generationAuthorized: false as const,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  private preferenceMap(value: unknown) {
    if (!Array.isArray(value)) return new Map<string, unknown>();
    return new Map(
      value.flatMap((item) =>
        typeof item === "object" &&
        item !== null &&
        "shotKey" in item &&
        typeof item.shotKey === "string"
          ? [[item.shotKey, item] as const]
          : [],
      ),
    );
  }

  private conflict() {
    return new ProjectAssetError(
      "PLAN_VERSION_CONFLICT",
      "This generation plan changed; reload before continuing",
      412,
    );
  }
}
