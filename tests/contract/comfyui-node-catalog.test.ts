import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  allowlistedNodeInfo,
  nodeCatalogIsStale,
  normalizeNodeCatalog,
} from "@comfyuiflow/comfyui-bridge";

describe("scoped ComfyUI node catalog", () => {
  const raw = {
    LoadImage: {
      input: {
        required: { image: [["one.png", "two.png"], { default: "/private/input.png" }] },
        optional: { api_key: ["STRING", { default: "do-not-leak" }] },
      },
      output: ["IMAGE", "MASK"],
      python_module: "/Users/operator/custom_nodes/load.py",
    },
    SaveVideo: {
      input: {
        required: {
          images: ["IMAGE"],
          frame_rate: ["FLOAT", { min: 1, max: 120, default: 24 }],
          filename_prefix: ["STRING", { default: "/tmp/output" }],
        },
      },
      output: ["VIDEO"],
      auth_token: "secret",
    },
    ArbitraryShellNode: { input: {}, output: [] },
  };

  it("normalizes only allowlisted node contracts and removes secret/path defaults", () => {
    const catalog = normalizeNodeCatalog(raw, ["SaveVideo", "LoadImage"]);
    expect(catalog.nodes.map((node) => node.className)).toEqual(["LoadImage", "SaveVideo"]);
    expect(allowlistedNodeInfo(catalog, "ArbitraryShellNode")).toBeNull();
    expect(JSON.stringify(catalog)).not.toMatch(
      /do-not-leak|private|operator|\/tmp|api_key|auth_token/i,
    );
    expect(catalog.nodes[1]?.inputs.find((field) => field.name === "frame_rate")).toMatchObject({
      type: "FLOAT",
      minimum: 1,
      maximum: 120,
    });
  });

  it("produces a scoped deterministic hash and detects stale catalogs", () => {
    const first = normalizeNodeCatalog(raw, ["LoadImage", "SaveVideo"]);
    const reordered = normalizeNodeCatalog(raw, ["SaveVideo", "LoadImage", "LoadImage"]);
    const narrower = normalizeNodeCatalog(raw, ["LoadImage"]);
    expect(first.catalogSha256).toBe(reordered.catalogSha256);
    expect(narrower.catalogSha256).not.toBe(first.catalogSha256);
    expect(nodeCatalogIsStale(first, first.catalogSha256)).toBe(false);
    expect(nodeCatalogIsStale(first, "0".repeat(64))).toBe(true);
  });

  it("keeps the exact current First/Last catalog fixture redacted and non-secret", async () => {
    const fixture = JSON.parse(
      await readFile(
        "tests/fixtures/comfyui/minimax-hailuo03-first-last-frame-node.catalog.json",
        "utf8",
      ),
    );
    expect(fixture.nodes).toEqual([
      expect.objectContaining({
        className: "MinimaxHailuo03FirstLastFrameNode",
        outputs: ["VIDEO"],
      }),
    ]);
    expect(fixture.nodes[0].inputs.map((item: any) => item.name)).toEqual([
      "first_frame",
      "last_frame",
      "model",
      "seed",
      "watermark",
    ]);
    expect(JSON.stringify(fixture)).not.toMatch(
      /secret|token|password|api[_-]?key|endpoint|\/Users\/|127\.0\.0\.1/i,
    );
  });
});
