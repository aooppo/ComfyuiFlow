import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveSafeOutputPrefix,
  loadTrustedGraphFile,
  normalizeNodeCatalog,
  validateComfyUiGraph,
} from "@comfyuiflow/comfyui-bridge";

const catalog = normalizeNodeCatalog(
  {
    LoadImage: { input: { required: { image: ["STRING"] } }, output: ["IMAGE"] },
    Prompt: { input: { required: { text: ["STRING"] } }, output: ["CONDITIONING"] },
    SaveVideo: {
      input: {
        required: { images: ["IMAGE"], filename_prefix: ["STRING"] },
        optional: { conditioning: ["CONDITIONING"] },
      },
      output: ["VIDEO"],
    },
  },
  ["LoadImage", "Prompt", "SaveVideo"],
);

const validGraph = {
  "1": { class_type: "LoadImage", inputs: { image: "input.png" } },
  "2": { class_type: "Prompt", inputs: { text: "A real prompt" } },
  "3": {
    class_type: "SaveVideo",
    inputs: {
      images: ["1", 0],
      conditioning: ["2", 0],
      filename_prefix: "comfyuiflow/project/plan/shot-01",
    },
  },
};

describe("trusted ComfyUI graph validation", () => {
  it("accepts an allowlisted typed DAG and makes no prompt call", () => {
    expect(validateComfyUiGraph(validGraph, catalog, { outputNodeId: "3" })).toMatchObject({
      valid: true,
      edgeCount: 2,
      generationCalls: 0,
    });
  });

  it.each([
    [
      "class",
      { ...validGraph, "2": { class_type: "Shell", inputs: {} } },
      "NODE_CLASS_NOT_ALLOWED",
    ],
    [
      "field",
      { ...validGraph, "1": { class_type: "LoadImage", inputs: { image: "x", path: "/tmp" } } },
      "INPUT_FIELD_NOT_ALLOWED",
    ],
    [
      "type",
      { ...validGraph, "2": { class_type: "Prompt", inputs: { text: 42 } } },
      "INPUT_TYPE_INVALID",
    ],
    [
      "empty prompt",
      { ...validGraph, "2": { class_type: "Prompt", inputs: { text: "   " } } },
      "INPUT_TYPE_INVALID",
    ],
    [
      "edge",
      {
        ...validGraph,
        "3": { class_type: "SaveVideo", inputs: { images: ["99", 0], filename_prefix: "safe" } },
      },
      "EDGE_SOURCE_MISSING",
    ],
    [
      "edge type",
      {
        ...validGraph,
        "3": {
          class_type: "SaveVideo",
          inputs: { images: ["2", 0], filename_prefix: "safe" },
        },
      },
      "EDGE_TYPE_INVALID",
    ],
    [
      "unsafe URL",
      {
        ...validGraph,
        "2": { class_type: "Prompt", inputs: { text: "https://untrusted.example/payload" } },
      },
      "UNSAFE_INPUT_LITERAL",
    ],
    ["output", validGraph, "OUTPUT_NODE_MISSING"],
  ])("rejects invalid %s data", (_name, graph, expected) => {
    const outputNodeId = expected === "OUTPUT_NODE_MISSING" ? "99" : "3";
    expect(validateComfyUiGraph(graph, catalog, { outputNodeId }).errors.join(" ")).toContain(
      expected,
    );
  });

  it("rejects cycles and unsafe prefixes", () => {
    const cyclicCatalog = normalizeNodeCatalog(
      { Join: { input: { required: { input: ["IMAGE"] } }, output: ["IMAGE"] } },
      ["Join"],
    );
    const graph = {
      "1": { class_type: "Join", inputs: { input: ["2", 0] } },
      "2": { class_type: "Join", inputs: { input: ["1", 0] } },
    };
    expect(validateComfyUiGraph(graph, cyclicCatalog, { outputNodeId: "2" }).errors).toContain(
      "GRAPH_CYCLE",
    );
    expect(deriveSafeOutputPrefix("project-id", "plan-id", 1)).toBe(
      "comfyuiflow/project-id/plan-id/shot-01",
    );
    expect(() => deriveSafeOutputPrefix("project", "plan", 0)).toThrow("OUTPUT_PREFIX_INVALID");
  });

  it("rejects nodes that cannot reach the registered retained output", () => {
    const graph = {
      ...validGraph,
      "4": { class_type: "Prompt", inputs: { text: "orphan prompt" } },
    };
    expect(validateComfyUiGraph(graph, catalog, { outputNodeId: "3" }).errors).toContain(
      "ORPHAN_NODE:4",
    );
  });

  it("confines graph files to the registry root and rejects symlink targets", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-graph-"));
    const outside = join(root, "..", `outside-${Date.now()}.json`);
    const registry = join(root, "registry.json");
    await writeFile(registry, "{}");
    await writeFile(join(root, "valid.json"), JSON.stringify(validGraph));
    await writeFile(outside, JSON.stringify(validGraph));
    await symlink(outside, join(root, "link.json"));
    await expect(loadTrustedGraphFile(registry, "valid.json")).resolves.toMatchObject({
      graph: validGraph,
    });
    await expect(loadTrustedGraphFile(registry, "../escape.json")).rejects.toThrow(
      "WORKFLOW_PATH_ESCAPE",
    );
    await expect(loadTrustedGraphFile(registry, "link.json")).rejects.toThrow(
      "WORKFLOW_PATH_UNTRUSTED",
    );
  });
});
