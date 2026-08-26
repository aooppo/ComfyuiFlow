import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { hashCanonical } from "@comfyuiflow/spike-core";
import type { NormalizedNodeCatalog, NormalizedNodeInput } from "./node-catalog.js";

export interface GraphValidationResult {
  valid: boolean;
  graphSha256: string;
  errors: string[];
  nodeCount: number;
  edgeCount: number;
  generationCalls: 0;
}

export interface TrustedGraphFile {
  path: string;
  bytes: Uint8Array;
  graph: Record<string, unknown>;
}

function within(root: string, candidate: string): boolean {
  const traversal = relative(root, candidate);
  return traversal === "" || (!traversal.startsWith("..") && !traversal.includes("../"));
}

export async function loadTrustedGraphFile(
  registryPath: string,
  relativePath: string,
): Promise<TrustedGraphFile> {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\0")) {
    throw new Error("WORKFLOW_PATH_INVALID");
  }
  const registryRoot = await realpath(dirname(registryPath));
  const lexicalPath = resolve(registryRoot, relativePath);
  if (!within(registryRoot, lexicalPath)) throw new Error("WORKFLOW_PATH_ESCAPE");
  const facts = await lstat(lexicalPath);
  if (!facts.isFile() || facts.isSymbolicLink()) throw new Error("WORKFLOW_PATH_UNTRUSTED");
  const trustedPath = await realpath(lexicalPath);
  if (!within(registryRoot, trustedPath)) throw new Error("WORKFLOW_SYMLINK_ESCAPE");
  const bytes = await readFile(trustedPath);
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("WORKFLOW_GRAPH_INVALID");
  return { path: trustedPath, bytes, graph: parsed as Record<string, unknown> };
}

function fieldAcceptsLiteral(field: NormalizedNodeInput, value: unknown): boolean {
  if (field.options) return field.options.some((option) => Object.is(option, value));
  switch (field.type) {
    case "INT":
      return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        (field.minimum === undefined || value >= field.minimum) &&
        (field.maximum === undefined || value <= field.maximum)
      );
    case "FLOAT":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (field.minimum === undefined || value >= field.minimum) &&
        (field.maximum === undefined || value <= field.maximum)
      );
    case "BOOLEAN":
      return typeof value === "boolean";
    case "STRING":
    case "IMAGE":
    case "VIDEO":
    case "AUDIO":
      return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 12_000 &&
        !value.includes("\0")
      );
    default:
      return ["string", "number", "boolean"].includes(typeof value);
  }
}

function unsafeExecutableField(name: string, value: unknown): boolean {
  if (
    /(?:secret|token|password|credential|api[_-]?key|endpoint|command|shell|script|download|url)/i.test(
      name,
    )
  )
    return true;
  if (typeof value !== "string") return false;
  if (/^(?:https?:|file:|ssh:|ftp:|\/|~\/)/i.test(value.trim())) return true;
  return value.includes("\0") || value.split(/[\\/]/).includes("..");
}

function isLink(value: unknown): value is [string | number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    ["string", "number"].includes(typeof value[0]) &&
    Number.isSafeInteger(value[1]) &&
    value[1] >= 0
  );
}

