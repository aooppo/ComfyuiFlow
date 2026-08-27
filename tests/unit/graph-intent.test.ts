import { describe, expect, it } from "vitest";
import {
  canonicalSha256,
  builtInGraphCompilerProfiles,
  GraphIntentCompiler,
  parseCapabilityPack,
  type GraphCompilerProfile,
} from "@comfyuiflow/project-core";

const unsignedPack = {
  schemaVersion: 1,
  packId: "seedance-reference-video",
  packVersion: "1.0.0",
  runtimeTargetRef: { id: "runtime.comfy-partner", version: "1.0.0" },
  model: { id: "seedance-video", version: "2.0.0", availabilityKey: "seedance-v2" },
  compilerProfile: "reference-video-v1",
  compilerBinding: {
    modelNode: {
      classType: "SeedanceVideoNode",
      promptInput: "prompt",
      durationSecondsInput: "duration",
      ratioInput: "ratio",
    },
    outputNode: { classType: "SaveVideo", videoInput: "video", outputMediaKey: "videos" },
  },
  allowedIntentModes: ["reference-video", "text-to-video"],
  parameterEnvelope: {
    images: { min: 0, max: 2 },
    durationSeconds: [4, 15],
    ratios: ["16:9", "9:16"],
  },
  requiredNodes: ["SaveVideo", "SeedanceVideoNode"],
};

const pack = parseCapabilityPack({
  ...unsignedPack,
  expectedManifestSha256: canonicalSha256(unsignedPack),
});

const profile: GraphCompilerProfile = {
  id: "reference-video-v1",
  compile: ({ intent }) => ({
    "1": {
      class_type: "SeedanceVideoNode",
      inputs: { prompt: intent.prompt, ratio: intent.ratio },
    },
    "2": { class_type: "SaveVideo", inputs: { duration: intent.durationSeconds } },
  }),
};

describe("Graph Intent compiler", () => {
  it("compiles a new bounded per-Shot graph locally without an operations approval", () => {
    const compiler = new GraphIntentCompiler(builtInGraphCompilerProfiles());
    const compiled = compiler.compile(pack, {
      schemaVersion: 1,
      mode: "text-to-video",
      prompt: "A small boat crossing a quiet lake at sunrise",
      imageAssetIds: [],
      durationSeconds: 8,
      ratio: "16:9",
    });

    expect(compiled.compilerProfile).toBe("reference-video-v1");
    expect(compiled.graphSha256).toBe(canonicalSha256(compiled.graph));
    expect(compiled.graph["1"]).toMatchObject({ class_type: "SeedanceVideoNode" });
    expect(compiled.output).toEqual({ nodeId: "2", mediaKey: "videos" });
  });

  it("rejects raw graph input, values outside the pack envelope, and compiler node escape", () => {
    const compiler = new GraphIntentCompiler([profile]);
    const validIntent = {
      schemaVersion: 1,
      mode: "text-to-video",
      prompt: "A calm ocean",
      imageAssetIds: [],
      durationSeconds: 8,
      ratio: "16:9",
    };
    expect(() => compiler.compile(pack, { ...validIntent, graph: {} })).toThrow();
    expect(() => compiler.compile(pack, { ...validIntent, durationSeconds: 16 })).toThrow(
      "GRAPH_INTENT_DURATION_OUT_OF_RANGE",
    );
    const escapingCompiler = new GraphIntentCompiler([
      { ...profile, compile: () => ({ "1": { class_type: "ArbitraryNode", inputs: {} } }) },
    ]);
    expect(() => escapingCompiler.compile(pack, validIntent)).toThrow(
      "COMPILER_PROFILE_EMITTED_NODE_OUTSIDE_CAPABILITY_CONTRACT",
    );
  });
});
