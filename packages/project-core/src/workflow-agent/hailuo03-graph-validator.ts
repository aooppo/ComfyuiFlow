import {
  GraphValidationResultV3Schema,
  MaterializedGraphSnapshotV3Schema,
  type GraphValidationResultV3,
  type MaterializedGraphSnapshotV3,
  type ReferencePlanV3,
  type VersionRefV2,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";
import {
  HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
  type MaterializedHailuo03GraphV3,
} from "./compilers/hailuo03.js";

export const HAILUO03_GRAPH_VALIDATOR_REF = {
  id: "validator.hailuo03-reference-graph",
  version: "3.0.0",
} as const;
export const HAILUO03_RUNTIME_CONTRACT = {
  runtime: "comfyui-mcp-v2",
  loaders: {
    LoadImage: { input: "image", output: "IMAGE" },
    LoadVideo: { input: "file", output: "VIDEO" },
    LoadAudio: { input: "audio", output: "AUDIO" },
  },
  generationNode: {
    classType: "MinimaxHailuo03ReferenceNode",
    model: "MiniMax H3",
    dynamicGroups: {
      image: { prefix: "model.reference_images.image_", max: 9 },
      video: { prefix: "model.reference_videos.video_", max: 3 },
      audio: { prefix: "model.reference_audios.audio_", max: 3 },
    },
    durationSeconds: { min: 4, max: 15, integer: true },
    aspectRatios: ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    resolutions: ["768P", "2K"],
    output: "VIDEO",
  },
  saver: {
    classType: "SaveVideo",
    input: "video",
    format: "mp4",
    codec: "auto",
  },
} as const;
export const HAILUO03_RUNTIME_CONTRACT_DIGEST = canonicalSha256(HAILUO03_RUNTIME_CONTRACT);

const stagedNamePattern =
  /^comfyuiflow\/staged\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|mp4|mov|wav|mp3|m4a)$/;
const outputPrefixPattern = /^comfyuiflow\/v3\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/;

function nodeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nodeInputs(node: Record<string, unknown> | null): Record<string, unknown> {
  return nodeRecord(node?.inputs) ?? {};
}

function isLink(value: unknown, sourceId: string) {
  return (
    Array.isArray(value) && value.length === 2 && String(value[0]) === sourceId && value[1] === 0
  );
}

function validationResult(
  materializedGraphSha256: string,
  runtimeContractDigest: string,
  outputNodeId: string,
  blockers: string[],
): GraphValidationResultV3 {
  return GraphValidationResultV3Schema.parse({
    schemaVersion: "hailuo03-graph-validation-v3",
    status: blockers.length === 0 ? "VALID" : "BLOCKED",
    blockerCodes: [...new Set(blockers)].sort(),
    validatorRef: HAILUO03_GRAPH_VALIDATOR_REF,
    materializedGraphSha256,
    capabilityEnvelopeDigest: HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
    runtimeContractDigest,
    outputNodeId,
    externalCalls: 0,
  });
}

