import {
  deriveSafeOutputPrefix,
  type ComfyUiCapabilityV3ExecutionStore,
  type ComfyUiExecutionPlanStore,
  type ExecutionPlanIdentity,
  type FrozenComfyUiExecutionRecord,
} from "@comfyuiflow/comfyui-bridge";
import { MaterializedGraphSnapshotV3Schema } from "@comfyuiflow/contracts";
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

export function createPrismaCapabilityV3ExecutionStore(input: {
  prisma: ProjectPrisma;
  sourceStorage: StorageProvider;
  generatedStorage: StorageProvider;
}): ComfyUiCapabilityV3ExecutionStore {
  const resolveInput = async (projectId: string, sha256: string) => {
    const source = await input.prisma.asset.findFirst({
      where: { projectId, storedObject: { sha256 } },
      include: { storedObject: true },
    });
    if (source)
      return input.sourceStorage.resolveVerified(
        source.storedObject.storageKey,
        source.storedObject.sha256,
        Number(source.storedObject.byteSize),
      );
    const generated = await input.prisma.generationArtifactV3Record.findFirst({
      where: { projectId, sha256 },
    });
    if (generated)
      return input.generatedStorage.resolveVerified(
        generated.storageKey,
        generated.sha256,
        Number(generated.byteSize),
      );
    throw new Error("CAPABILITY_V3_INPUT_NOT_MATERIALIZED");
  };
  const load = async (attemptId: string) => {
    const attempt = await input.prisma.generationAttemptV3Record.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) return null;
    const [consumption, snapshot] = await Promise.all([
      input.prisma.authorizationConsumptionV3Record.findUnique({
        where: { id: attempt.authorizationConsumptionId },
      }),
      input.prisma.materializedGraphSnapshotV3Record.findUnique({
        where: { materializedGraphSha256: attempt.materializedGraphSha256 },
      }),
    ]);
    if (!consumption || !snapshot || !attempt.providerTaskId) return null;
    const frozen = MaterializedGraphSnapshotV3Schema.parse(snapshot.payloadJson);
    return {
      attemptId: attempt.id,
      attemptState: attempt.state,
      authorizationConsumptionId: consumption.id,
      authorizationOperation: consumption.operation as "SUBMIT",
      authorizationAttemptId: consumption.attemptId,
      providerTaskId: attempt.providerTaskId,
      referencePlanDigest: frozen.referencePlanDigest,
      materializedGraphSha256: frozen.materializedGraphSha256,
      capabilityEnvelopeDigest: frozen.capabilityEnvelopeDigest,
      runtimeContractDigest: frozen.runtimeContractDigest,
      validationStatus: frozen.validation.status as "VALID",
      materializedGraph: frozen.materializedGraph,
      outputNodeId: frozen.outputNodeId,
      outputMediaKey: frozen.outputMediaKey,
      inputs: await Promise.all(
        frozen.stagedInputs.map(async (item) => ({
          localPath: await resolveInput(attempt.projectId, item.sha256),
          sha256: item.sha256,
          stagedInputName: item.stagedInputName,
        })),
      ),
    };
  };
  return {
    async loadForSubmission(identity) {
      return load(identity.attemptId);
    },
    loadSubmitted: load,
  };
}
