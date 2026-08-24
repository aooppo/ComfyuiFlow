import { describe, expect, it, vi } from "vitest";
import { buildDiscovery } from "../../apps/spike-cli/src/discover.js";

describe("normalized discovery", () => {
  it("reports empty registry and unreachable endpoint as explicit zero-call blockers", async () => {
    const result = await buildDiscovery({
      listWorkflows: vi.fn().mockResolvedValue({ workflows: [], generationCalls: 0 }),
      getQueue: vi.fn().mockRejectedValue(new Error("unreachable")),
      checkReadiness: vi.fn(),
    });
    expect(result).toMatchObject({
      ready: false,
      endpointReachable: false,
      providerCalls: 0,
      generationCalls: 0,
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "NO_REGISTERED_WORKFLOW",
        "VIDEO_MODEL_UNVERIFIED",
        "COMFYUI_UNREACHABLE",
      ]),
    );
  });

  it("does not call a registered workflow ready when model readiness is blocked", async () => {
    const result = await buildDiscovery({
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: [{ workflowId: "video-one", enabled: true }],
        generationCalls: 0,
      }),
      getQueue: vi.fn().mockResolvedValue({ running: [], pending: [] }),
      checkReadiness: vi.fn().mockResolvedValue({
        workflowId: "video-one",
        ready: false,
        blockers: ["MODELS_MISSING"],
        generationCalls: 0,
      }),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("video-one:MODELS_MISSING");
    expect(result.generationCalls).toBe(0);
  });

  it("reports H3 readiness from the enabled workflow while retaining disabled history", async () => {
    const checkReadiness = vi.fn(async (workflowId: string) => ({
      workflowId,
      ready: workflowId === "minimax-h3-decorolala-validation-4s-v1",
      blockers: workflowId === "failed-v1" ? ["WORKFLOW_DISABLED"] : [],
      generationCalls: 0 as const,
    }));
    const result = await buildDiscovery({
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: [
          { workflowId: "failed-v1", enabled: false },
          { workflowId: "minimax-h3-reference-to-video", enabled: false },
          { workflowId: "minimax-h3-decorolala-ad-15s-v1", enabled: false },
          { workflowId: "minimax-h3-decorolala-validation-4s-v1", enabled: true },
        ],
        generationCalls: 0,
      }),
      getQueue: vi.fn().mockResolvedValue({ running: [], pending: [] }),
      checkReadiness,
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(checkReadiness).toHaveBeenCalledTimes(4);
    expect(result.workflowReadiness).toHaveLength(4);
  });
});
