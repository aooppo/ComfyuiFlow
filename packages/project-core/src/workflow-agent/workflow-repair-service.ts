import { z } from "zod";
import { ShotModelSelectionSchema, WorkflowPlanningPreferenceSchema } from "@comfyuiflow/contracts";
import { ProjectAssetError } from "../contracts.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { validateDependencyGraph } from "./dependency-graph.js";
import { assertCurrentRepairProposal, planBlockedShotRepairs } from "./repair-planner.js";
import { applyLocalRepair } from "./workflow-agent-service.js";
import { PlanningPreferenceService } from "./planning-preference-service.js";

export const adoptLocalRepairSchema = z
  .object({
    shotExecutionPlanId: z.string().uuid(),
    impactHash: z.string().regex(/^[a-f0-9]{64}$/),
    idempotencyKey: z.string().trim().min(8).max(120),
    modelSelection: ShotModelSelectionSchema.optional(),
  })
  .strict();

export class WorkflowRepairService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async preview(planId: string) {
    const context = await this.loadContext(planId);
    const repair = planBlockedShotRepairs({
      sourceStoryboardVersionId:
        context.plan.generationPlanVersion.generationPlan.storyboardVersionId,
      blockedShotKey: context.plan.generationSpec.shotKey,
      blockerCodes: context.blockerCodes,
      graph: context.graph,
    });
    return {
      shotExecutionPlanId: planId,
      ...repair,
      proposals: repair.proposals.map((proposal) => ({
        proposalId: proposal.proposalHash,
        ...proposal,
      })),
      externalCalls: 0 as const,
      generationAuthorized: false as const,
      directorAuthorized: false as const,
    };
  }

  async adoptLocal(proposalHash: string, expectedPlanRowVersion: number, rawInput: unknown) {
    const input = adoptLocalRepairSchema.parse(rawInput);
    const context = await this.loadContext(input.shotExecutionPlanId);
    const current = planBlockedShotRepairs({
      sourceStoryboardVersionId:
        context.plan.generationPlanVersion.generationPlan.storyboardVersionId,
      blockedShotKey: context.plan.generationSpec.shotKey,
      blockerCodes: context.blockerCodes,
      graph: context.graph,
    });
    try {
      assertCurrentRepairProposal(proposalHash, input.impactHash, current);
    } catch {
      throw new ProjectAssetError(
        "REPAIR_PROPOSAL_STALE",
        "Repair scope changed; preview again",
        409,
      );
    }
    const proposal = current.proposals.find((item) => item.proposalHash === proposalHash)!;
    if (proposal.requiresAiDirector)
      throw new ProjectAssetError(
        "DIRECTOR_CONFIRMATION_REQUIRED",
        "Rewrite and split require a separate AI Director preview and confirmation",
        409,
      );
    const generationPlan = context.plan.generationPlanVersion.generationPlan;
    if (generationPlan.headVersionId !== context.plan.generationPlanVersionId)
      throw new ProjectAssetError(
        "GENERATION_PLAN_STALE",
        "The Shot Plan changed; preview repair again",
        409,
      );
    const rawPreferences = Array.isArray(context.plan.generationPlanVersion.planningPreferencesJson)
      ? context.plan.generationPlanVersion.planningPreferencesJson
      : [];
    const preferences = new Map<string, z.infer<typeof WorkflowPlanningPreferenceSchema>>();
    for (const value of rawPreferences) {
      const parsed = WorkflowPlanningPreferenceSchema.safeParse(value);
      if (parsed.success) preferences.set(parsed.data.shotKey, parsed.data);
    }
    const local = applyLocalRepair({
      proposal,
      ...(preferences.get(context.plan.generationSpec.shotKey)
        ? { currentPreference: preferences.get(context.plan.generationSpec.shotKey)! }
        : {}),
      ...(input.modelSelection ? { modelSelection: input.modelSelection } : {}),
    });
    if (local.kind === "ASSET_NAVIGATION") {
      return {
        adopted: false,
        action: proposal.action,
        navigation: {
          projectId: context.plan.projectId,
          shotKey: local.shotKey,
          blockerCode: local.blockerCode,
        },
        externalCalls: 0 as const,
      };
    }
    preferences.set(
      local.preference.shotKey,
      WorkflowPlanningPreferenceSchema.parse(local.preference),
    );
    const replanShotKeys = [
      proposal.affectedShotKeys[0]!,
      ...proposal.transitiveInvalidationShotKeys,
    ];
    const updated = await new PlanningPreferenceService(this.client).update(
      generationPlan.id,
      expectedPlanRowVersion,
      input.idempotencyKey,
      {
        schemaVersion: "workflow-planning-preferences-update-v1",
        parentVersionId: context.plan.generationPlanVersionId,
        currentPreferenceHash: context.plan.generationPlanVersion.planningPreferencesHash,
        shotPreferences: [...preferences.values()],
      },
      replanShotKeys,
    );
    return {
      adopted: true,
      action: proposal.action,
      proposalHash,
      impactHash: current.impactHash,
      ...updated,
    };
  }

  private async loadContext(planId: string) {
    const plan = await this.client.shotExecutionPlan.findUnique({
      where: { id: planId },
      include: {
        generationSpec: true,
        generationPlanVersion: {
          include: {
            generationPlan: true,
            specs: { orderBy: { ordinal: "asc" } },
            shotExecutionPlans: {
              include: { generationSpec: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });
    if (!plan)
      throw new ProjectAssetError("GENERATION_TARGET_INVALID", "Workflow Plan was not found", 404);
    if (plan.planningOutcome !== "BLOCKED")
      throw new ProjectAssetError(
        "PRE_DISPATCH_BLOCKED",
        "Only a blocked Shot has repair options",
        409,
      );
    const currentBySpec = new Map<string, typeof plan>();
    for (const candidate of plan.generationPlanVersion.shotExecutionPlans)
      if (!currentBySpec.has(candidate.generationSpecId))
        currentBySpec.set(candidate.generationSpecId, candidate as any);
    const dependencies = [...currentBySpec.values()].flatMap((candidate: any) => {
      const payload = candidate.payloadJson as Record<string, any>;
      return (Array.isArray(payload.inputBindings) ? payload.inputBindings : []).flatMap(
        (binding: any) =>
          binding?.type === "PREVIOUS_SHOT_FINAL_FRAME" && typeof binding.sourceShotKey === "string"
            ? [
                {
                  sourceShotKey: binding.sourceShotKey,
                  targetShotKey: candidate.generationSpec.shotKey,
                  type: "PREVIOUS_SHOT_FINAL_FRAME" as const,
                  importance: "HARD" as const,
                  requiredInputSlot:
                    typeof binding.inputSlot === "string" ? binding.inputSlot : "first_frame",
                },
              ]
            : [],
      );
    });
    const graph = validateDependencyGraph({
      shotKeys: plan.generationPlanVersion.specs.map((spec) => spec.shotKey),
      dependencies,
    });
    const payload = plan.payloadJson as Record<string, any>;
    const blockerCodes = [
      ...new Set([
        ...(Array.isArray(payload.blockerCodes)
          ? payload.blockerCodes.filter((code): code is string => typeof code === "string")
          : []),
        ...(plan.blockerCode ? [plan.blockerCode] : []),
      ]),
    ].sort();
    return { plan, graph, blockerCodes };
  }
}
