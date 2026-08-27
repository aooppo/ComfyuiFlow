import { describe, expect, it } from "vitest";
import { canonicalSha256, parseCapabilityPack } from "@comfyuiflow/project-core";

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
    images: { min: 0, max: 9 },
    durationSeconds: [4, 15],
    ratios: ["16:9", "9:16"],
  },
  requiredNodes: ["SaveVideo", "SeedanceVideoNode"],
};

describe("Capability Pack v1", () => {
  it("accepts an exact canonical pack without any external operation", () => {
    const pack = parseCapabilityPack({
      ...unsignedPack,
      expectedManifestSha256: canonicalSha256(unsignedPack),
    });
    expect(pack.manifestSha256).toBe(canonicalSha256(unsignedPack));
    expect(pack.requiredNodes).toEqual(["SaveVideo", "SeedanceVideoNode"]);
  });

  it("rejects an altered digest, unknown fields, raw graphs, and unordered nodes", () => {
    expect(() =>
      parseCapabilityPack({ ...unsignedPack, expectedManifestSha256: "a".repeat(64) }),
    ).toThrow("CAPABILITY_PACK_DIGEST_MISMATCH");
    expect(() => parseCapabilityPack({ ...unsignedPack, graph: {} })).toThrow();
    expect(() => parseCapabilityPack({ ...unsignedPack, apiKey: "not-allowed" })).toThrow();
    expect(() =>
      parseCapabilityPack({
        ...unsignedPack,
        requiredNodes: ["SeedanceVideoNode", "SaveVideo"],
        expectedManifestSha256: canonicalSha256({
          ...unsignedPack,
          requiredNodes: ["SeedanceVideoNode", "SaveVideo"],
        }),
      }),
    ).toThrow("CAPABILITY_PACK_NODES_NOT_SORTED_UNIQUE");
  });

  it("rejects a fake H3 profile that changes the reviewed remote-node binding", () => {
    const h3 = {
      schemaVersion: 1,
      packId: "minimax-h3-reference-video",
      packVersion: "1.0.0",
      runtimeTargetRef: { id: "runtime.comfy-partner", version: "1.0.0" },
      model: { id: "model.minimax-h3", version: "1.0.0", availabilityKey: "minimax-h3-partner" },
      compilerProfile: "h3-reference-video-v1",
      compilerBinding: {
        modelNode: {
          classType: "MinimaxHailuo03ReferenceNode",
          promptInput: "model.prompt",
          durationSecondsInput: "model.duration",
          ratioInput: "model.ratio",
        },
        outputNode: { classType: "SaveVideo", videoInput: "video", outputMediaKey: "videos" },
      },
      allowedIntentModes: ["reference-video"],
      parameterEnvelope: {
        images: { min: 1, max: 9 },
        durationSeconds: [4, 15],
        ratios: ["16:9"],
        resolutions: ["2K"],
      },
      requiredNodes: ["LoadImage", "MinimaxHailuo03ReferenceNode", "SaveVideo"],
    };
    expect(
      parseCapabilityPack({ ...h3, expectedManifestSha256: canonicalSha256(h3) }),
    ).toMatchObject({ compilerProfile: "h3-reference-video-v1" });
    const altered = {
      ...h3,
      compilerBinding: {
        ...h3.compilerBinding,
        outputNode: { ...h3.compilerBinding.outputNode, outputMediaKey: "images" },
      },
    };
    expect(() =>
      parseCapabilityPack({ ...altered, expectedManifestSha256: canonicalSha256(altered) }),
    ).toThrow("CAPABILITY_PACK_H3_BINDING_INVALID");
  });
});