export function validateHailuo03MaterializedGraph(
  materialized: MaterializedHailuo03GraphV3,
  runtimeContractDigest = HAILUO03_RUNTIME_CONTRACT_DIGEST,
): GraphValidationResultV3 {
  const blockers: string[] = [];
  const graph = nodeRecord(materialized.materializedGraph) ?? {};
  const graphSha = canonicalSha256(graph);
  if (graphSha !== materialized.materializedGraphSha256)
    blockers.push("HAILUO_GRAPH_DIGEST_MISMATCH");
  if (runtimeContractDigest !== HAILUO03_RUNTIME_CONTRACT_DIGEST)
    blockers.push("HAILUO_RUNTIME_CONTRACT_DRIFT");
  if (materialized.capabilityEnvelopeDigest !== HAILUO03_CAPABILITY_ENVELOPE_DIGEST)
    blockers.push("HAILUO_CAPABILITY_ENVELOPE_DRIFT");

  const entries = Object.entries(graph).sort((left, right) => Number(left[0]) - Number(right[0]));
  if (
    entries.length < 3 ||
    entries.some(([id], index) => id !== String(index + 1)) ||
    entries.some(([, node]) => !nodeRecord(node))
  )
    blockers.push("HAILUO_GRAPH_TOPOLOGY_INVALID");

  const allowedClasses = new Set([
    "LoadImage",
    "LoadVideo",
    "LoadAudio",
    "MinimaxHailuo03ReferenceNode",
    "SaveVideo",
  ]);
  for (const [, rawNode] of entries) {
    const node = nodeRecord(rawNode);
    if (!node || !allowedClasses.has(String(node.class_type)))
      blockers.push("HAILUO_NODE_CLASS_FORBIDDEN");
    const serialized = JSON.stringify(node ?? {});
    if (
      /(?:credential|password|api[_-]?key|endpoint|command|shell|script|https?:\/\/|file:\/\/)/i.test(
        serialized,
      )
    )
      blockers.push("HAILUO_EXECUTABLE_INPUT_FORBIDDEN");
  }

  const generationEntries = entries.filter(
    ([, rawNode]) => nodeRecord(rawNode)?.class_type === "MinimaxHailuo03ReferenceNode",
  );
  const saverEntries = entries.filter(
    ([, rawNode]) => nodeRecord(rawNode)?.class_type === "SaveVideo",
  );
  if (generationEntries.length !== 1 || saverEntries.length !== 1)
    blockers.push("HAILUO_GRAPH_TOPOLOGY_INVALID");

  const generationId = generationEntries[0]?.[0] ?? "0";
  const generationInputs = nodeInputs(nodeRecord(generationEntries[0]?.[1]));
  const saverId = saverEntries[0]?.[0] ?? materialized.outputNodeId;
  const saverInputs = nodeInputs(nodeRecord(saverEntries[0]?.[1]));
  if (
    saverId !== materialized.outputNodeId ||
    !isLink(saverInputs.video, generationId) ||
    saverInputs.format !== "mp4" ||
    saverInputs.codec !== "auto" ||
    typeof saverInputs.filename_prefix !== "string" ||
    !outputPrefixPattern.test(saverInputs.filename_prefix)
  )
    blockers.push("HAILUO_OUTPUT_MAPPING_INVALID");

  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  const loaderIds = new Set<string>();
  for (const [id, rawNode] of entries) {
    const node = nodeRecord(rawNode);
    const inputs = nodeInputs(node);
    const classType = node?.class_type;
    const fact =
      classType === "LoadImage"
        ? { modality: "IMAGE" as const, input: "image", prefix: "model.reference_images.image_" }
        : classType === "LoadVideo"
          ? { modality: "VIDEO" as const, input: "file", prefix: "model.reference_videos.video_" }
          : classType === "LoadAudio"
            ? {
                modality: "AUDIO" as const,
                input: "audio",
                prefix: "model.reference_audios.audio_",
              }
            : null;
    if (!fact) continue;
    loaderIds.add(id);
    counts[fact.modality] += 1;
    const staged = inputs[fact.input];
    if (typeof staged !== "string" || !stagedNamePattern.test(staged))
      blockers.push("HAILUO_STAGED_INPUT_INVALID");
    const connection = generationInputs[`${fact.prefix}${counts[fact.modality]}`];
    if (!isLink(connection, id)) blockers.push("HAILUO_GRAPH_TOPOLOGY_INVALID");
  }
  const dynamicConnections = Object.entries(generationInputs).filter(([name]) =>
    /^model\.reference_(?:images\.image|videos\.video|audios\.audio)_[1-9][0-9]*$/.test(name),
  );
  if (dynamicConnections.length !== loaderIds.size) blockers.push("HAILUO_GRAPH_TOPOLOGY_INVALID");
  if (counts.IMAGE > 9) blockers.push("HAILUO_IMAGE_LIMIT_EXCEEDED");
  if (counts.VIDEO > 3) blockers.push("HAILUO_VIDEO_LIMIT_EXCEEDED");
  if (counts.AUDIO > 3) blockers.push("HAILUO_AUDIO_LIMIT_EXCEEDED");
  if (counts.IMAGE + counts.VIDEO === 0)
    blockers.push(
      counts.AUDIO > 0
        ? "HAILUO_AUDIO_REQUIRES_VISUAL_REFERENCE"
        : "HAILUO_VISUAL_REFERENCE_REQUIRED",
    );

  const duration = generationInputs["model.duration"];
  if (!Number.isInteger(duration) || Number(duration) < 4 || Number(duration) > 15)
    blockers.push("HAILUO_DURATION_UNSUPPORTED");
  if (
    !["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"].includes(
      String(generationInputs["model.ratio"]),
    )
  )
    blockers.push("HAILUO_RATIO_UNSUPPORTED");
  if (!["768P", "2K"].includes(String(generationInputs["model.resolution"])))
    blockers.push("HAILUO_RESOLUTION_UNSUPPORTED");
  if (
    generationInputs.model !== "MiniMax H3" ||
    typeof generationInputs["model.prompt"] !== "string" ||
    !String(generationInputs["model.prompt"]).trim()
  )
    blockers.push("HAILUO_GRAPH_TOPOLOGY_INVALID");

  return validationResult(graphSha, runtimeContractDigest, materialized.outputNodeId, blockers);
}

export function freezeHailuo03GraphSnapshot(input: {
  plan: ReferencePlanV3;
  materialized: MaterializedHailuo03GraphV3;
  generationSpecRef: VersionRefV2;
  implementationRef: VersionRefV2;
  adapterRef: VersionRefV2;
  runtimeRef: VersionRefV2;
  runtimeContractDigest?: string;
}): MaterializedGraphSnapshotV3 {
  const runtimeContractDigest = input.runtimeContractDigest ?? HAILUO03_RUNTIME_CONTRACT_DIGEST;
  const validation = validateHailuo03MaterializedGraph(input.materialized, runtimeContractDigest);
  if (validation.status !== "VALID")
    throw new Error(validation.blockerCodes[0] ?? "HAILUO_GRAPH_VALIDATION_BLOCKED");
  return MaterializedGraphSnapshotV3Schema.parse({
    schemaVersion: "materialized-graph-snapshot-v3",
    referencePlanDigest: input.plan.referencePlanDigest,
    generationSpecRef: input.generationSpecRef,
    implementationRef: input.implementationRef,
    compilerRef: input.plan.compilerRef,
    validatorRef: HAILUO03_GRAPH_VALIDATOR_REF,
    adapterRef: input.adapterRef,
    runtimeRef: input.runtimeRef,
    capabilityEnvelopeDigest: input.materialized.capabilityEnvelopeDigest,
    runtimeContractDigest,
    materializedGraph: input.materialized.materializedGraph,
    materializedGraphSha256: input.materialized.materializedGraphSha256,
    outputNodeId: input.materialized.outputNodeId,
    outputMediaKey: input.materialized.outputMediaKey,
    stagedInputs: input.materialized.stagedInputs,
    validation,
  });
}
