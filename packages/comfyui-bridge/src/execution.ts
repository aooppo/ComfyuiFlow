import { basename, join, relative, resolve } from "node:path";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import type { ArtifactReference } from "@comfyuiflow/contracts";
import { hashCanonical, sha256Bytes, sha256File } from "@comfyuiflow/spike-core";
import type { AuthorizationService } from "@comfyuiflow/spike-core";
import { ComfyUiHttpError } from "./comfyui-client.js";
import type { ComfyUiClient, StagedInput, SubmitResult } from "./comfyui-client.js";
import type { WorkflowRegistry } from "./workflow-registry.js";

export class AmbiguousSubmissionError extends Error {
  constructor(
    message: string,
    readonly promptId: string,
  ) {
    super(message);
    this.name = "AmbiguousSubmissionError";
  }
}

export interface StagedInputEvidence extends StagedInput {
  sourceSha256: string;
  role: "character" | "scene" | "product" | "characterFace" | "characterRear";
}

export interface FrozenStagedInputEvidence extends StagedInput {
  sourceSha256: string;
}

export interface GenerationSubmission {
  workflowId: string;
  workflowSha256: string;
  promptId: string;
  runId: string;
  character: StagedInputEvidence;
  scene: StagedInputEvidence;
  product?: StagedInputEvidence;
  characterFace?: StagedInputEvidence;
  characterRear?: StagedInputEvidence;
  shot: {
    positivePrompt: string;
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    outputPrefix?: string;
  };
  authorizationScope?: Record<string, unknown>;
}

export interface AuthorizedGenerationSubmission extends GenerationSubmission {
  grantId: string;
}

export function generationScopeHash(
  input: GenerationSubmission | AuthorizedGenerationSubmission,
): string {
  if (input.authorizationScope) return hashCanonical(input.authorizationScope);
  const scope = { ...input } as Partial<AuthorizedGenerationSubmission>;
  delete scope.grantId;
  return hashCanonical(scope);
}

function stagedName(input: StagedInputEvidence): string {
  return input.subfolder ? `${input.subfolder}/${input.name}` : input.name;
}

export class ComfyUiExecutionService {
  constructor(
    private readonly dependencies: {
      client: ComfyUiClient;
      registry: WorkflowRegistry;
      authorization: AuthorizationService;
      dataRoot: string;
      liveEnabled: boolean;
      allowedInputRoots?: string[];
    },
  ) {}

  assertLiveEnabled(): void {
    if (!this.dependencies.liveEnabled) throw new Error("ComfyUI LIVE is disabled");
  }

  async stageInput(input: {
    workflowId: string;
    role: "character" | "scene" | "product" | "characterFace" | "characterRear";
    localPath: string;
    expectedSha256: string;
  }): Promise<StagedInputEvidence> {
    const loaded = await this.dependencies.registry.load(input.workflowId);
    if (!loaded.manifest.enabled) throw new Error("Workflow is disabled");
    return {
      ...(await this.stageVerifiedInput(input)),
      role: input.role,
    };
  }

  async stageFrozenInput(input: {
    localPath: string;
    expectedSha256: string;
    expectedStagedInputName: string;
  }): Promise<FrozenStagedInputEvidence> {
    const staged = await this.stageVerifiedInput(input);
    const stagedName = staged.subfolder ? `${staged.subfolder}/${staged.name}` : staged.name;
    if (stagedName !== input.expectedStagedInputName)
      throw new Error("FROZEN_STAGED_INPUT_NAME_MISMATCH");
    return staged;
  }

  private async stageVerifiedInput(input: {
    localPath: string;
    expectedSha256: string;
  }): Promise<FrozenStagedInputEvidence> {
    const localPath = await realpath(input.localPath);
    const configuredRoots = [
      join(this.dependencies.dataRoot, "inputs"),
      ...(this.dependencies.allowedInputRoots ?? []),
    ];
    const roots = (await Promise.allSettled(configuredRoots.map((root) => realpath(root)))).flatMap(
      (result) => (result.status === "fulfilled" ? [result.value] : []),
    );
    const allowed = roots.some((root) => {
      const traversal = relative(root, localPath);
      return traversal === "" || (!traversal.startsWith("..") && !traversal.includes("../"));
    });
    if (!allowed) {
      throw new Error("Input path is outside the immutable input root");
    }
    const actualHash = await sha256File(localPath);
    if (actualHash !== input.expectedSha256) throw new Error("Input hash mismatch");
    return {
      ...(await this.dependencies.client.stageInput(localPath)),
      sourceSha256: actualHash,
    };
  }

  async submitFrozenGraph(input: {
    promptId: string;
    materializedGraph: Record<string, unknown>;
    materializedGraphSha256: string;
  }): Promise<SubmitResult> {
    this.assertLiveEnabled();
    if (hashCanonical(input.materializedGraph) !== input.materializedGraphSha256)
      throw new Error("FROZEN_GRAPH_DIGEST_MISMATCH");
    try {
      return await this.dependencies.client.submitWorkflow(input.promptId, input.materializedGraph);
    } catch (error) {
      if (error instanceof ComfyUiHttpError && error.classification === "TRANSPORT")
        throw new AmbiguousSubmissionError(
          `ComfyUI submission outcome is ambiguous for prompt ${input.promptId}`,
          input.promptId,
        );
      throw error;
    }
  }

  async submit(input: AuthorizedGenerationSubmission): Promise<SubmitResult> {
    return this.submitInternal(input, true);
  }

  async submitPreauthorized(input: GenerationSubmission): Promise<SubmitResult> {
    return this.submitInternal({ ...input, grantId: "project-preauthorized" }, false);
  }

