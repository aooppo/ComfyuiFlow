import { describe, expect, it, vi } from "vitest";
import { runWorkerLoop, workerPollInterval } from "../../apps/project-worker/src/worker-loop.js";

describe("project worker loop", () => {
  it("keeps polling until stopped and runs both queues each turn", async () => {
    let turns = 0;
    const analysis = vi.fn(async () => null);
    const generation = vi.fn(async () => ({ status: "COMPLETED" }));
    const wait = vi.fn(async () => {
      turns += 1;
    });

    await runWorkerLoop({
      once: false,
      pollIntervalMs: 750,
      shouldStop: () => turns === 2,
      runAnalysis: analysis,
      runGeneration: generation,
      onResult: vi.fn(),
      onError: vi.fn(),
      wait,
    });

    expect(analysis).toHaveBeenCalledTimes(2);
    expect(generation).toHaveBeenCalledTimes(2);
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
      onResult: vi.fn(),
      onError: vi.fn(),
      wait,
    });
    expect(wait).not.toHaveBeenCalled();
    expect(workerPollInterval("10")).toBe(250);
    expect(workerPollInterval("90000")).toBe(60_000);
    expect(workerPollInterval("invalid")).toBe(1_000);
  });
});
