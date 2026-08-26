import { DiscoveryCandidateV2Schema, type VersionRefV2 } from "@comfyuiflow/contracts";
import { hashCanonical } from "@comfyuiflow/spike-core";
import { normalizeNodeCatalog, type NormalizedNodeInput } from "./node-catalog.js";

const modalityForType = (type: string) => {
  if (type === "IMAGE" || type === "VIDEO" || type === "AUDIO") return type;
  return null;
};

function dynamicGroups(inputs: NormalizedNodeInput[]) {
  const grouped = new Map<
    string,
    { modality: "IMAGE" | "VIDEO" | "AUDIO"; prefix: string; ordinals: number[]; required: number }
  >();
  for (const input of inputs) {
    const modality = modalityForType(input.type);
    const match = /^([a-z][a-z0-9.-]*)_(\d+)$/i.exec(input.name);
    if (!modality || !match) continue;
    const prefix = match[1]!.toLowerCase();
    const key = `${modality}:${prefix}`;
    const current = grouped.get(key) ?? { modality, prefix, ordinals: [], required: 0 };
    current.ordinals.push(Number(match[2]));
    if (input.required) current.required += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((group) => ({
      modality: group.modality,
      prefix: group.prefix,
      min: group.required,
      max: Math.max(...group.ordinals),
    }))
    .sort((left, right) =>
      `${left.modality}:${left.prefix}`.localeCompare(`${right.modality}:${right.prefix}`),
    );
}

export function discoverNodeCapabilities(
  source: Record<string, unknown>,
  requestedNodeClasses: readonly string[],
  runtimeRef: VersionRefV2,
  discoveredAt = new Date(0).toISOString(),
) {
  const catalog = normalizeNodeCatalog(source, requestedNodeClasses);
  return catalog.nodes.map((node) => {
    const normalizedInputs = node.inputs.map((input) => ({ ...input }));
    const normalizedOutputs = node.outputs.map((type, index) => ({ index, type }));
    const core = {
      runtimeRef,
      nodeIdentifier: node.className,
      normalizedInputs,
      normalizedOutputs,
      dynamicGroups: dynamicGroups(node.inputs),
    };
    const sourceDigest = hashCanonical(core);
    const safeNodeId = node.className.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    return DiscoveryCandidateV2Schema.parse({
      id: `discovery.${runtimeRef.id}.${safeNodeId}`.slice(0, 160),
      version: sourceDigest.slice(0, 32),
      ...core,
      discoveredAt,
      sourceDigest,
      rawSchemaRef: `raw-schema.${sourceDigest}`,
      status: "DISCOVERED",
    });
  });
}