  private async submitInternal(
    input: AuthorizedGenerationSubmission,
    consumeFileGrant: boolean,
  ): Promise<SubmitResult> {
    this.assertLiveEnabled();
    const loaded = await this.dependencies.registry.load(input.workflowId);
    if (loaded.manifest.requiresComfyOrgAuth && !this.dependencies.client.hasComfyOrgCredential()) {
      throw new Error("Comfy Partner Node credential is missing");
    }
    if (input.authorizationScope) {
      const scope = input.authorizationScope;
      if (scope.workflowId !== input.workflowId || scope.workflowSha256 !== input.workflowSha256) {
        throw new Error("Authorization scope does not match the selected workflow");
      }
      const assetHashes = Array.isArray(scope.assetHashes) ? scope.assetHashes : [];
      const expected = new Set(
        assetHashes
          .filter(
            (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
          )
          .map((item) => `${item.role}:${item.sha256}`),
      );
      const stagedReferences = [
        ["CHARACTER", input.character],
        ["SCENE", input.scene],
        ["PRODUCT", input.product],
        ["CHARACTER_FACE", input.characterFace],
        ["CHARACTER_REAR", input.characterRear],
      ] as const;
      if (
        stagedReferences.some(
          ([role, reference]) =>
            reference !== undefined && !expected.has(`${role}:${reference.sourceSha256}`),
        )
      ) {
        throw new Error("Authorization scope does not match the staged inputs");
      }
    }
    const constraints = loaded.manifest.constraints;
    if (
      input.shot.durationSeconds < constraints.durationSeconds.min ||
      input.shot.durationSeconds > constraints.durationSeconds.max ||
      input.shot.width !== constraints.width ||
      input.shot.height !== constraints.height ||
      input.shot.fps !== constraints.fps
    ) {
      throw new Error("Generation settings violate workflow constraints");
    }
    const workflow = await this.dependencies.registry.materialize(
      input.workflowId,
      input.workflowSha256,
      {
        character: stagedName(input.character),
        scene: stagedName(input.scene),
        ...(input.product ? { product: stagedName(input.product) } : {}),
        ...(input.characterFace ? { characterFace: stagedName(input.characterFace) } : {}),
        ...(input.characterRear ? { characterRear: stagedName(input.characterRear) } : {}),
        positivePrompt: input.shot.positivePrompt,
        durationSeconds: input.shot.durationSeconds,
        width: input.shot.width,
        height: input.shot.height,
        fps: input.shot.fps,
        ...(input.shot.outputPrefix ? { outputPrefix: input.shot.outputPrefix } : {}),
      },
    );
    const scopeHash = generationScopeHash(input);
    const requestHash = hashCanonical({ promptId: input.promptId, workflow });
    if (consumeFileGrant)
      await this.dependencies.authorization.consumeGrant({
        grantId: input.grantId,
        runId: input.runId,
        operation: "COMFYUI_SUBMIT",
        scopeHash,
        requestHash,
      });
    try {
      return await this.dependencies.client.submitWorkflow(input.promptId, workflow);
    } catch (error) {
      if (error instanceof ComfyUiHttpError && error.classification === "TRANSPORT") {
        throw new AmbiguousSubmissionError(
          `ComfyUI submission outcome is ambiguous for prompt ${input.promptId}`,
          input.promptId,
        );
      }
      throw error;
    }
  }

  status(promptId: string) {
    return this.dependencies.client.getJobStatus(promptId);
  }

  cancel(promptId: string) {
    return this.dependencies.client.cancelJob(promptId);
  }

  async retainArtifacts(input: { promptId: string; runId: string; workflowId: string }) {
    const status = await this.status(input.promptId);
    if (status.status !== "COMPLETED") throw new Error("Artifacts require a completed job");
    const loaded = await this.dependencies.registry.load(input.workflowId);
    const references = status.artifacts.filter(
      (item) =>
        item.nodeId === loaded.manifest.output.nodeId &&
        item.mediaKey === loaded.manifest.output.mediaKey,
    );
    if (references.length === 0) throw new Error("Registered workflow output artifact is missing");
    const directory = resolve(this.dependencies.dataRoot, "artifacts", input.runId);
    await mkdir(directory, { recursive: true });
    return Promise.all(
      references.map(async (reference: ArtifactReference) => {
        const response = await this.dependencies.client.downloadArtifact(reference);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) throw new Error("Artifact is empty");
        const path = join(directory, `${input.promptId}-${basename(reference.filename)}`);
        await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
        return {
          path,
          sha256: sha256Bytes(bytes),
          byteSize: bytes.byteLength,
          mimeType: response.headers.get("content-type") ?? "application/octet-stream",
          sourceReference: reference,
        };
      }),
    );
  }

  async retainFrozenArtifacts(input: {
    promptId: string;
    runId: string;
    outputNodeId: string;
    outputMediaKey: string;
  }) {
    const status = await this.status(input.promptId);
    if (status.status !== "COMPLETED") throw new Error("Artifacts require a completed job");
    const references = status.artifacts.filter(
      (item) => item.nodeId === input.outputNodeId && item.mediaKey === input.outputMediaKey,
    );
    if (references.length === 0) throw new Error("Frozen graph output artifact is missing");
    const directory = resolve(this.dependencies.dataRoot, "artifacts", input.runId);
    await mkdir(directory, { recursive: true });
    return Promise.all(
      references.map(async (reference: ArtifactReference) => {
        const response = await this.dependencies.client.downloadArtifact(reference);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) throw new Error("Artifact is empty");
        const path = join(directory, `${input.promptId}-${basename(reference.filename)}`);
        await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
        return {
          path,
          sha256: sha256Bytes(bytes),
          byteSize: bytes.byteLength,
          mimeType: response.headers.get("content-type") ?? "application/octet-stream",
          sourceReference: reference,
        };
      }),
    );
  }
}
