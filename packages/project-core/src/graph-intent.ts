import { z } from "zod";

import { canonicalSha256 } from "./canonical-json.js";
import type { ParsedCapabilityPack } from "./capability-pack.js";

const assetId = z.string().uuid();

const graphIntentSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.string().min(1).max(160),
    prompt: z.string().trim().min(1).max(8_000),
    imageAssetIds: z.array(assetId).max(32),
    durationSeconds: z.number().int().positive(),
    ratio: z.string().regex(/^\d+:\d+$/),
    resolution: z.string().min(1).max(40).optional(),
    seed: z.number().int().min(0).max(4_294_967_295).optional(),
  })
  .strict();

export type GraphIntent = z.infer<typeof graphIntentSchema>;

export interface CompiledGraph {
  readonly compilerProfile: string;
  readonly intentDigest: string;
  readonly graph: Readonly<Record<string, unknown>>;
  readonly graphSha256: string;
  readonly output: Readonly<{ nodeId: string; mediaKey: string }>;
}

/**
 * A compiler profile is developed, reviewed, and shipped with the application.
 * A Capability Pack can select a profile but cannot embed one or submit a raw
 * ComfyUI graph of its own.
 */
export interface GraphCompilerProfile {
  readonly id: string;
  compile(
    input: Readonly<{ pack: ParsedCapabilityPack; intent: GraphIntent }>,
  ): Readonly<Record<string, unknown>>;
}

export interface GraphCompilationContext {
  /** Server-derived ComfyUI staging names, ordered to the frozen image asset IDs. */
  readonly imageStagedInputNames?: readonly string[];
}

export const builtInGraphCompilerProfileIds = [
  "h3-reference-video-v1",
  "reference-video-v1",
] as const;

const safeStagedInputName = /^comfyuiflow\/staged\/[A-Za-z0-9][A-Za-z0-9_.-]{0,220}$/;

function compileH3ReferenceVideoGraph(
  pack: ParsedCapabilityPack,
  intent: GraphIntent,
  context: GraphCompilationContext = {},
): Readonly<Record<string, unknown>> {
  const stagedNames = context.imageStagedInputNames;
  if (!stagedNames || stagedNames.length !== intent.imageAssetIds.length)
    throw new Error("H3_FROZEN_STAGING_CONTEXT_MISMATCH");
  if (
    new Set(stagedNames).size !== stagedNames.length ||
    !stagedNames.every((name) => safeStagedInputName.test(name))
  )
    throw new Error("H3_FROZEN_STAGING_NAME_INVALID");
  if (intent.resolution !== "2K" || intent.seed === undefined)
    throw new Error("H3_INTENT_SETTINGS_REQUIRED");

  const graph: Record<string, unknown> = {};
  stagedNames.forEach((name, index) => {
    graph[String(index + 1)] = { class_type: "LoadImage", inputs: { image: name } };
  });
  const h3NodeId = String(stagedNames.length + 1);
  const outputNodeId = String(stagedNames.length + 2);
  graph[h3NodeId] = {
    class_type: pack.compilerBinding.modelNode.classType,
    inputs: {
      model: "MiniMax H3",
      [pack.compilerBinding.modelNode.promptInput]: intent.prompt,
      "model.resolution": intent.resolution,
      [pack.compilerBinding.modelNode.ratioInput]: intent.ratio,
      [pack.compilerBinding.modelNode.durationSecondsInput]: intent.durationSeconds,
      ...Object.fromEntries(
        stagedNames.map((_, index) => [
          `model.reference_images.image_${index + 1}`,
          [String(index + 1), 0],
        ]),
      ),
      seed: intent.seed,
      watermark: false,
    },
  };
  graph[outputNodeId] = {
    class_type: pack.compilerBinding.outputNode.classType,
    inputs: {
      [pack.compilerBinding.outputNode.videoInput]: [h3NodeId, 0],
      filename_prefix: "comfyuiflow/generated",
      format: "mp4",
      codec: "auto",
    },
  };
  return graph;
}

