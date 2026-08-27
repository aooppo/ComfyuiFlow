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

export const builtInGraphCompilerProfileIds = ["reference-video-v1"] as const;

/**
 * This reviewed v1 recipe has a fixed two-node topology. A Pack configures
 * node classes and input names only; it cannot supply node IDs, links, or raw
 * graph JSON. Compatible new models can therefore be added by Pack alone.
 */
export function builtInGraphCompilerProfiles(): readonly GraphCompilerProfile[] {
  return [
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

  compile(pack: ParsedCapabilityPack, input: unknown): CompiledGraph {
    const intent = parseGraphIntent(input, pack);
    const profile = this.profiles.get(pack.compilerProfile);
    if (!profile) throw new Error("COMPILER_PROFILE_NOT_REGISTERED");

    const graph = profile.compile({ pack, intent });
    assertGraphOnlyUsesRequiredNodes(graph, pack.requiredNodes);
    return Object.freeze({
      compilerProfile: profile.id,
      intentDigest: canonicalSha256(intent),
      graph: Object.freeze(graph),
      graphSha256: canonicalSha256(graph),
      output: Object.freeze({
        nodeId: "2",
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
