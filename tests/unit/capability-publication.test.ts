import { describe, expect, it } from "vitest";
import {
  canonicalSha256,
  CapabilityPublicationService,
  prepareCapabilityPublication,
  type CapabilityPublicationStore,
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

const pack = { ...unsignedPack, expectedManifestSha256: canonicalSha256(unsignedPack) };

describe("Capability Pack publication", () => {
  it("freezes server-owned dependencies and opens every imported capability as TRIAL", () => {
    const registration = prepareCapabilityPublication(pack);

    expect(registration.capabilityRef).toEqual({
      id: "capability.seedance-reference-video",
      version: "1.0.0",
    });
    expect(registration.runtimeContract.ref).toEqual({
      id: "runtime-contract.seedance-reference-video",
      version: "1.0.0",
    });
    expect(registration.implementation).toMatchObject({
      lifecycle: "TRIAL",
      providerRef: { id: "provider.comfyui-mcp", version: "1.0.0" },
      adapterRef: { id: "adapter.comfyui-mcp", version: "1.0.0" },
      validatorRef: { id: "validator.zero-call-graph", version: "1.0.0" },
      modelRef: { id: "seedance-video", version: "2.0.0" },
    });
    expect(() =>
      prepareCapabilityPublication({
        ...pack,
        compilerProfile: "not-published",
        expectedManifestSha256: canonicalSha256({
          ...unsignedPack,
          compilerProfile: "not-published",
        }),
      }),
    ).toThrow("CAPABILITY_PACK_COMPILER_PROFILE_NOT_REGISTERED");
  });

  it("persists only a verified Pack receipt and makes no external call", async () => {
    const writes: { actorRef: string }[] = [];
    const store: CapabilityPublicationStore = {
      async appendTrialPublication({ actorRef }) {
        writes.push({ actorRef });
        return {
          receiptId: "6b4a4d51-605b-4e9d-a5c7-0d8e3ecec84f",
          createdAt: new Date("2026-08-27T00:00:00Z"),
        };
      },
    };
    const receipt = await new CapabilityPublicationService(store).publishTrial(pack, "ops.tj");

    expect(writes).toEqual([{ actorRef: "ops.tj" }]);
    expect(receipt).toMatchObject({ lifecycle: "TRIAL", externalCalls: 0, actorRef: "ops.tj" });
    await expect(
      new CapabilityPublicationService(store).publishTrial(
        { ...pack, expectedManifestSha256: "0".repeat(64) },
        "ops.tj",
      ),
    ).rejects.toThrow("CAPABILITY_PACK_DIGEST_MISMATCH");
  });
});
