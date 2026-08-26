import {
  ReferencePlanV3Schema,
  type MaterializedComfyUiGraphV3,
  type ReferencePlanV3,
} from "@comfyuiflow/contracts";
import { z } from "zod";
import { canonicalJson, canonicalSha256 } from "../../canonical-json.js";

export const HAILUO03_DYNAMIC_COMPILER_REF = {
  id: "compiler.hailuo03-reference-dynamic",
  version: "3.0.0",
} as const;
export const HAILUO03_CAPABILITY_ENVELOPE = {
  nodeClass: "MinimaxHailuo03ReferenceNode",
  imageReferences: { min: 0, max: 9 },
  videoReferences: { min: 0, max: 3 },
  audioReferences: { min: 0, max: 3 },
  durationSeconds: { min: 4, max: 15, integer: true },
  aspectRatios: ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
  resolutions: ["768P", "2K"],
  invariants: ["IMAGE_OR_VIDEO_REQUIRED", "AUDIO_REQUIRES_IMAGE_OR_VIDEO"],
  output: { nodeClass: "SaveVideo", mediaType: "video/mp4", mediaKey: "video" },
} as const;
export const HAILUO03_CAPABILITY_ENVELOPE_DIGEST = canonicalSha256(HAILUO03_CAPABILITY_ENVELOPE);

const refSchema = z
  .object({ id: z.string().min(1).max(160), version: z.string().min(1).max(80) })
  .strict();
const bindingSchema = z
  .object({
    sourceRef: refSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    modality: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
    order: z.number().int().nonnegative().max(100),
    roleLabel: z.string().min(1).max(160),
    necessity: z.enum(["REQUIRED", "OPTIONAL"]),
  })
  .strict();
export const HailuoCompilerInputV3Schema = z
  .object({
    compilerRef: refSchema,
    prompt: z.string().trim().min(1).max(12_000),
    durationSeconds: z.number().positive().max(30),
    bindings: z.array(bindingSchema).max(16),
  })
  .strict();

type LegacyInput = z.infer<typeof HailuoCompilerInputV3Schema>;

function compiled(input: LegacyInput, mediaInputs: Array<Record<string, unknown>>) {
  const core = {
    schemaVersion: "compiled-request-preview-v3" as const,
    compilerRef: input.compilerRef,
    operation: "VIDEO_GENERATION" as const,
    prompt: input.prompt,
    durationSeconds: input.durationSeconds,
    mediaInputs,
    expectedOutput: { mediaType: "video/mp4" as const },
  };
  return { ...core, compiledRequestDigest: canonicalSha256(core) };
}

function ordered(bindings: LegacyInput["bindings"]) {
  return [...bindings].sort((left, right) => {
    const modalityRank = { IMAGE: 0, VIDEO: 1, AUDIO: 2 } as const;
    return (
      modalityRank[left.modality] - modalityRank[right.modality] ||
      left.order - right.order ||
      `${left.sourceRef.id}@${left.sourceRef.version}`.localeCompare(
        `${right.sourceRef.id}@${right.sourceRef.version}`,
      )
    );
  });
}

export function compileHailuo03Text(raw: unknown) {
  const input = HailuoCompilerInputV3Schema.parse(raw);
  if (input.bindings.length !== 0) throw new Error("TEXT_TO_VIDEO_REJECTS_MEDIA");
  return compiled(input, []);
}

export function compileHailuo03Reference(raw: unknown) {
  const input = HailuoCompilerInputV3Schema.parse(raw);
  const bindings = ordered(input.bindings);
  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  for (const binding of bindings) counts[binding.modality] += 1;
  if (counts.IMAGE > 9 || counts.VIDEO > 3 || counts.AUDIO > 3)
    throw new Error("REFERENCE_CARDINALITY_EXCEEDED");
  if (counts.IMAGE + counts.VIDEO === 0)
    throw new Error(
      counts.AUDIO > 0 ? "AUDIO_REQUIRES_VISUAL_REFERENCE" : "VISUAL_REFERENCE_REQUIRED",
    );
  const ordinals = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  return compiled(
    input,
    bindings.map((binding) => ({
      ...binding,
      label: `${binding.modality[0]}${binding.modality.slice(1).toLowerCase()} ${++ordinals[binding.modality]}`,
    })),
  );
}

