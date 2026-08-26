import { describe, expect, it } from "vitest";
import { CapabilityCompilerRegistry } from "@comfyuiflow/project-core";

const profile = {
  id: "compiler.hailuo03-text",
  version: "1.0.0",
  compilerKey: "hailuo03-text-v1",
  inputContract: {
    modalities: {
      text: { min: 1, max: 1 },
      image: { min: 0, max: 0 },
      video: { min: 0, max: 0 },
      audio: { min: 0, max: 0 },
    },
    requiredNamedInputs: [],
    dynamicGroups: [],
    crossFieldInvariants: [],
    ordering: "MODALITY_CONNECTION_ORDER" as const,
    promptLabels: "PROVIDER_NATIVE_ORDINALS" as const,
    outputMediaType: "video/mp4" as const,
  },
  outputMappingKey: "comfyui-video-output-v1",
  sourceDigest: "a".repeat(64),
};
const input = {
  compilerRef: { id: profile.id, version: profile.version },
  prompt: "Safe bounded prompt",
  durationSeconds: 4,
  bindings: [],
};

describe("capability compiler security boundary", () => {
  it("rejects arbitrary graphs, endpoints, credentials, paths, and commands", () => {
    const registry = new CapabilityCompilerRegistry();
    for (const injection of [
      { rawGraph: {} },
      { endpoint: "http://private" },
      { credential: "secret" },
      { path: "/tmp/model" },
      { command: "curl example" },
      { nodeClass: "ArbitraryPython" },
    ])
      expect(() => registry.compile(profile, { ...input, ...injection })).toThrow();
  });

  it("returns a bounded non-executable preview", () => {
    const output = new CapabilityCompilerRegistry().compile(profile, input);
    expect(output).toMatchObject({
      schemaVersion: "compiled-request-preview-v3",
      operation: "VIDEO_GENERATION",
      mediaInputs: [],
    });
    expect(JSON.stringify(output)).not.toMatch(/rawGraph|endpoint|credential|command|nodeClass/);
  });
});
