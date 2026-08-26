import { describe, expect, it } from "vitest";
import {
  compileHailuo03FirstLast,
  compileHailuo03Reference,
  compileHailuo03Text,
} from "@comfyuiflow/project-core";

const sha = "a".repeat(64);
const ref = { id: "compiler.hailuo03", version: "1.0.0" };
const media = (modality: "IMAGE" | "VIDEO" | "AUDIO", order: number, roleLabel: string) => ({
  sourceRef: { id: `asset.${modality.toLowerCase()}.${order}`, version: "1" },
  sha256: sha,
  modality,
  order,
  roleLabel,
  necessity: "REQUIRED" as const,
});
const input = (bindings: ReturnType<typeof media>[]) => ({
  compilerRef: ref,
  prompt: "A bounded provider-neutral prompt.",
  durationSeconds: 5,
  bindings,
});

describe("Hailuo 03 bounded compilers", () => {
  it("keeps text-to-video media-free", () => {
    expect(compileHailuo03Text(input([])).mediaInputs).toEqual([]);
    expect(() => compileHailuo03Text(input([media("IMAGE", 0, "product")]))).toThrow(
      "TEXT_TO_VIDEO_REJECTS_MEDIA",
    );
  });

  it("orders 0-9 images, 0-3 videos, and 0-3 audio with provider-native labels", () => {
    const result = compileHailuo03Reference(
      input([
        media("AUDIO", 0, "sound"),
        media("VIDEO", 0, "motion"),
        media("IMAGE", 1, "style"),
        media("IMAGE", 0, "product"),
      ]),
    );
    expect(result.mediaInputs.map((item) => item.label)).toEqual([
      "Image 1",
      "Image 2",
      "Video 1",
      "Audio 1",
    ]);
    expect(result.compiledRequestDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects empty and audio-only reference inputs", () => {
    expect(() => compileHailuo03Reference(input([]))).toThrow("VISUAL_REFERENCE_REQUIRED");
    expect(() => compileHailuo03Reference(input([media("AUDIO", 0, "sound")]))).toThrow(
      "AUDIO_REQUIRES_VISUAL_REFERENCE",
    );
  });

  it("requires an exact first frame and keeps last frame optional", () => {
    expect(
      compileHailuo03FirstLast(input([media("IMAGE", 0, "first-frame")])).mediaInputs.map(
        (item) => item.label,
      ),
    ).toEqual(["First Frame"]);
    expect(
      compileHailuo03FirstLast(
        input([media("IMAGE", 0, "first-frame"), media("IMAGE", 1, "last-frame")]),
      ).mediaInputs.map((item) => item.label),
    ).toEqual(["First Frame", "Last Frame"]);
  });
});
