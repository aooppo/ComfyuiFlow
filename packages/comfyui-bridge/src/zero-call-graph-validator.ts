import { hashCanonical } from "@comfyuiflow/spike-core";
import type { NormalizedNodeCatalog, NormalizedNodeInput } from "./node-catalog.js";

export const zeroCallGraphValidatorIdentity = {
  ref: "comfyuiflow-zero-call-graph-validator",
  version: "1.0.0",
} as const;

export interface GraphValidationDiagnostic {
  code: string;
  message: string;
  path?: string;
}

export interface ZeroCallGraphValidationResult {
  valid: boolean;
  graphSha256: string;
  diagnostics: GraphValidationDiagnostic[];
  nodeCount: number;
  edgeCount: number;
  generationCalls: 0;
}

const unsafeFieldName =
  /(?:secret|token|password|credential|api[_-]?key|endpoint|command|shell|script|download|url|path|directory|folder)/i;
const safeGraphKey = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/;

function diagnostic(code: string, message: string, path?: string): GraphValidationDiagnostic {
  return { code, message, ...(path ? { path } : {}) };
}

function acceptsLiteral(field: NormalizedNodeInput, value: unknown): boolean {
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

function unsafeLiteral(field: string, value: unknown): boolean {
  if (unsafeFieldName.test(field)) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    /^(?:https?:|file:|ssh:|ftp:|\/|~\/)/i.test(trimmed) ||
    trimmed.includes("\0") ||
    trimmed.split(/[\\/]/).includes("..")
  );
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

function compatible(sourceType: string, targetType: string): boolean {
  return (
    sourceType === targetType ||
    targetType === "UNKNOWN" ||
    targetType === "COMBO" ||
    targetType.startsWith("COMFY_")
  );
}

/** Validates a server-loaded frozen Comfy graph without staging or submitting anything. */
export function validateZeroCallComfyUiGraph(
  graph: Readonly<Record<string, unknown>>,
  catalog: NormalizedNodeCatalog,
  options: {
    expectedGraphSha256: string;
    outputNodeId: string;
    outputMediaKey: string;
    maximumNodes?: number;
  },
): ZeroCallGraphValidationResult {
  const diagnostics: GraphValidationDiagnostic[] = [];
  const nodeIds = Object.keys(graph).sort();
  const maximumNodes = options.maximumNodes ?? 250;
  const actualGraphSha256 = hashCanonical(graph);
  if (actualGraphSha256 !== options.expectedGraphSha256)
    diagnostics.push(
      diagnostic("GRAPH_SHA_MISMATCH", "Frozen graph digest does not match its snapshot."),
    );
  if (!safeGraphKey.test(options.outputNodeId) || !Object.hasOwn(graph, options.outputNodeId))
    diagnostics.push(
      diagnostic(
        "OUTPUT_NODE_MISSING",
        "Declared output node is not present.",
        options.outputNodeId,
      ),
    );
  if (!safeGraphKey.test(options.outputMediaKey))
    diagnostics.push(
      diagnostic("OUTPUT_MEDIA_KEY_INVALID", "Declared output media key is invalid."),
    );
  if (nodeIds.length === 0 || nodeIds.length > maximumNodes)
    diagnostics.push(diagnostic("GRAPH_SIZE_INVALID", "Graph has an invalid number of nodes."));

  const catalogByClass = new Map(catalog.nodes.map((node) => [node.className, node]));
  if (Object.hasOwn(graph, options.outputNodeId)) {
    const output = graph[options.outputNodeId];
    const outputClass =
      output && typeof output === "object" && !Array.isArray(output)
        ? (output as Record<string, unknown>).class_type
        : undefined;
    const outputInfo = catalogByClass.get(typeof outputClass === "string" ? outputClass : "");
    if (!outputInfo?.isOutputNode)
      diagnostics.push(
        diagnostic(
          "OUTPUT_NODE_NOT_DECLARED",
          "Declared output node is not marked as an output node by the runtime.",
          options.outputNodeId,
        ),
      );
  }
  const edges: Array<[string, string]> = [];
  for (const nodeId of nodeIds) {
    const rawNode = graph[nodeId];
    if (!rawNode || typeof rawNode !== "object" || Array.isArray(rawNode)) {
      diagnostics.push(diagnostic("NODE_INVALID", "Node is not an object.", nodeId));
      continue;
    }
    const node = rawNode as Record<string, unknown>;
    const className = typeof node.class_type === "string" ? node.class_type : "";
    const nodeInfo = catalogByClass.get(className);
    if (!nodeInfo) {
      diagnostics.push(
        diagnostic(
          "NODE_CLASS_NOT_ALLOWED",
          "Node class is unavailable or not in the contract.",
          nodeId,
        ),
      );
      continue;
    }
    const inputs =
      node.inputs && typeof node.inputs === "object" && !Array.isArray(node.inputs)
        ? (node.inputs as Record<string, unknown>)
        : {};
    const fields = new Map(nodeInfo.inputs.map((field) => [field.name, field]));
    for (const field of nodeInfo.inputs.filter((item) => item.required))
      if (!Object.hasOwn(inputs, field.name))
        diagnostics.push(
          diagnostic(
            "REQUIRED_INPUT_MISSING",
            "Required node input is missing.",
            `${nodeId}.${field.name}`,
          ),
        );
    for (const [name, value] of Object.entries(inputs)) {
      const field = fields.get(name);
      const path = `${nodeId}.${name}`;
      if (!field) {
        diagnostics.push(
          diagnostic(
            "INPUT_FIELD_NOT_ALLOWED",
            "Input is not declared by the runtime node schema.",
            path,
          ),
        );
        continue;
      }
      if (unsafeLiteral(name, value)) {
        diagnostics.push(
          diagnostic(
            "UNSAFE_INPUT_LITERAL",
            "Input contains a disallowed executable or location value.",
            path,
          ),
        );
        continue;
      }
      if (!isLink(value)) {
        if (!acceptsLiteral(field, value))
          diagnostics.push(
            diagnostic(
              "INPUT_TYPE_INVALID",
              "Input literal does not satisfy the runtime schema.",
              path,
            ),
          );
        continue;
      }
      const sourceId = String(value[0]);
      const source = graph[sourceId];
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        diagnostics.push(diagnostic("EDGE_SOURCE_MISSING", "Input link source is missing.", path));
        continue;
      }
      const sourceClass = (source as Record<string, unknown>).class_type;
      const sourceInfo = catalogByClass.get(typeof sourceClass === "string" ? sourceClass : "");
      if (!sourceInfo || value[1] >= sourceInfo.outputs.length) {
        diagnostics.push(
          diagnostic("EDGE_OUTPUT_INVALID", "Input link output is unavailable.", path),
        );
        continue;
      }
      if (!compatible(sourceInfo.outputs[value[1]]!, field.type.toUpperCase()))
        diagnostics.push(diagnostic("EDGE_TYPE_INVALID", "Input link type is incompatible.", path));
      else edges.push([sourceId, nodeId]);
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
  if (visited !== nodeIds.length)
    diagnostics.push(diagnostic("GRAPH_CYCLE", "Graph contains a cycle."));
  if (Object.hasOwn(graph, options.outputNodeId)) {
    const reachable = new Set([options.outputNodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [source, target] of edges)
        if (reachable.has(target) && !reachable.has(source)) {
          reachable.add(source);
          changed = true;
        }
    }
    for (const nodeId of nodeIds)
      if (!reachable.has(nodeId))
        diagnostics.push(
          diagnostic("ORPHAN_NODE", "Node does not contribute to the declared output.", nodeId),
        );
  }
  const unique = [
    ...new Map(diagnostics.map((item) => [`${item.code}:${item.path ?? ""}`, item])).values(),
  ];
  return {
    valid: unique.length === 0,
    graphSha256: actualGraphSha256,
    diagnostics: unique,
    nodeCount: nodeIds.length,
    edgeCount: edges.length,
    generationCalls: 0,
  };
}
