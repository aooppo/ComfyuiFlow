import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { ComfyUiCapabilityV3ExecutionService } from "@comfyuiflow/comfyui-bridge";
import { CapabilityV3McpTransportClient, canonicalSha256 } from "@comfyuiflow/project-core";

const id = "00000000-0000-4000-8000-000000000001";
const sha = "a".repeat(64);

function frozen() {
  const materializedGraph = {
    "1": { class_type: "LoadImage", inputs: { image: `comfyuiflow/staged/${sha}.png` } },
  };
  return {
    attemptId: id,
    attemptState: "SUBMITTING",
    authorizationConsumptionId: "00000000-0000-4000-8000-000000000002",
    authorizationOperation: "SUBMIT" as const,
    authorizationAttemptId: id,
    providerTaskId: "00000000-0000-4000-8000-000000000003",
    referencePlanDigest: "b".repeat(64),
    materializedGraphSha256: canonicalSha256(materializedGraph),
    capabilityEnvelopeDigest: "c".repeat(64),
    runtimeContractDigest: "d".repeat(64),
    validationStatus: "VALID" as const,
    materializedGraph,
    outputNodeId: "1",
    outputMediaKey: "video" as const,
    inputs: [
      {
        localPath: "/verified/input.png",
        sha256: sha,
        stagedInputName: `comfyuiflow/staged/${sha}.png`,
      },
    ],
  };
}

describe("Capability V3 MCP frozen-plan boundary", () => {
  it("accepts only database identity and submits the store-loaded graph", async () => {
    const record = frozen();
    const stageFrozenInput = vi.fn(async () => ({}));
    const submitFrozenGraph = vi.fn(async () => ({ promptId: record.providerTaskId }));
    const service = new ComfyUiCapabilityV3ExecutionService({
      store: {
        loadForSubmission: async () => record,
        loadSubmitted: async () => record,
      },
      execution: {
        assertLiveEnabled: vi.fn(),
        stageFrozenInput,
        submitFrozenGraph,
      } as any,
      recheckRuntimeContract: async () => ({ ready: true, blockers: [] }),
    });
    await expect(
      service.submit({
        attemptId: record.attemptId,
        authorizationConsumptionId: record.authorizationConsumptionId,
        referencePlanDigest: record.referencePlanDigest,
        materializedGraphSha256: record.materializedGraphSha256,
        capabilityEnvelopeDigest: record.capabilityEnvelopeDigest,
        runtimeContractDigest: record.runtimeContractDigest,
      }),
    ).resolves.toMatchObject({ promptId: record.providerTaskId });
    expect(stageFrozenInput).toHaveBeenCalledOnce();
    expect(submitFrozenGraph).toHaveBeenCalledWith({
      promptId: record.providerTaskId,
      materializedGraph: record.materializedGraph,
      materializedGraphSha256: record.materializedGraphSha256,
    });
  });

  it("blocks identity drift before staging or submission", async () => {
    const record = frozen();
    const stageFrozenInput = vi.fn();
    const submitFrozenGraph = vi.fn();
    const service = new ComfyUiCapabilityV3ExecutionService({
      store: { loadForSubmission: async () => record, loadSubmitted: async () => record },
      execution: { assertLiveEnabled: vi.fn(), stageFrozenInput, submitFrozenGraph } as any,
      recheckRuntimeContract: async () => ({ ready: true, blockers: [] }),
    });
    await expect(
      service.submit({
        attemptId: record.attemptId,
        authorizationConsumptionId: record.authorizationConsumptionId,
        referencePlanDigest: record.referencePlanDigest,
        materializedGraphSha256: "f".repeat(64),
        capabilityEnvelopeDigest: record.capabilityEnvelopeDigest,
        runtimeContractDigest: record.runtimeContractDigest,
      }),
    ).rejects.toThrow("CAPABILITY_V3_FROZEN_IDENTITY_MISMATCH");
    expect(stageFrozenInput).not.toHaveBeenCalled();
    expect(submitFrozenGraph).not.toHaveBeenCalled();
  });

  it("uses ID-and-digest-only MCP calls and never sends raw graph JSON", async () => {
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const client = new CapabilityV3McpTransportClient({
      async callTool<T>(name: string, input: Record<string, unknown>): Promise<T> {
        calls.push({ name, input });
        return { promptId: "prompt-1" } as T;
      },
    });
    await client.submit({
      attemptId: id,
      authorizationConsumptionId: "00000000-0000-4000-8000-000000000002",
      referencePlanDigest: "b".repeat(64),
      materializedGraphSha256: "e".repeat(64),
      capabilityEnvelopeDigest: "c".repeat(64),
      runtimeContractDigest: "d".repeat(64),
    });
    expect(calls[0]?.name).toBe("comfyui_submit_capability_v3_attempt");
    expect(Object.keys(calls[0]?.input ?? {}).sort()).toEqual(
      [
        "attemptId",
        "authorizationConsumptionId",
        "referencePlanDigest",
        "materializedGraphSha256",
        "capabilityEnvelopeDigest",
        "runtimeContractDigest",
      ].sort(),
    );
    expect(JSON.stringify(calls[0]?.input)).not.toMatch(/class_type|rawGraph|graphJson|nodeMap/i);
  });

  it("does not expose raw graph fields in the MCP submission schema", async () => {
    const source = await readFile("apps/comfyui-mcp/src/server.ts", "utf8");
    const start = source.indexOf('"comfyui_submit_capability_v3_attempt"');
    const end = source.indexOf('"comfyui_get_capability_v3_attempt_status"', start);
    const tool = source.slice(start, end);
    expect(tool).toContain("materializedGraphSha256");
    expect(tool).not.toMatch(/materializedGraph:\s*z|rawGraph|graphJson|nodeMap/);
  });
});
