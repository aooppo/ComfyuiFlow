import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  WorkflowRegistrySchema,
  type WorkflowManifest,
  type WorkflowRegistry as WorkflowRegistryDocument,
} from "@comfyuiflow/contracts";
import { sha256Bytes } from "@comfyuiflow/spike-core";

export interface LoadedWorkflow {
  manifest: WorkflowManifest;
  workflow: Record<string, unknown>;
  actualHash: string;
  hashMatches: boolean;
  bindingErrors: string[];
  missingNodeClassesInWorkflow: string[];
}

export interface WorkflowBindingValues {
  character: string;
  scene: string;
  product?: string;
  characterFace?: string;
  characterRear?: string;
  positivePrompt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
}

function decodePointer(pointer: string): string[] {
  if (!pointer.startsWith("/")) throw new Error(`Invalid JSON Pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function resolvePointerParent(
  root: Record<string, unknown>,
  pointer: string,
): [Record<string, unknown>, string] {
  const parts = decodePointer(pointer);
  const key = parts.pop();
  if (!key) throw new Error(`JSON Pointer cannot target the root: ${pointer}`);
  let current: unknown = root;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      throw new Error(`JSON Pointer parent is not an object: ${pointer}`);
    }
    if (!(part in current)) throw new Error(`JSON Pointer path is missing: ${pointer}`);
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "object" || current === null || Array.isArray(current)) {
    throw new Error(`JSON Pointer parent is not an object: ${pointer}`);
  }
  if (!(key in current)) throw new Error(`JSON Pointer target is missing: ${pointer}`);
  return [current as Record<string, unknown>, key];
}

function validateBindingPointers(
  workflow: Record<string, unknown>,
  manifest: WorkflowManifest,
): string[] {
  const errors: string[] = [];
  for (const [name, binding] of Object.entries(manifest.bindings)) {
    if (!binding) continue;
    try {
      resolvePointerParent(workflow, binding.pointer);
    } catch (error) {
      errors.push(`${name}: ${(error as Error).message}`);
    }
  }
  return errors;
}

function workflowNodeClasses(workflow: Record<string, unknown>): Set<string> {
  const classes = new Set<string>();
  for (const value of Object.values(workflow)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const classType = (value as Record<string, unknown>).class_type;
    if (typeof classType === "string") classes.add(classType);
  }
  return classes;
}

export class WorkflowRegistry {
  constructor(readonly registryPath: string) {}

  private async document(): Promise<WorkflowRegistryDocument> {
    return WorkflowRegistrySchema.parse(JSON.parse(await readFile(this.registryPath, "utf8")));
  }

  async manifests(): Promise<WorkflowManifest[]> {
    return (await this.document()).workflows;
  }

  async load(workflowId: string): Promise<LoadedWorkflow> {
    const manifest = (await this.manifests()).find((item) => item.workflowId === workflowId);
    if (!manifest) throw new Error(`Workflow is not registered: ${workflowId}`);
    const registryRoot = await realpath(dirname(this.registryPath));
    const workflowPath = resolve(registryRoot, manifest.apiWorkflowPath);
    const traversal = relative(registryRoot, workflowPath);
    if (traversal.startsWith("..") || traversal.includes("../")) {
      throw new Error("Workflow path escapes registry root");
    }
    const bytes = await readFile(workflowPath);
    const workflow = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    const nodeClasses = workflowNodeClasses(workflow);
    return {
      manifest,
      workflow,
      actualHash: sha256Bytes(bytes),
      hashMatches: sha256Bytes(bytes) === manifest.sha256,
      bindingErrors: validateBindingPointers(workflow, manifest),
      missingNodeClassesInWorkflow: manifest.requiredNodeClasses.filter(
        (nodeClass) => !nodeClasses.has(nodeClass),
      ),
    };
  }

  async materialize(
    workflowId: string,
    expectedHash: string,
    values: WorkflowBindingValues,
  ): Promise<Record<string, unknown>> {
    const loaded = await this.load(workflowId);
    if (!loaded.manifest.enabled) throw new Error("Workflow is disabled");
    if (!loaded.hashMatches || loaded.actualHash !== expectedHash)
      throw new Error("Workflow hash drift");
    if (loaded.bindingErrors.length > 0) throw new Error("Workflow bindings are invalid");
    if (loaded.missingNodeClassesInWorkflow.length > 0) {
      throw new Error("Workflow manifest node classes do not match its graph");
    }
    const result = structuredClone(loaded.workflow);
    const entries: Array<[keyof WorkflowBindingValues, { pointer: string } | undefined]> = [
      ["character", loaded.manifest.bindings.character],
      ["scene", loaded.manifest.bindings.scene],
      ["product", loaded.manifest.bindings.product],
      ["characterFace", loaded.manifest.bindings.characterFace],
      ["characterRear", loaded.manifest.bindings.characterRear],
      ["positivePrompt", loaded.manifest.bindings.positivePrompt],
      ["durationSeconds", loaded.manifest.bindings.durationSeconds],
      ["width", loaded.manifest.bindings.width],
      ["height", loaded.manifest.bindings.height],
      ["fps", loaded.manifest.bindings.fps],
    ];
    for (const [name, binding] of entries) {
      if (!binding) continue;
      if (values[name] === undefined) throw new Error(`Workflow binding value is missing: ${name}`);
      const [parent, key] = resolvePointerParent(result, binding.pointer);
      parent[key] = values[name];
    }
    return result;
  }
}
