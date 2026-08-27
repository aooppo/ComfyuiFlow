import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { ComfyUiMainlineExecutionService } from "@comfyuiflow/comfyui-bridge";
import { canonicalSha256 } from "@comfyuiflow/project-core";

const attemptId = "00000000-0000-4000-8000-000000000001";
const sha = "a".repeat(64);

function frozen() {
  const graph = {
    "1": { class_type: "LoadImage", inputs: { image: `comfyuiflow/staged/${sha}.png` } },
  };
  return {
    attemptId,
    attemptState: "SUBMITTING" as const,
    providerTaskId: "00000000-0000-4000-8000-000000000003",
    adapterRef: { id: "adapter.comfyui-mcp", version: "1.0.0" },
    runtimeRef: { id: "runtime.comfyui-mcp", version: "1.0.0" },
    runtimeContractDigest: "d".repeat(64),
    graphSha256: canonicalSha256(graph),
    graph,
    outputNodeId: "1",
    outputMediaKey: "video",
    inputs: [
      {
        localPath: "/verified/input.png",
        sha256: sha,
        stagedInputName: `comfyuiflow/staged/${sha}.png`,
      },
    ],
  };
}

describe("generation mainline MCP boundary", () => {
  it("accepts only frozen identity and submits the store-loaded graph", async () => {
    const record = frozen();
    const stageFrozenInput = vi.fn(async () => ({}));
    const submitFrozenGraph = vi.fn(async () => ({ promptId: record.providerTaskId }));
    const service = new ComfyUiMainlineExecutionService({
      store: { loadForSubmission: async () => record, loadSubmitted: async () => record },
      execution: { assertLiveEnabled: vi.fn(), stageFrozenInput, submitFrozenGraph } as any,
      recheckRuntimeContract: async () => ({ ready: true, blockers: [] }),
    });
    await expect(
      service.submit({
        attemptId: record.attemptId,
        adapterRef: record.adapterRef,
        runtimeRef: record.runtimeRef,
        runtimeContractDigest: record.runtimeContractDigest,
        graphSha256: record.graphSha256,
      }),
    ).resolves.toEqual({ taskId: record.providerTaskId });
    expect(stageFrozenInput).toHaveBeenCalledOnce();
    expect(submitFrozenGraph).toHaveBeenCalledWith({
      promptId: record.providerTaskId,
      materializedGraph: record.graph,
      materializedGraphSha256: record.graphSha256,
    });
  });

  it("blocks identity drift before staging or submission", async () => {
    const record = frozen();
    const stageFrozenInput = vi.fn();
    const submitFrozenGraph = vi.fn();
    const service = new ComfyUiMainlineExecutionService({
      store: { loadForSubmission: async () => record, loadSubmitted: async () => record },
      execution: { assertLiveEnabled: vi.fn(), stageFrozenInput, submitFrozenGraph } as any,
      recheckRuntimeContract: async () => ({ ready: true, blockers: [] }),
    });
    await expect(
      service.submit({
        attemptId: record.attemptId,
        adapterRef: record.adapterRef,
        runtimeRef: record.runtimeRef,
        runtimeContractDigest: record.runtimeContractDigest,
        graphSha256: "f".repeat(64),
      }),
    ).rejects.toThrow("MAINLINE_FROZEN_IDENTITY_MISMATCH");
    expect(stageFrozenInput).not.toHaveBeenCalled();
    expect(submitFrozenGraph).not.toHaveBeenCalled();
  });

  it("exposes only identity and digest fields at the submission boundary", async () => {
    const source = await readFile("apps/comfyui-mcp/src/server.ts", "utf8");
    const start = source.indexOf('"submit_generation_attempt"');
    const end = source.indexOf('"retain_generation_artifacts"', start);
    const tool = source.slice(start, end);
    expect(tool).toContain("runtimeContractDigest");
    expect(tool).toContain("graphSha256");
    expect(tool).not.toMatch(/materializedGraph:\s*z|rawGraph|graphJson|nodeMap|localPath/);
  });
});
