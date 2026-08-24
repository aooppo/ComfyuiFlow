import { WorkflowReadinessSchema, type WorkflowReadiness } from "@comfyuiflow/contracts";
import type { ComfyUiClient } from "./comfyui-client.js";
import type { WorkflowRegistry } from "./workflow-registry.js";

export async function checkWorkflowReadiness(
  client: ComfyUiClient,
  registry: WorkflowRegistry,
  workflowId: string,
): Promise<WorkflowReadiness> {
  const loaded = await registry.load(workflowId);
  const blockers: string[] = [];
  if (!loaded.manifest.enabled) blockers.push("WORKFLOW_DISABLED");
  if (!loaded.hashMatches) blockers.push("WORKFLOW_HASH_DRIFT");
  if (loaded.bindingErrors.length > 0) blockers.push("WORKFLOW_BINDINGS_INVALID");
  if (loaded.missingNodeClassesInWorkflow.length > 0) blockers.push("WORKFLOW_MANIFEST_MISMATCH");
  const comfyOrgCredentialConfigured = client.hasComfyOrgCredential();
  if (loaded.manifest.requiresComfyOrgAuth && !comfyOrgCredentialConfigured) {
    blockers.push("COMFY_ORG_CREDENTIAL_MISSING");
  }

  let stats: Record<string, unknown> | undefined;
  let objectInfo: Record<string, unknown> = {};
  try {
    stats = await client.getSystemStats();
    objectInfo = await client.getObjectInfo();
  } catch {
    blockers.push("COMFYUI_UNREACHABLE");
    return WorkflowReadinessSchema.parse({
      workflowId,
      ready: false,
      endpointReachable: false,
      workflowHashMatches: loaded.hashMatches,
      missingNodeClasses: loaded.manifest.requiredNodeClasses,
      missingModels: loaded.manifest.requiredModels.map(
        (model) => `${model.folder}/${model.filename}`,
      ),
      bindingErrors: loaded.bindingErrors,
      blockers: [...new Set(blockers)],
      comfyOrgCredentialConfigured,
      generationCalls: 0,
    });
  }

  const missingNodeClasses = loaded.manifest.requiredNodeClasses.filter(
    (nodeClass) => !(nodeClass in objectInfo),
  );
  if (missingNodeClasses.length > 0) blockers.push("NODE_CLASSES_MISSING");

  const missingModels: string[] = [];
  const grouped = new Map<string, typeof loaded.manifest.requiredModels>();
  for (const model of loaded.manifest.requiredModels) {
    grouped.set(model.folder, [...(grouped.get(model.folder) ?? []), model]);
  }
  for (const [folder, models] of grouped) {
    let available: string[] = [];
    try {
      available = await client.listModels(folder);
    } catch {
      blockers.push(`MODEL_INVENTORY_UNAVAILABLE:${folder}`);
    }
    for (const model of models) {
      if (!available.includes(model.filename)) missingModels.push(`${folder}/${model.filename}`);
    }
  }
  if (missingModels.length > 0) blockers.push("MODELS_MISSING");

  return WorkflowReadinessSchema.parse({
    workflowId,
    ready: blockers.length === 0,
    endpointReachable: true,
    workflowHashMatches: loaded.hashMatches,
    missingNodeClasses,
    missingModels,
    bindingErrors: loaded.bindingErrors,
    blockers: [...new Set(blockers)],
    comfyOrgCredentialConfigured,
    serverFacts: { system: stats.system ?? {} },
    generationCalls: 0,
  });
}