export function validateComfyUiGraph(
  graph: Record<string, unknown>,
  catalog: NormalizedNodeCatalog,
  options: { outputNodeId: string; maximumNodes?: number },
): GraphValidationResult {
  const errors: string[] = [];
  const nodeIds = Object.keys(graph).sort();
  const maximumNodes = options.maximumNodes ?? 250;
  if (nodeIds.length === 0 || nodeIds.length > maximumNodes) errors.push("GRAPH_SIZE_INVALID");
  if (!Object.hasOwn(graph, options.outputNodeId)) errors.push("OUTPUT_NODE_MISSING");
  const catalogByClass = new Map(catalog.nodes.map((node) => [node.className, node]));
  const edges: Array<[string, string]> = [];
  for (const nodeId of nodeIds) {
    const raw = graph[nodeId];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`NODE_INVALID:${nodeId}`);
      continue;
    }
    const node = raw as Record<string, unknown>;
    const className = typeof node.class_type === "string" ? node.class_type : "";
    const nodeInfo = catalogByClass.get(className);
    if (!nodeInfo) {
      errors.push(`NODE_CLASS_NOT_ALLOWED:${nodeId}`);
      continue;
    }
    const inputs =
      node.inputs && typeof node.inputs === "object" && !Array.isArray(node.inputs)
        ? (node.inputs as Record<string, unknown>)
        : {};
    const fields = new Map(nodeInfo.inputs.map((field) => [field.name, field]));
    for (const required of nodeInfo.inputs.filter((field) => field.required)) {
      if (!Object.hasOwn(inputs, required.name))
        errors.push(`REQUIRED_INPUT_MISSING:${nodeId}:${required.name}`);
    }
    for (const [name, value] of Object.entries(inputs)) {
      const field = fields.get(name);
      if (!field) {
        errors.push(`INPUT_FIELD_NOT_ALLOWED:${nodeId}:${name}`);
        continue;
      }
      if (unsafeExecutableField(name, value)) {
        errors.push(`UNSAFE_INPUT_LITERAL:${nodeId}:${name}`);
        continue;
      }
      if (isLink(value)) {
        const sourceId = String(value[0]);
        const source = graph[sourceId] as Record<string, unknown> | undefined;
        if (!source || typeof source !== "object") {
          errors.push(`EDGE_SOURCE_MISSING:${nodeId}:${name}`);
          continue;
        }
        const sourceInfo = catalogByClass.get(String(source.class_type));
        if (!sourceInfo || value[1] >= sourceInfo.outputs.length)
          errors.push(`EDGE_OUTPUT_INVALID:${nodeId}:${name}`);
        else {
          const sourceType = sourceInfo.outputs[value[1]];
          const targetType = field.type.toUpperCase();
          if (
            sourceType &&
            targetType !== "UNKNOWN" &&
            targetType !== "COMBO" &&
            !targetType.startsWith("COMFY_") &&
            sourceType !== targetType
          )
            errors.push(`EDGE_TYPE_INVALID:${nodeId}:${name}`);
          else edges.push([sourceId, nodeId]);
        }
      } else if (!fieldAcceptsLiteral(field, value)) {
        errors.push(`INPUT_TYPE_INVALID:${nodeId}:${name}`);
      }
    }
  }
  const incoming = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const [source, target] of edges) {
    incoming.set(target, (incoming.get(target) ?? 0) + 1);
    outgoing.get(source)?.push(target);
  }
  const queue = nodeIds.filter((id) => incoming.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const current = queue.shift()!;
    visited += 1;
    for (const target of outgoing.get(current) ?? []) {
      incoming.set(target, (incoming.get(target) ?? 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  if (visited !== nodeIds.length) errors.push("GRAPH_CYCLE");
  if (Object.hasOwn(graph, options.outputNodeId)) {
    const reachable = new Set([options.outputNodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [source, target] of edges) {
        if (reachable.has(target) && !reachable.has(source)) {
          reachable.add(source);
          changed = true;
        }
      }
    }
    for (const nodeId of nodeIds) if (!reachable.has(nodeId)) errors.push(`ORPHAN_NODE:${nodeId}`);
  }
  return {
    valid: errors.length === 0,
    graphSha256: hashCanonical({
      graph,
      catalogSha256: catalog.catalogSha256,
      validatorVersion: "comfyui-graph-validator-v1",
    }),
    errors: [...new Set(errors)],
    nodeCount: nodeIds.length,
    edgeCount: edges.length,
    generationCalls: 0,
  };
}

export function deriveSafeOutputPrefix(
  projectId: string,
  executionPlanId: string,
  ordinal: number,
): string {
  const safe = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 36);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 20)
    throw new Error("OUTPUT_PREFIX_INVALID");
  const prefix = `comfyuiflow/${safe(projectId)}/${safe(executionPlanId)}/shot-${String(ordinal).padStart(2, "0")}`;
  if (prefix.includes("..") || prefix.startsWith("/") || prefix.length > 140)
    throw new Error("OUTPUT_PREFIX_INVALID");
  return prefix;
}
