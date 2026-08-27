import { describe, expect, it, vi } from "vitest";
import {
  ComfyUiClient,
  preflightZeroCallGraph,
  validateZeroCallComfyUiGraph,
  normalizeNodeCatalog,
} from "@comfyuiflow/comfyui-bridge";
import { GenerationLifecycleService, canonicalSha256 } from "@comfyuiflow/project-core";

const graph = {
  "1": { class_type: "LoadImage", inputs: { image: "source.png" } },
  "2": { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "result" } },
};
const graphSha256 = canonicalSha256(graph);
const runtimeContractDigest = "d".repeat(64);
const specId = "00000000-0000-4000-8000-000000000012";
const projectId = "00000000-0000-4000-8000-000000000013";

const objectInfo = {
  LoadImage: { input: { required: { image: ["STRING"] } }, output: ["IMAGE"] },
  SaveImage: {
    input: { required: { images: ["IMAGE"], filename_prefix: ["STRING"] } },
    output: [],
    output_node: true,
  },
};

describe("zero-call graph validator", () => {
  it("validates a persisted graph against a scoped catalog", () => {
    const catalog = normalizeNodeCatalog(objectInfo, ["LoadImage", "SaveImage"]);
    expect(
      validateZeroCallComfyUiGraph(graph, catalog, {
        expectedGraphSha256: graphSha256,
        outputNodeId: "2",
        outputMediaKey: "images",
      }),
    ).toMatchObject({ valid: true, graphSha256, generationCalls: 0, diagnostics: [] });
  });

  it("rejects graph drift and unsafe inputs without any network call", () => {
    const catalog = normalizeNodeCatalog(objectInfo, ["LoadImage", "SaveImage"]);
    const invalid = {
      ...graph,
      "1": { class_type: "LoadImage", inputs: { image: "https://unsafe.example/image.png" } },
    };
    const result = validateZeroCallComfyUiGraph(invalid, catalog, {
      expectedGraphSha256: graphSha256,
      outputNodeId: "2",
      outputMediaKey: "images",
    });
    expect(result.valid).toBe(false);
    expect(result.generationCalls).toBe(0);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["GRAPH_SHA_MISMATCH", "UNSAFE_INPUT_LITERAL"]),
    );
  });

  it("rejects a declared output that the runtime catalog does not mark as an output node", () => {
    const catalog = normalizeNodeCatalog(objectInfo, ["LoadImage", "SaveImage"]);
    const result = validateZeroCallComfyUiGraph(graph, catalog, {
      expectedGraphSha256: graphSha256,
      outputNodeId: "1",
      outputMediaKey: "images",
    });
    expect(result.valid).toBe(false);
    expect(result.generationCalls).toBe(0);
    expect(result.diagnostics.map((item) => item.code)).toContain("OUTPUT_NODE_NOT_DECLARED");
  });

  it("uses only runtime GET endpoints during a passing preflight", async () => {
    const requests: string[] = [];
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      const target = String(url);
      requests.push(target);
      if (target.endsWith("/system_stats"))
        return new Response(JSON.stringify({ system: { os: "macOS", python_version: "3.12" } }));
      if (target.endsWith("/object_info")) return new Response(JSON.stringify(objectInfo));
      throw new Error(`Unexpected request: ${target}`);
    });
    const result = await preflightZeroCallGraph(new ComfyUiClient("http://runtime", { fetch }), {
      graph,
      graphSha256,
      runtimeContractDigest,
      nodeClasses: ["LoadImage", "SaveImage"],
      outputNodeId: "2",
      outputMediaKey: "images",
    });
    expect(result).toMatchObject({ outcome: "PASS", generationCalls: 0, diagnostics: [] });
    expect(requests).toEqual(["http://runtime/system_stats", "http://runtime/object_info"]);
    expect(requests.join(" ")).not.toContain("/prompt");
  });

  it("fails closed on an unavailable runtime without reading the node catalog", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await preflightZeroCallGraph(new ComfyUiClient("http://runtime", { fetch }), {
      graph,
      graphSha256,
      runtimeContractDigest,
      nodeClasses: ["LoadImage", "SaveImage"],
      outputNodeId: "2",
      outputMediaKey: "images",
    });
    expect(result).toMatchObject({ outcome: "FAIL", generationCalls: 0 });
    expect(result.diagnostics[0]?.code).toBe("RUNTIME_UNREACHABLE");
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("authorized batch graph-evidence gate", () => {
  it("fails before any plan, authorization, batch, or attempt insert without matching PASS evidence", async () => {
    const query = vi.fn(async (...args: unknown[]) => {
      void args;
      return [{ generationSpecId: specId, graphSha256, runtimeContractDigest, evidenceId: null }];
    });
    const service = new GenerationLifecycleService({
      $transaction: async (callback: (tx: { $queryRawUnsafe: typeof query }) => Promise<unknown>) =>
        callback({ $queryRawUnsafe: query }),
    } as any);
    await expect(
      service.createAuthorizedBatch({
        projectId,
        planPayload: { name: "zero-call" },
        targetSpecIds: [specId],
        idempotencyKey: "evidence-required",
        authorization: {
          scope: { purpose: "test" },
          generationLimit: 1,
          aiQaLimit: 0,
          expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow("GRAPH_TECHNICAL_EVIDENCE_REQUIRED");
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0] ?? "")).toContain("GraphValidationEvidence");
    expect(String(query.mock.calls[0]?.[0] ?? "")).not.toContain('INSERT INTO "GenerationPlan"');
  });
});