export function compileHailuo03FirstLast(raw: unknown) {
  const input = HailuoCompilerInputV3Schema.parse(raw);
  const bindings = ordered(input.bindings);
  if (
    bindings.some((binding) => binding.modality !== "IMAGE") ||
    bindings.length < 1 ||
    bindings.length > 2
  )
    throw new Error("FIRST_LAST_FRAME_INPUT_INVALID");
  const first = bindings.find(
    (binding) =>
      binding.roleLabel.toLowerCase() === "first-frame" ||
      binding.sourceRef.id.includes("final-frame"),
  );
  if (!first) throw new Error("FIRST_FRAME_REQUIRED");
  const last = bindings.find((binding) => binding.roleLabel.toLowerCase() === "last-frame");
  return compiled(input, [
    { ...first, label: "First Frame" },
    ...(last ? [{ ...last, label: "Last Frame" }] : []),
  ]);
}

function assertReferenceCounts(counts: { IMAGE: number; VIDEO: number; AUDIO: number }) {
  if (counts.IMAGE > 9) throw new Error("HAILUO_IMAGE_LIMIT_EXCEEDED");
  if (counts.VIDEO > 3) throw new Error("HAILUO_VIDEO_LIMIT_EXCEEDED");
  if (counts.AUDIO > 3) throw new Error("HAILUO_AUDIO_LIMIT_EXCEEDED");
  if (counts.IMAGE + counts.VIDEO === 0)
    throw new Error(
      counts.AUDIO > 0
        ? "HAILUO_AUDIO_REQUIRES_VISUAL_REFERENCE"
        : "HAILUO_VISUAL_REFERENCE_REQUIRED",
    );
}

function referencePlanCore(plan: ReferencePlanV3) {
  return Object.fromEntries(
    Object.entries(plan).filter(([key]) => key !== "referencePlanDigest"),
  );
}

function assertReferencePlanDigest(plan: ReferencePlanV3) {
  if (canonicalSha256(referencePlanCore(plan)) !== plan.referencePlanDigest)
    throw new Error("REFERENCE_PLAN_DIGEST_MISMATCH");
}

function safeOutputPrefix(plan: ReferencePlanV3) {
  return `comfyuiflow/v3/${plan.storyboardVersionId}/${plan.generationSpecId}/${plan.shotId}`;
}

function promptWithReferenceRoles(plan: ReferencePlanV3) {
  const ordinals = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  const roleLines = plan.bindings.map((binding) => {
    const label = `${binding.modality[0]}${binding.modality.slice(1).toLowerCase()} ${++ordinals[binding.modality]}`;
    return `${label}: ${binding.role}.`;
  });
  return roleLines.length === 0
    ? plan.prompt
    : ["Reference roles:", ...roleLines, "Shot direction:", plan.prompt].join("\n");
}

export interface MaterializedHailuo03GraphV3 {
  schemaVersion: "materialized-hailuo03-graph-v3";
  compilerRef: ReferencePlanV3["compilerRef"];
  referencePlanDigest: string;
  capabilityEnvelopeDigest: string;
  materializedGraph: MaterializedComfyUiGraphV3;
  materializedGraphCanonicalJson: string;
  materializedGraphSha256: string;
  outputNodeId: string;
  outputMediaKey: "video";
  stagedInputs: ReferencePlanV3["bindings"];
  mediaInputs: Array<Record<string, unknown>>;
  compiledRequestDigest: string;
  externalCalls: 0;
}

function parseDynamicReferencePlan(raw: unknown): ReferencePlanV3 {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (
    Object.keys(value).some((key) =>
      /(?:graph|node|endpoint|credential|password|api[_-]?key|path|command|shell|script|outputPrefix|uploadTarget)/i.test(
        key,
      ),
    )
  )
    throw new Error("HAILUO_EXECUTABLE_INPUT_FORBIDDEN");
  if (
    !Number.isInteger(value.durationSeconds) ||
    Number(value.durationSeconds) < 4 ||
    Number(value.durationSeconds) > 15
  )
    throw new Error("HAILUO_DURATION_UNSUPPORTED");
  if (
    !["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"].includes(String(value.aspectRatio))
  )
    throw new Error("HAILUO_RATIO_UNSUPPORTED");
  if (!["768P", "2K"].includes(String(value.resolution)))
    throw new Error("HAILUO_RESOLUTION_UNSUPPORTED");
  if (Array.isArray(value.bindings)) {
    const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
    for (const rawBinding of value.bindings) {
      const binding = nodeLike(rawBinding);
      const modality = binding?.modality;
      if (modality === "IMAGE" || modality === "VIDEO" || modality === "AUDIO")
        counts[modality] += 1;
    }
    assertReferenceCounts(counts);
  }
  return ReferencePlanV3Schema.parse(raw);
}

