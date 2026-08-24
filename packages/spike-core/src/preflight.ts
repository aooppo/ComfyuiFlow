import { randomUUID } from "node:crypto";
import {
  ShotSpecificationSchema,
  SpikeRequestSchema,
  type WorkflowManifest,
  type WorkflowReadiness,
} from "@comfyuiflow/contracts";
import { ingestSpikeAssets } from "./assets.js";
import { hashCanonical } from "./integrity.js";

export interface DryRunDependencies {
  dataRoot: string;
  registry: {
    load(workflowId: string): Promise<{
      manifest: WorkflowManifest;
      actualHash: string;
    }>;
  };
  readiness(workflowId: string): Promise<WorkflowReadiness>;
  directorReadiness?(): Promise<{ configured: boolean; reason?: string }>;
}

export class DuplicateInputAssetsError extends Error {
  readonly code = "DUPLICATE_INPUT_ASSETS";
  readonly providerCalls = 0;

  constructor() {
    super("All reference inputs must have distinct SHA-256 values");
    this.name = "DuplicateInputAssetsError";
  }
}

export async function createDryRun(requestValue: unknown, dependencies: DryRunDependencies) {
  const request = SpikeRequestSchema.parse(requestValue);
  const assets = await ingestSpikeAssets(
    request.characterImage,
    request.sceneImage,
    dependencies.dataRoot,
    request.additionalReferenceImages,
  );
  if (new Set(assets.map((asset) => asset.sha256)).size !== assets.length) {
    throw new DuplicateInputAssetsError();
  }
  const loaded = await dependencies.registry.load(request.workflowId);
  const assetRoles = new Set(assets.map((asset) => asset.role));
  const requiredAdditionalRoles = [
    ["product", "PRODUCT"],
    ["characterFace", "CHARACTER_FACE"],
    ["characterRear", "CHARACTER_REAR"],
  ] as const;
  for (const [binding, role] of requiredAdditionalRoles) {
    if (loaded.manifest.bindings[binding] && !assetRoles.has(role)) {
      throw new Error(`Workflow requires ${role} reference input`);
    }
  }
  const readiness = await dependencies.readiness(request.workflowId);
  const directorReadiness = dependencies.directorReadiness
    ? await dependencies.directorReadiness()
    : { configured: false, reason: "Director readiness was not checked" };
  const shotPreview = ShotSpecificationSchema.parse({
    id: randomUUID(),
    schemaVersion: "1.0.0",
    promptTemplateVersion: "director-one-shot-v1",
    creativeDescription: request.creativeDescription,
    startState: "Character and scene match the supplied reference images.",
    action: request.creativeDescription,
    endState: "The action resolves while character and scene identity remain stable.",
    camera: "Single continuous medium shot; no cut.",
    composition: "Keep the main character legible within the supplied scene.",
    continuityRequirements: [
      "Preserve character identity and wardrobe.",
      "Preserve scene layout and lighting direction.",
    ],
    durationSeconds: loaded.manifest.constraints.durationSeconds.default,
    directorRunId: randomUUID(),
  });
  const scope = {
    assetHashes: assets.map((asset) => ({ role: asset.role, sha256: asset.sha256 })),
    creativeDescription: request.creativeDescription,
    ...(request.generationPrompt ? { generationPrompt: request.generationPrompt } : {}),
    directorProvider: "codexmanager-local",
    directorModel: "gpt-5.4",
    promptTemplateVersion: "director-one-shot-v1",
    workflowId: loaded.manifest.workflowId,
    workflowSha256: loaded.actualHash,
  };
  return {
    mode: "DRY_RUN" as const,
    providerCalls: 0 as const,
    assets,
    director: {
      providerId: "codexmanager-local",
      modelId: "gpt-5.4",
      destination: "loopback-local",
      promptTemplateVersion: "director-one-shot-v1",
      responseSchema: "ShotSpecification@1.0.0",
      readiness: directorReadiness,
    },
    shotPreview,
    generationPrompt: request.generationPrompt,
    workflow: {
      workflowId: loaded.manifest.workflowId,
      version: loaded.manifest.version,
      sha256: loaded.actualHash,
      constraints: loaded.manifest.constraints,
    },
    readiness,
    authorizationScope: scope,
    scopeHash: hashCanonical(scope),
    expectedInvocation: {
      transport: "MCP stdio",
      tool: "comfyui_submit_workflow",
      target: { workflowId: loaded.manifest.workflowId, workflowSha256: loaded.actualHash },
      maxDirectorCalls: 1,
      maxGenerationSubmissions: 1,
    },
  };
}
