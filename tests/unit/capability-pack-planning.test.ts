import { describe, expect, it } from "vitest";
import {
  builtInGraphCompilerProfiles,
  canonicalSha256,
  CapabilityRegistry,
  GraphIntentCompiler,
  planCapabilityPackGraph,
  prepareCapabilityPublication,
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
    images: { min: 0, max: 9 },
    durationSeconds: [4, 15],
    ratios: ["16:9", "9:16"],
  },
  requiredNodes: ["SaveVideo", "SeedanceVideoNode"],
};

describe("Capability Pack → frozen Graph planning", () => {
  it("creates an unauthorised Test A-ready frozen graph with zero external calls", () => {
    const registration = prepareCapabilityPublication({
      ...unsignedPack,
      expectedManifestSha256: canonicalSha256(unsignedPack),
    });
    const registry = new CapabilityRegistry([
      {
        ref: registration.capabilityRef,
        schemaVersion: 1,
        runtimeContracts: [registration.runtimeContract],
        implementations: [registration.implementation],
      },
    ]);
    const result = planCapabilityPackGraph({
      registry,
      pack: registration.pack,
      implementationRef: registration.implementation.ref,
      compiler: new GraphIntentCompiler(builtInGraphCompilerProfiles()),
      intent: {
        schemaVersion: 1,
        mode: "text-to-video",
        prompt: "A field of yellow flowers in a soft afternoon breeze",
        imageAssetIds: [],
        durationSeconds: 8,
        ratio: "16:9",
      },
    });

    expect(result.graphSnapshot.graphSha256).toBe(result.compiledGraph.graphSha256);
    expect(result.generationSpec.runtimeContractDigest).toBe(registration.runtimeContract.digest);
    expect(result.executionAuthorization).toBe("TRIAL_SCOPE_OWNER_AUTHORIZATION_REQUIRED");
    expect(result).toMatchObject({ externalCalls: 0, generationAuthorized: false });
  });
});
