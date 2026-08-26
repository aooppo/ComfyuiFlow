import { describe, expect, it } from "vitest";
import {
  HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
  HAILUO03_DYNAMIC_COMPILER_REF,
  HAILUO03_RUNTIME_CONTRACT_DIGEST,
  buildReferencePlanV3,
  freezeHailuo03GraphSnapshot,
  materializeHailuo03ReferenceGraph,
  validateHailuo03MaterializedGraph,
} from "@comfyuiflow/project-core";

const shotId = "10000000-0000-4000-8000-000000000001";
const storyboardVersionId = "10000000-0000-4000-8000-000000000002";
const generationSpecId = "10000000-0000-4000-8000-000000000003";
const implementationRef = { id: "implementation.hailuo03-reference-dynamic", version: "3.0.0" };
const adapterRef = { id: "adapter.comfyui-mcp", version: "2.0.0" };
const runtimeRef = { id: "runtime.comfyui-local", version: "1.0.0" };
const sha = (index: number) => index.toString(16).padStart(64, "0");
const uuid = (index: number) => `20000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;

function binding(modality: "IMAGE" | "VIDEO" | "AUDIO", index: number) {
  const purpose = modality === "VIDEO" ? "MOTION" : modality === "AUDIO" ? "AUDIO" : "ENVIRONMENT";
  return {
    id: uuid(index + 1),
    purpose: purpose as "MOTION" | "AUDIO" | "ENVIRONMENT",
    sourceKind: "SEMANTIC_ASSET_VERSION" as const,
    sourceRef: { id: `asset.${modality.toLowerCase()}.${index}`, version: "1" },
    sha256: sha(index + 1),
    modality,
    order: index,
    roleLabel:
      modality === "VIDEO" ? "reference-video" : modality === "AUDIO" ? "reference-audio" : "scene",
    necessity: "REQUIRED" as const,
  };
}

function plan(input?: {
  images?: number;
  videos?: number;
  audios?: number;
  durationSeconds?: number;
  aspectRatio?: "adaptive" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
  resolution?: "768P" | "2K";
}) {
  const images = input?.images ?? 1;
  const videos = input?.videos ?? 0;
  const audios = input?.audios ?? 0;
  return buildReferencePlanV3({
    shotId,
    storyboardVersionId,
    generationSpecId,
    implementationRef,
    compilerRef: HAILUO03_DYNAMIC_COMPILER_REF,
    durationSeconds: input?.durationSeconds ?? 4,
    aspectRatio: input?.aspectRatio ?? "9:16",
    resolution: input?.resolution ?? "768P",
    seed: 20260826,
    watermark: false,
    prompt: "A deterministic project Shot.",
    bindings: [
      ...Array.from({ length: images }, (_, index) => binding("IMAGE", index)),
      ...Array.from({ length: videos }, (_, index) => binding("VIDEO", 20 + index)),
      ...Array.from({ length: audios }, (_, index) => binding("AUDIO", 40 + index)),
    ].reverse(),
  });
}

describe("dynamic Hailuo 03 Graph compiler", () => {
  it.each([1, 5, 9])("materializes %i ordered image loaders", (images) => {
    const result = materializeHailuo03ReferenceGraph(plan({ images }));
    expect(
      Object.values(result.materializedGraph).filter((node) => node.class_type === "LoadImage"),
    ).toHaveLength(images);
    expect(result.capabilityEnvelopeDigest).toBe(HAILUO03_CAPABILITY_ENVELOPE_DIGEST);
    expect(result.materializedGraphSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateHailuo03MaterializedGraph(result)).toMatchObject({
      status: "VALID",
      blockerCodes: [],
      externalCalls: 0,
    });
  });

  it.each([
    [0, 1, 0],
    [1, 3, 0],
    [1, 0, 3],
    [9, 3, 3],
  ])("materializes image=%i video=%i audio=%i", (images, videos, audios) => {
    const result = materializeHailuo03ReferenceGraph(plan({ images, videos, audios }));
    const nodes = Object.values(result.materializedGraph);
    expect(nodes.filter((node) => node.class_type === "LoadImage")).toHaveLength(images);
    expect(nodes.filter((node) => node.class_type === "LoadVideo")).toHaveLength(videos);
    expect(nodes.filter((node) => node.class_type === "LoadAudio")).toHaveLength(audios);
    expect(validateHailuo03MaterializedGraph(result).status).toBe("VALID");
  });

  it.each([4, 5, 10, 15])("supports %i-second duration", (durationSeconds) => {
    expect(
      validateHailuo03MaterializedGraph(
        materializeHailuo03ReferenceGraph(plan({ durationSeconds })),
      ).status,
    ).toBe("VALID");
  });

  it.each(["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"] as const)(
    "supports %s ratio",
    (aspectRatio) => {
      expect(
        validateHailuo03MaterializedGraph(materializeHailuo03ReferenceGraph(plan({ aspectRatio })))
          .status,
      ).toBe("VALID");
    },
  );

  it.each(["768P", "2K"] as const)("supports %s resolution", (resolution) => {
    expect(
      validateHailuo03MaterializedGraph(materializeHailuo03ReferenceGraph(plan({ resolution })))
        .status,
    ).toBe("VALID");
  });

  it("produces identical canonical bytes and SHA in 100 runs", () => {
    const referencePlan = plan({
      images: 5,
      videos: 2,
      audios: 2,
      durationSeconds: 10,
      resolution: "2K",
    });
    const results = Array.from({ length: 100 }, () =>
      materializeHailuo03ReferenceGraph(referencePlan),
    );
    expect(new Set(results.map((result) => result.materializedGraphCanonicalJson)).size).toBe(1);
    expect(new Set(results.map((result) => result.materializedGraphSha256)).size).toBe(1);
  });

  it.each([
    ["images", { images: 10 }, "HAILUO_IMAGE_LIMIT_EXCEEDED"],
    ["videos", { images: 1, videos: 4 }, "HAILUO_VIDEO_LIMIT_EXCEEDED"],
    ["audios", { images: 1, audios: 4 }, "HAILUO_AUDIO_LIMIT_EXCEEDED"],
    ["empty", { images: 0 }, "HAILUO_VISUAL_REFERENCE_REQUIRED"],
    ["audio only", { images: 0, audios: 1 }, "HAILUO_AUDIO_REQUIRES_VISUAL_REFERENCE"],
  ])("blocks invalid %s", (_name, counts, code) => {
    const raw = { ...plan(), bindings: plan(counts).bindings };
    expect(() => materializeHailuo03ReferenceGraph(raw)).toThrow(code);
  });

  it.each([
    ["duration", { durationSeconds: 16 }, "HAILUO_DURATION_UNSUPPORTED"],
    ["ratio", { aspectRatio: "2:1" }, "HAILUO_RATIO_UNSUPPORTED"],
    ["resolution", { resolution: "4K" }, "HAILUO_RESOLUTION_UNSUPPORTED"],
    ["raw graph", { rawGraph: {} }, "HAILUO_EXECUTABLE_INPUT_FORBIDDEN"],
  ])("blocks unsupported %s before Graph creation", (_name, mutation, code) => {
    expect(() => materializeHailuo03ReferenceGraph({ ...plan(), ...mutation })).toThrow(code);
  });

  it("freezes the validated Graph and detects runtime contract drift", () => {
    const referencePlan = plan({ images: 1, videos: 1, audios: 1, durationSeconds: 15 });
    const materialized = materializeHailuo03ReferenceGraph(referencePlan);
    expect(
      freezeHailuo03GraphSnapshot({
        plan: referencePlan,
        materialized,
        generationSpecRef: { id: generationSpecId, version: "spec-v1" },
        implementationRef,
        adapterRef,
        runtimeRef,
      }),
    ).toMatchObject({
      materializedGraphSha256: materialized.materializedGraphSha256,
      runtimeContractDigest: HAILUO03_RUNTIME_CONTRACT_DIGEST,
      validation: { status: "VALID" },
    });
    expect(validateHailuo03MaterializedGraph(materialized, "f".repeat(64)).blockerCodes).toContain(
      "HAILUO_RUNTIME_CONTRACT_DRIFT",
    );
  });
});