function nodeLike(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function materializeHailuo03ReferenceGraph(raw: unknown): MaterializedHailuo03GraphV3 {
  const plan = parseDynamicReferencePlan(raw);
  assertReferencePlanDigest(plan);
  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  for (const binding of plan.bindings) counts[binding.modality] += 1;
  assertReferenceCounts(counts);

  const graph: MaterializedComfyUiGraphV3 = {};
  const loaderIds: Array<{ id: string; binding: ReferencePlanV3["bindings"][number] }> = [];
  let nextNodeId = 1;
  for (const binding of plan.bindings) {
    const id = String(nextNodeId++);
    const loader =
      binding.modality === "IMAGE"
        ? { class_type: "LoadImage" as const, inputs: { image: binding.stagedInputName } }
        : binding.modality === "VIDEO"
          ? { class_type: "LoadVideo" as const, inputs: { file: binding.stagedInputName } }
          : { class_type: "LoadAudio" as const, inputs: { audio: binding.stagedInputName } };
    graph[id] = loader;
    loaderIds.push({ id, binding });
  }

  const hailuoNodeId = String(nextNodeId++);
  const hailuoInputs: Record<string, unknown> = {
    model: "MiniMax H3",
    "model.prompt": promptWithReferenceRoles(plan),
    "model.resolution": plan.resolution,
    "model.ratio": plan.aspectRatio,
    "model.duration": plan.durationSeconds,
    seed: plan.seed,
    watermark: plan.watermark,
  };
  const modalityOrdinals = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  for (const { id, binding } of loaderIds) {
    const ordinal = ++modalityOrdinals[binding.modality];
    const group =
      binding.modality === "IMAGE"
        ? "reference_images.image"
        : binding.modality === "VIDEO"
          ? "reference_videos.video"
          : "reference_audios.audio";
    hailuoInputs[`model.${group}_${ordinal}`] = [id, 0];
  }
  graph[hailuoNodeId] = {
    class_type: "MinimaxHailuo03ReferenceNode",
    inputs: hailuoInputs,
  };

  const outputNodeId = String(nextNodeId);
  graph[outputNodeId] = {
    class_type: "SaveVideo",
    inputs: {
      video: [hailuoNodeId, 0],
      filename_prefix: safeOutputPrefix(plan),
      format: "mp4",
      codec: "auto",
    },
  };
  const materializedGraphCanonicalJson = canonicalJson(graph);
  const materializedGraphSha256 = canonicalSha256(graph);
  const mediaInputs = plan.bindings.map((binding, index) => ({
    sourceRef: binding.sourceRef,
    sha256: binding.sha256,
    modality: binding.modality,
    role: binding.role,
    order: binding.order,
    label: `${binding.modality[0]}${binding.modality.slice(1).toLowerCase()} ${
      plan.bindings
        .slice(0, index + 1)
        .filter((candidate) => candidate.modality === binding.modality).length
    }`,
    stagedInputName: binding.stagedInputName,
  }));
  const compiledRequestDigest = canonicalSha256({
    compilerRef: plan.compilerRef,
    referencePlanDigest: plan.referencePlanDigest,
    capabilityEnvelopeDigest: HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
    materializedGraphSha256,
  });
  return {
    schemaVersion: "materialized-hailuo03-graph-v3",
    compilerRef: plan.compilerRef,
    referencePlanDigest: plan.referencePlanDigest,
    capabilityEnvelopeDigest: HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
    materializedGraph: graph,
    materializedGraphCanonicalJson,
    materializedGraphSha256,
    outputNodeId,
    outputMediaKey: "video",
    stagedInputs: plan.bindings,
    mediaInputs,
    compiledRequestDigest,
    externalCalls: 0,
  };
}
