import { describe, expect, it } from "vitest";
import { discoverNodeCapabilities, normalizeNodeCatalog } from "@comfyuiflow/comfyui-bridge";

const source = {
  HailuoReferenceNode: {
    input: {
      required: { prompt: ["STRING"] },
      optional: {
        image_1: ["IMAGE"],
        image_2: ["IMAGE"],
        video_1: ["VIDEO"],
        audio_1: ["AUDIO"],
        api_key: ["STRING", { default: "must-not-leak" }],
      },
    },
    output: ["VIDEO"],
    provider_token: "must-not-leak",
  },
};

describe("controlled capability discovery", () => {
  it("keeps stable redacted provenance and dynamic modality cardinality without granting readiness", () => {
    const first = discoverNodeCapabilities(source, ["HailuoReferenceNode"], {
      id: "runtime.local-comfyui",
      version: "1.0.0",
    });
    const reordered = discoverNodeCapabilities(
      { HailuoReferenceNode: source.HailuoReferenceNode },
      ["HailuoReferenceNode"],
      { id: "runtime.local-comfyui", version: "1.0.0" },
    );
    expect(first).toEqual(reordered);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      status: "DISCOVERED",
      nodeIdentifier: "HailuoReferenceNode",
      dynamicGroups: [
        { modality: "AUDIO", prefix: "audio", min: 0, max: 1 },
        { modality: "IMAGE", prefix: "image", min: 0, max: 2 },
        { modality: "VIDEO", prefix: "video", min: 0, max: 1 },
      ],
      rawSchemaRef: expect.stringMatching(/^raw-schema\.[a-f0-9]{64}$/),
      sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("provider_token");
    expect(serialized).not.toContain("providerRef");
    expect(serialized).not.toContain("costPolicy");
    expect(serialized).not.toContain("READY");
  });

  it("creates a different digest and version when the normalized node schema changes", () => {
    const before = discoverNodeCapabilities(source, ["HailuoReferenceNode"], {
      id: "runtime.local-comfyui",
      version: "1.0.0",
    })[0]!;
    const changed = structuredClone(source);
    (changed.HailuoReferenceNode.input.optional as Record<string, unknown>).image_3 = ["IMAGE"];
    const after = discoverNodeCapabilities(changed, ["HailuoReferenceNode"], {
      id: "runtime.local-comfyui",
      version: "1.0.0",
    })[0]!;
    expect(after.sourceDigest).not.toBe(before.sourceDigest);
    expect(after.version).not.toBe(before.version);
    expect(after.dynamicGroups.find((group) => group.modality === "IMAGE")?.max).toBe(3);
  });

  it("hashes catalogs canonically instead of depending on object key order", () => {
    const left = normalizeNodeCatalog(source, ["HailuoReferenceNode"]);
    const right = normalizeNodeCatalog({ HailuoReferenceNode: source.HailuoReferenceNode }, [
      "HailuoReferenceNode",
    ]);
    expect(right.sourceSha256).toBe(left.sourceSha256);
    expect(right.catalogSha256).toBe(left.catalogSha256);
  });
});
