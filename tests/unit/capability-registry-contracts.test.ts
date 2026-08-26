import { describe, expect, it } from "vitest";
import {
  AdapterProfileV2Schema,
  CompilerProfileV2Schema,
  CostPolicyV2Schema,
  GenerationAuthorizationV3Schema,
  GenerationImplementationV2Schema,
  GenerationSpecV3Schema,
  InputContractV2Schema,
  PlanningInputSnapshotV3Schema,
  ProviderProfileV2Schema,
  RuntimeProfileV2Schema,
  ShotRequirementSpecV3Schema,
} from "@comfyuiflow/contracts";

const id = "8fd62386-445f-4d9f-a337-087cbc201575";
const hash = "a".repeat(64);
const ref = (value: string) => ({ id: value, version: "1.0.0" });

describe("capability workflow contracts", () => {
  it("keeps runtime, provider, adapter, and compiler identities strict and secret-free", () => {
    expect(() =>
      RuntimeProfileV2Schema.parse({
        ...ref("runtime.local-comfyui"),
        name: "Local ComfyUI",
        kind: "COMFYUI_MCP",
        connectionRef: "runtime.local",
        enabled: true,
        rawEndpoint: "http://127.0.0.1:8188",
      }),
    ).toThrow();
    expect(() =>
      ProviderProfileV2Schema.parse({
        ...ref("provider.partner"),
        name: "Partner",
        kind: "COMFYUI_PARTNER",
        authorityRef: "partner-account",
        credentialRef: "secret-ref",
        enabled: true,
        apiKey: "must-not-be-stored",
      }),
    ).toThrow();
    expect(
      AdapterProfileV2Schema.parse({
        ...ref("adapter.comfyui-mcp"),
        protocol: "comfyui-mcp-v2",
        factoryKey: "comfyui-mcp-v2",
        operations: ["READINESS", "SUBMIT", "STATUS", "CANCEL", "RECONCILE", "ARTIFACTS"],
      }),
    ).toMatchObject({ factoryKey: "comfyui-mcp-v2" });
  });

  it("represents cross-input invariants and honest monetary/local/test cost policies", () => {
    expect(
      InputContractV2Schema.parse({
        modalities: {
          text: { min: 1, max: 1 },
          image: { min: 0, max: 9 },
          video: { min: 0, max: 3 },
          audio: { min: 0, max: 3 },
        },
        crossFieldInvariants: ["IMAGE_OR_VIDEO_REQUIRED", "AUDIO_REQUIRES_IMAGE_OR_VIDEO"],
        ordering: "MODALITY_CONNECTION_ORDER",
        promptLabels: "PROVIDER_NATIVE_ORDINALS",
        outputMediaType: "video/mp4",
      }),
    ).toMatchObject({ modalities: { image: { max: 9 } } });
    expect(
      CostPolicyV2Schema.parse({
        kind: "LOCAL_COMPUTE",
        resourceClass: "apple-mps",
        estimate: { unit: "GPU_SECONDS", amount: 120 },
      }),
    ).toMatchObject({ kind: "LOCAL_COMPUTE" });
    expect(() => CostPolicyV2Schema.parse({ kind: "MONETARY", currency: "USD" })).toThrow();
  });

  it("binds an implementation to exact independent versions and forbids mutable lifecycle aliases", () => {
    const implementation = GenerationImplementationV2Schema.parse({
      ...ref("implementation.h3-reference"),
      runtimeRef: ref("runtime.local-comfyui"),
      providerRef: ref("provider.partner"),
      modelRef: ref("model.hailuo03"),
      adapterRef: ref("adapter.comfyui-mcp"),
      compilerRef: ref("compiler.h3-reference"),
      capabilityCodes: ["ORDERED_REFERENCE_TO_VIDEO"],
      costPolicy: {
        kind: "MONETARY",
        currency: "USD",
        pricingVersion: "2026-08-26",
        estimatedCostMicros: 1000000,
        maximumCostMicros: 1000000,
        effectiveAt: "2026-08-26T00:00:00.000Z",
        expiresAt: "2026-08-27T00:00:00.000Z",
      },
      lifecycle: "TRIAL",
      evidencePolicy: "EXACT_VERSION_REAL_RESULT",
      testOnly: false,
    });
    expect(implementation.runtimeRef.id).not.toBe(implementation.providerRef.id);
    expect(() =>
      GenerationImplementationV2Schema.parse({ ...implementation, lifecycle: "BLOCKED" }),
    ).toThrow();
  });

  it("freezes requirements, input snapshots, Generation Specs, and authorization without raw bypass", () => {
    const requirement = ShotRequirementSpecV3Schema.parse({
      id,
      version: "1",
      shotId: id,
      storyboardRevisionRef: ref(id),
      purposes: [
        {
          purpose: "CHARACTER",
          necessity: "OMITTED",
          reasonCode: "NO_EXPLICIT_CHARACTER_NEED",
          constraints: [],
        },
      ],
      requirementHash: hash,
    });
    const snapshot = PlanningInputSnapshotV3Schema.parse({
      id,
      version: "1",
      requirementSpecRef: ref(id),
      implementationRef: ref("implementation.h3-text"),
      compilerRef: ref("compiler.h3-text"),
      bindings: [],
      omittedRequirementCodes: ["NO_EXPLICIT_CHARACTER_NEED"],
      unresolvedRequirementCodes: [],
      sourceDigest: hash,
      capabilityDigest: hash,
      snapshotHash: hash,
    });
    expect(requirement.purposes[0]?.necessity).toBe("OMITTED");
    expect(snapshot.bindings).toEqual([]);

    const generationSpec = GenerationSpecV3Schema.parse({
      id,
      version: "1",
      shotId: id,
      storyboardRevisionRef: ref(id),
      requirementSpecRef: ref(id),
      planningInputSnapshotRef: ref(id),
      implementationRef: ref("implementation.h3-text"),
      runtimeRef: ref("runtime.local-comfyui"),
      providerRef: ref("provider.partner"),
      modelRef: ref("model.hailuo03"),
      adapterRef: ref("adapter.comfyui-mcp"),
      compilerRef: ref("compiler.h3-text"),
      generationIntent: { prompt: "A quiet empty room", durationSeconds: 4 },
      compiledRequestDigest: hash,
      expectedOutput: { mediaType: "video/mp4", width: 768, height: 1344, fps: 24 },
      inputHash: hash,
      dependencyHash: hash,
      outputHash: hash,
    });
    expect(() => GenerationSpecV3Schema.parse({ ...generationSpec, rawGraph: {} })).toThrow();

    expect(
      GenerationAuthorizationV3Schema.parse({
        id,
        planDigest: hash,
        shotIds: [id],
        generationSpecRefs: [ref(id)],
        implementationRefs: [ref("implementation.h3-text")],
        providerRefs: [ref("provider.partner")],
        expectedCalls: 1,
        maximumCalls: 1,
        costPolicyDigest: hash,
        maximumCostMicros: 1000000,
        expiresAt: "2026-08-27T00:00:00.000Z",
        noRetry: true,
        noFallback: true,
        consumedCalls: 0,
        state: "ACTIVE",
      }),
    ).toMatchObject({ maximumCalls: 1, noRetry: true });
  });

  it("requires compiler profiles to be bounded and credential-free", () => {
    expect(() =>
      CompilerProfileV2Schema.parse({
        ...ref("compiler.h3-reference"),
        compilerKey: "hailuo03-reference-v1",
        inputContract: {
          modalities: {
            text: { min: 1, max: 1 },
            image: { min: 0, max: 9 },
            video: { min: 0, max: 3 },
            audio: { min: 0, max: 3 },
          },
          crossFieldInvariants: ["IMAGE_OR_VIDEO_REQUIRED"],
          ordering: "MODALITY_CONNECTION_ORDER",
          promptLabels: "PROVIDER_NATIVE_ORDINALS",
          outputMediaType: "video/mp4",
        },
        outputMappingKey: "comfyui-video-output-v1",
        sourceDigest: hash,
        credential: "secret",
      }),
    ).toThrow();
  });
});
