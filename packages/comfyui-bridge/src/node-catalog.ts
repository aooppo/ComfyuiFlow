import { hashCanonical } from "@comfyuiflow/spike-core";
import type { ComfyUiClient } from "./comfyui-client.js";

export interface NormalizedNodeInput {
  name: string;
  required: boolean;
  type: string;
  options?: Array<string | number | boolean>;
  minimum?: number;
  maximum?: number;
  /** Safe, bounded fields activated by a selected Comfy dynamic-combo option. */
  dynamicOptions?: Array<{
    key: string | number | boolean;
    inputs: NormalizedNodeInput[];
  }>;
}

export interface NormalizedNodeInfo {
  className: string;
  isOutputNode: boolean;
  inputs: NormalizedNodeInput[];
  outputs: string[];
}

export interface NormalizedNodeCatalog {
  schemaVersion: "comfyui-node-catalog-v1";
  requestedNodeClasses: string[];
  nodes: NormalizedNodeInfo[];
  sourceSha256: string;
  catalogSha256: string;
}

const safeNodeClass = /^[A-Za-z][A-Za-z0-9_.-]{0,159}$/;
const unsafeMetadataKey =
  /(secret|token|password|credential|api[_-]?key|endpoint|base[_-]?url|path|directory|folder)/i;

function scalarOptions(value: unknown): Array<string | number | boolean> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const values = value.filter(
    (item): item is string | number | boolean =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  );
  return values.length === value.length && values.length <= 200 ? values : undefined;
}

function normalizedType(value: unknown): {
  type: string;
  options?: Array<string | number | boolean>;
} {
  if (typeof value === "string") return { type: value.toUpperCase() };
  const options = scalarOptions(value);
  if (options) return { type: "COMBO", options };
  return { type: "UNKNOWN" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputMetadata(rawDefinition: unknown) {
  const tuple = Array.isArray(rawDefinition) ? rawDefinition : [rawDefinition];
  return {
    tuple,
    metadata: isRecord(tuple[1]) ? tuple[1] : {},
  };
}

function normalizedDynamicInputs(
  value: unknown,
  required: boolean,
  prefix = "",
): NormalizedNodeInput[] {
  if (!isRecord(value)) return [];
  const result: NormalizedNodeInput[] = [];
  for (const [name, rawDefinition] of Object.entries(value).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!safeNodeClass.test(name) || unsafeMetadataKey.test(name)) continue;
    const { tuple, metadata } = inputMetadata(rawDefinition);
    const fullName = prefix ? `${prefix}.${name}` : name;
    const type = normalizedType(tuple[0]);
    const template = isRecord(metadata.template) ? metadata.template : null;
    const templateInput = template && isRecord(template.input) ? template.input : null;
    const names = Array.isArray(template?.names)
      ? template.names.filter(
          (item): item is string => typeof item === "string" && safeNodeClass.test(item),
        )
      : [];
    if (type.type.startsWith("COMFY_AUTOGROW") && names.length && templateInput) {
      const templateFields = [
        ...normalizedDynamicInputs(templateInput.required, true),
        ...normalizedDynamicInputs(templateInput.optional, false),
      ];
      for (const item of names) {
        result.push(
          ...templateFields.map((field) => ({
            ...field,
            required:
              typeof template?.min === "number" && template.min > 0 ? field.required : false,
            name:
              templateFields.length === 1
                ? `${fullName}.${item}`
                : `${fullName}.${item}.${field.name}`,
          })),
        );
      }
      continue;
    }
    result.push({ name: fullName, required, ...type, ...limits(metadata) });
  }
  return result;
}

function dynamicOptions(rawDefinition: unknown) {
  const { metadata } = inputMetadata(rawDefinition);
  const options = Array.isArray(metadata.options) ? metadata.options : [];
  const normalized = options.flatMap((option) => {
    if (!isRecord(option) || !["string", "number", "boolean"].includes(typeof option.key))
      return [];
    const inputs = isRecord(option.inputs) ? option.inputs : null;
    if (!inputs) return [];
    return [
      {
        key: option.key as string | number | boolean,
        inputs: [
          ...normalizedDynamicInputs(inputs.required, true),
          ...normalizedDynamicInputs(inputs.optional, false),
        ],
      },
    ];
  });
  return normalized.length > 0 && normalized.length <= 100 ? normalized : undefined;
}

function limits(options: Record<string, unknown>) {
  const minimum =
    typeof options.min === "number" && Number.isFinite(options.min) ? options.min : undefined;
  const maximum =
    typeof options.max === "number" && Number.isFinite(options.max) ? options.max : undefined;
  return {
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
  };
}

function normalizeInputGroup(value: unknown, required: boolean): NormalizedNodeInput[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const result: NormalizedNodeInput[] = [];
  for (const [name, rawDefinition] of Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    if (!safeNodeClass.test(name) || unsafeMetadataKey.test(name)) continue;
    const { tuple, metadata: options } = inputMetadata(rawDefinition);
    const type = normalizedType(tuple[0]);
    const dynamic = dynamicOptions(rawDefinition);
    result.push({
      name,
      required,
      ...type,
      ...limits(options),
      ...(dynamic ? { dynamicOptions: dynamic } : {}),
    });
  }
  return result;
}

function normalizeNode(className: string, raw: unknown): NormalizedNodeInfo {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const input =
    record.input && typeof record.input === "object" && !Array.isArray(record.input)
      ? (record.input as Record<string, unknown>)
      : {};
  const outputs = Array.isArray(record.output)
    ? record.output
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.toUpperCase())
        .slice(0, 100)
    : [];
  return {
    className,
    isOutputNode: record.output_node === true,
    inputs: [
      ...normalizeInputGroup(input.required, true),
      ...normalizeInputGroup(input.optional, false),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    outputs,
  };
}

export function normalizeNodeCatalog(
  source: Record<string, unknown>,
  requestedNodeClasses: readonly string[],
): NormalizedNodeCatalog {
  const requested = [...new Set(requestedNodeClasses)]
    .filter((value) => safeNodeClass.test(value))
    .sort();
  const nodes = requested
    .filter((className) => Object.hasOwn(source, className))
    .map((className) => normalizeNode(className, source[className]));
  const sourceCore = { requestedNodeClasses: requested, nodes };
  const core = {
    schemaVersion: "comfyui-node-catalog-v1" as const,
    requestedNodeClasses: requested,
    nodes,
    sourceSha256: hashCanonical(sourceCore),
  };
  return { ...core, catalogSha256: hashCanonical(core) };
}

export function nodeCatalogIsStale(
  catalog: NormalizedNodeCatalog,
  expectedCatalogSha256: string,
): boolean {
  return catalog.catalogSha256 !== expectedCatalogSha256;
}

export function allowlistedNodeInfo(
  catalog: NormalizedNodeCatalog,
  className: string,
): NormalizedNodeInfo | null {
  if (!catalog.requestedNodeClasses.includes(className)) return null;
  return catalog.nodes.find((node) => node.className === className) ?? null;
}

export async function captureNodeCatalog(
  client: ComfyUiClient,
  requestedNodeClasses: readonly string[],
): Promise<NormalizedNodeCatalog> {
  return normalizeNodeCatalog(await client.getObjectInfo(), requestedNodeClasses);
}
