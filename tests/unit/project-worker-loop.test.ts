import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runWorkerLoop, workerPollInterval } from "../../apps/project-worker/src/worker-loop.js";

describe("project worker loop", () => {
  it("keeps polling until stopped and runs all queues each turn", async () => {
    let turns = 0;
    const analysis = vi.fn(async () => null);
    const generation = vi.fn(async () => ({ status: "COMPLETED" }));
    const director = vi.fn(async () => null);
    const wait = vi.fn(async () => {
      turns += 1;
    });

    await runWorkerLoop({
      once: false,
      pollIntervalMs: 750,
      shouldStop: () => turns === 2,
      runAnalysis: analysis,
      runGeneration: generation,
      runDirector: director,
      onResult: vi.fn(),
      onError: vi.fn(),
      wait,
    });

    expect(analysis).toHaveBeenCalledTimes(2);
    expect(generation).toHaveBeenCalledTimes(2);
    expect(director).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenNthCalledWith(1, 750);
  });

  it("supports an explicit one-turn mode and bounds the polling interval", async () => {
    const wait = vi.fn();
    await runWorkerLoop({
      once: true,
      pollIntervalMs: 1_000,
      shouldStop: () => false,
      runAnalysis: async () => null,
      runGeneration: async () => null,
      runDirector: async () => null,
      onResult: vi.fn(),
      onError: vi.fn(),
      wait,
    });
    expect(wait).not.toHaveBeenCalled();
    expect(workerPollInterval("10")).toBe(250);
    expect(workerPollInterval("90000")).toBe(60_000);
    expect(workerPollInterval("invalid")).toBe(1_000);
  });

  it("keeps the legacy engine while resolving Workflow Agent adapters per frozen target", async () => {
    const [worker, assembly] = await Promise.all([
      readFile("packages/project-core/src/generation-worker.ts", "utf8"),
      readFile("apps/project-worker/src/index.ts", "utf8"),
    ]);
    expect(worker).toContain('job.generationBatch.engineVersion === "WORKFLOW_AGENT_V1"');
    expect(worker).toContain("this.adapters.resolve(shotPlan.adapterId, shotPlan.adapterVersion)");
    expect(worker).toContain("return this.executeWorkflowAgent(job, reconciledOverride)");
    expect(worker).toContain("this.provider.submit({");
    expect(assembly).toContain("new GenerationAdapterRegistry");
    expect(assembly).toContain('"comfyui-partner-h3-reference"');
    expect(assembly).not.toContain("WORKFLOW_AGENT_PROVIDER_PROFILE");
  });
});