export function builtInGraphCompilerProfiles(): readonly GraphCompilerProfile[] {
  return [
    {
      id: "h3-reference-video-v1",
      // GraphIntentCompiler supplies the server-only staging context.
      compile: ({ pack, intent }) => compileH3ReferenceVideoGraph(pack, intent),
    },
    {
      id: "reference-video-v1",
      compile: ({ pack, intent }) => {
        const binding = pack.compilerBinding;
        const modelInputs: Record<string, unknown> = {
          [binding.modelNode.promptInput]: intent.prompt,
          [binding.modelNode.durationSecondsInput]: intent.durationSeconds,
          [binding.modelNode.ratioInput]: intent.ratio,
        };
        if (binding.modelNode.imageAssetIdsInput)
          modelInputs[binding.modelNode.imageAssetIdsInput] = intent.imageAssetIds;
        return {
          "1": { class_type: binding.modelNode.classType, inputs: modelInputs },
          "2": {
            class_type: binding.outputNode.classType,
            inputs: { [binding.outputNode.videoInput]: ["1", 0] },
          },
        };
      },
    },
  ];
}

export function parseGraphIntent(input: unknown, pack: ParsedCapabilityPack): GraphIntent {
  const intent = graphIntentSchema.parse(input);
  const envelope = pack.parameterEnvelope;

  if (!pack.allowedIntentModes.includes(intent.mode)) {
    throw new Error("GRAPH_INTENT_MODE_NOT_ALLOWED");
  }
  if (
    intent.imageAssetIds.length < envelope.images.min ||
    intent.imageAssetIds.length > envelope.images.max
  ) {
    throw new Error("GRAPH_INTENT_IMAGE_COUNT_OUT_OF_RANGE");
  }
  if (
    intent.durationSeconds < envelope.durationSeconds[0] ||
    intent.durationSeconds > envelope.durationSeconds[1]
  ) {
    throw new Error("GRAPH_INTENT_DURATION_OUT_OF_RANGE");
  }
  if (!envelope.ratios.includes(intent.ratio)) {
    throw new Error("GRAPH_INTENT_RATIO_NOT_ALLOWED");
  }
  if (envelope.resolutions && !intent.resolution)
    throw new Error("GRAPH_INTENT_RESOLUTION_REQUIRED");
  if (intent.resolution && !envelope.resolutions?.includes(intent.resolution))
    throw new Error("GRAPH_INTENT_RESOLUTION_NOT_ALLOWED");
  return Object.freeze(intent);
}

export class GraphIntentCompiler {
  private readonly profiles: ReadonlyMap<string, GraphCompilerProfile>;

  constructor(profiles: readonly GraphCompilerProfile[]) {
    const profileMap = new Map<string, GraphCompilerProfile>();
    for (const profile of profiles) {
      if (profileMap.has(profile.id)) throw new Error(`DUPLICATE_COMPILER_PROFILE:${profile.id}`);
      profileMap.set(profile.id, profile);
    }
    this.profiles = profileMap;
  }

  compile(
    pack: ParsedCapabilityPack,
    input: unknown,
    context: GraphCompilationContext = {},
  ): CompiledGraph {
    const intent = parseGraphIntent(input, pack);
    const profile = this.profiles.get(pack.compilerProfile);
    if (!profile) throw new Error("COMPILER_PROFILE_NOT_REGISTERED");

    const graph =
      profile.id === "h3-reference-video-v1"
        ? compileH3ReferenceVideoGraph(pack, intent, context)
        : profile.compile({ pack, intent });
    assertGraphOnlyUsesRequiredNodes(graph, pack.requiredNodes);
    const outputNodeIds = Object.entries(graph)
      .filter(
        ([, node]) =>
          isPlainObject(node) && node.class_type === pack.compilerBinding.outputNode.classType,
      )
      .map(([nodeId]) => nodeId);
    if (outputNodeIds.length !== 1) throw new Error("COMPILER_PROFILE_OUTPUT_NODE_AMBIGUOUS");
    return Object.freeze({
      compilerProfile: profile.id,
      intentDigest: canonicalSha256(intent),
      graph: Object.freeze(graph),
      graphSha256: canonicalSha256(graph),
      output: Object.freeze({
        nodeId: outputNodeIds[0]!,
        mediaKey: pack.compilerBinding.outputNode.outputMediaKey,
      }),
    });
  }
}

function assertGraphOnlyUsesRequiredNodes(
  graph: Readonly<Record<string, unknown>>,
  requiredNodes: readonly string[],
): void {
  for (const node of Object.values(graph)) {
    if (!isPlainObject(node) || typeof node.class_type !== "string") {
      throw new Error("COMPILER_PROFILE_EMITTED_INVALID_GRAPH_NODE");
    }
    if (!requiredNodes.includes(node.class_type)) {
      throw new Error("COMPILER_PROFILE_EMITTED_NODE_OUTSIDE_CAPABILITY_CONTRACT");
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
