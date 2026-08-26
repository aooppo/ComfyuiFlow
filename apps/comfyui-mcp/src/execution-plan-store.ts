import {
  deriveSafeOutputPrefix,
  type ComfyUiExecutionPlanStore,
  type ExecutionPlanIdentity,
  type FrozenComfyUiExecutionRecord,
} from "@comfyuiflow/comfyui-bridge";
import type { ProjectPrisma, StorageProvider } from "@comfyuiflow/project-core";

const supportedRoles = {
  scene: "SCENE",
  product: "PRODUCT",
  character_full_body: "CHARACTER_FULL_BODY",
  character_face: "CHARACTER_FACE",
  character_rear: "CHARACTER_REAR",
  SCENE: "SCENE",
  PRODUCT: "PRODUCT",
  CHARACTER_FULL_BODY: "CHARACTER_FULL_BODY",
  CHARACTER_FACE: "CHARACTER_FACE",
  CHARACTER_REAR: "CHARACTER_REAR",
} as const satisfies Record<string, FrozenComfyUiExecutionRecord["inputs"][number]["role"]>;

export function normalizeExecutionInputRole(value: unknown) {
  return supportedRoles[String(value) as keyof typeof supportedRoles] ?? null;
}

export function createPrismaExecutionPlanStore(input: {
  prisma: ProjectPrisma;
  sourceStorage: StorageProvider;
  generatedStorage: StorageProvider;
  workflowId: string;
  workflowSha256: string;
  workflowConstraints: { durationSeconds: number; width: number; height: number; fps: number };
}): ComfyUiExecutionPlanStore {
  const load = async (generationJobId: string): Promise<FrozenComfyUiExecutionRecord | null> => {
    const job = await input.prisma.generationJob.findUnique({
      where: { id: generationJobId },
      include: {
        generationBatchTarget: {
          include: { shotExecutionPlan: { include: { generationSpec: true } } },
        },
        consumptions: true,
      },
    });
    const target = job?.generationBatchTarget;
    const plan = target?.shotExecutionPlan;
    if (!job || !target || !plan || plan.executorType !== "COMFYUI_GRAPH") return null;
    const consumption = job.consumptions.find((item) => item.operation === "GENERATION_SUBMIT");
    if (!consumption || !target.materializedExecutionSha256 || !job.providerIdempotencyKey)
      return null;
    const payload = plan.payloadJson as Record<string, any>;
    const bindings = Array.isArray(payload.inputBindings) ? payload.inputBindings : [];
    const resolvedInputs: FrozenComfyUiExecutionRecord["inputs"] = [];
    for (const binding of bindings) {
      if (!binding) continue;
      const role = normalizeExecutionInputRole(binding.inputSlot);
      if (!role) continue;
      if (binding.type === "ASSET_VERSION") {
        const file = await input.prisma.assetVersionFile.findUnique({
          where: { id: String(binding.assetVersionFileId) },
          include: { projectAsset: { include: { storedObject: true } } },
        });
        const stored = file?.projectAsset.storedObject;
        if (!file || !stored || stored.sha256 !== binding.sha256)
          throw new Error("EXECUTION_INPUT_HASH_MISMATCH");
        resolvedInputs.push({
          role,
          localPath: await input.sourceStorage.resolveVerified(
            stored.storageKey,
            stored.sha256,
            Number(stored.byteSize),
          ),
          sha256: stored.sha256,
        });
        continue;
      }
      if (binding.type === "PREVIOUS_SHOT_FINAL_FRAME") {
        const upstream = await input.prisma.generationBatchTarget.findFirst({
          where: {
            generationBatchId: target.generationBatchId,
            shotExecutionPlan: {
              planTemplateSha256: String(binding.sourceShotExecutionPlanSha256),
            },
          },
          include: {
            sourceArtifact: { include: { reviewFrames: true } },
            job: { include: { artifacts: { include: { reviewFrames: true } } } },
          },
        });
        const artifact =
          upstream?.executionDisposition === "REUSE_ARTIFACT"
            ? upstream.sourceArtifact
            : upstream?.job?.artifacts.find((item) => item.status === "TECHNICALLY_VALID");
        const frame = artifact?.reviewFrames.find(
          (item) =>
            item.role === "FINAL" && item.extractorVersion === String(binding.extractorVersion),
        );
        if (!frame) throw new Error("UPSTREAM_ARTIFACT_NOT_READY");
        resolvedInputs.push({
          role,
          localPath: await input.generatedStorage.resolveVerified(
            frame.storageKey,
            frame.sha256,
            Number(frame.byteSize),
          ),
          sha256: frame.sha256,
        });
      }
    }
    const prompt =
      plan.generationSpec.positivePrompt?.trim() ||
      [
        plan.generationSpec.startState,
        plan.generationSpec.action,
        plan.generationSpec.endState,
        plan.generationSpec.camera,
        plan.generationSpec.composition,
      ]
        .filter(Boolean)
        .join("\n");
    return {
      executionPlanId: plan.id,
      executionPlanSha256: plan.planTemplateSha256,
      lifecycleStatus: plan.lifecycleStatus,
      executorType: "COMFYUI_GRAPH",
      generationJobId: job.id,
      generationJobStatus: job.status,
      authorizationConsumptionId: consumption.id,
      authorizationOperation: "GENERATION_SUBMIT",
      authorizationGenerationJobId: consumption.generationJobId ?? "",
      materializedExecutionSha256: target.materializedExecutionSha256,
      authorizationMaterializedPlanSha256: consumption.materializedPlanSha256 ?? "",
      workflowId: input.workflowId,
      workflowSha256: input.workflowSha256,
      providerTaskId: job.providerIdempotencyKey,
      compiledPrompt: prompt,
      outputPrefix: deriveSafeOutputPrefix(plan.projectId, plan.id, target.ordinal),
      ...input.workflowConstraints,
      inputs: resolvedInputs,
    };
  };
  return {
    async loadForSubmission(identity: ExecutionPlanIdentity) {
      return load(identity.generationJobId);
    },
    loadSubmitted: load,
  };
}
