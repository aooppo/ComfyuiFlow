import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  AdapterRegistry,
  GenerationWorker,
  LIVE_TEST_A_SCENE_SHA256,
  createLiveTestAPreview,
  freezeGenerationSpec,
  materializeGraph,
  type CapabilityProfile,
} from "@comfyuiflow/project-core";

const ref = (id: string) => ({ id, version: "1.0.0" });
const digest = "a".repeat(64);

function profile(): CapabilityProfile {
  const capability = ref("capability.video");
  return {
    ref: capability,
    schemaVersion: 1,
    runtimeContracts: [
      { ref: ref("runtime.local"), capabilityRef: capability, nodeClasses: ["VideoNode"], digest },
    ],
    implementations: [
      {
        ref: ref("implementation.video"),
        capabilityRef: capability,
        runtimeRef: ref("runtime.local"),
        providerRef: ref("provider.local"),
        modelRef: ref("model.video"),
        adapterRef: ref("adapter.comfyui"),
        compilerRef: ref("compiler.video"),
        validatorRef: ref("validator.video"),
        lifecycle: "TRIAL",
      },
    ],
  };
}

describe("CapabilityRegistry", () => {
  it("freezes a cross-validated implementation and deterministic graph", () => {
    const registry = new CapabilityRegistry([profile()]);
    const spec = freezeGenerationSpec(registry, ref("implementation.video"), { prompt: "cup" });
    const first = materializeGraph(spec, { "1": { class_type: "VideoNode" } });
    const second = materializeGraph(spec, { "1": { class_type: "VideoNode" } });
    expect(spec.runtimeContractDigest).toBe(digest);
    expect(first.graphSha256).toBe(second.graphSha256);
    expect(first.generationSpecDigest).toBe(second.generationSpecDigest);
  });

  it("rejects a RuntimeContract owned by a different capability", () => {
    const broken = profile();
    broken.runtimeContracts[0]!.capabilityRef = ref("capability.other");
    expect(() => new CapabilityRegistry([broken])).toThrow("RUNTIME_CONTRACT_OWNERSHIP_MISMATCH");
  });
});

describe("AdapterRegistry", () => {
  it("requires the exact adapter and RuntimeContract pair", () => {
    const adapter = {
      adapterRef: ref("adapter.comfyui"),
      runtimeRef: ref("runtime.local"),
      submit: async () => ({ taskId: "task" }),
      status: async () => "PENDING" as const,
      reconcile: async () => "PENDING" as const,
      retain: async () => [],
      cancel: async () => ({ cancelled: false, remoteTerminationConfirmed: false }),
    };
    const registry = new AdapterRegistry([adapter]);
    expect(
      registry.resolve({ adapterRef: ref("adapter.comfyui"), runtimeRef: ref("runtime.local") }),
    ).toBe(adapter);
    expect(() =>
      registry.resolve({ adapterRef: ref("adapter.comfyui"), runtimeRef: ref("runtime.other") }),
    ).toThrow("ADAPTER_NOT_IMPLEMENTED");
  });
});

describe("GenerationWorker", () => {
  it("consumes before exactly one submission and makes submission uncertainty terminal", async () => {
    const calls: string[] = [];
    const attempt = {
      attemptId: "attempt",
      adapterRef: ref("adapter.comfyui"),
      runtimeRef: ref("runtime.local"),
      runtimeContractDigest: digest,
      graphSha256: digest,
      state: "QUEUED" as const,
    };
    const adapters = new AdapterRegistry([
      {
        adapterRef: ref("adapter.comfyui"),
        runtimeRef: ref("runtime.local"),
        submit: async () => {
          calls.push("submit");
          throw new Error("transport");
        },
        status: async () => "PENDING" as const,
        reconcile: async () => "PENDING" as const,
        retain: async () => [],
        cancel: async () => ({ cancelled: false, remoteTerminationConfirmed: false }),
      },
    ]);
    const worker = new GenerationWorker(adapters, {
      claimReconciliation: async () => null,
      claimNext: async () => attempt,
      consumeBeforeSubmit: async () => {
        calls.push("consume");
        return true;
      },
      markSubmitted: async () => {
        calls.push("submitted");
      },
      markTerminal: async () => {
        calls.push("terminal");
      },
      markReconciled: async () => {
        calls.push("reconciled");
      },
    });
    await expect(worker.runOnce()).resolves.toMatchObject({ state: "AMBIGUOUS" });
    expect(calls).toEqual(["consume", "submit", "terminal"]);
  });

  it("never resubmits an unknown reconciliation", async () => {
    const calls: string[] = [];
    const attempt = {
      attemptId: "attempt",
      adapterRef: ref("adapter.comfyui"),
      runtimeRef: ref("runtime.local"),
      runtimeContractDigest: digest,
      graphSha256: digest,
      state: "RECONCILING" as const,
      taskId: "task",
    };
    const adapters = new AdapterRegistry([
      {
        adapterRef: ref("adapter.comfyui"),
        runtimeRef: ref("runtime.local"),
        submit: async () => {
          calls.push("submit");
          return { taskId: "new" };
        },
        status: async () => "UNKNOWN" as const,
        reconcile: async () => "UNKNOWN" as const,
        retain: async () => [],
        cancel: async () => ({ cancelled: false, remoteTerminationConfirmed: false }),
      },
    ]);
    const worker = new GenerationWorker(adapters, {
      claimReconciliation: async () => attempt,
      claimNext: async () => null,
      consumeBeforeSubmit: async () => false,
      markSubmitted: async () => {
        calls.push("submitted");
      },
      markTerminal: async () => {
        calls.push("terminal");
      },
      markReconciled: async () => {
        calls.push("reconciled");
      },
    });
    await expect(worker.runOnce()).resolves.toMatchObject({ state: "AMBIGUOUS" });
    expect(calls).toEqual(["terminal"]);
  });

  it("makes an already-consumed leased attempt terminal instead of resubmitting", async () => {
    const calls: string[] = [];
    const attempt = {
      attemptId: "attempt",
      adapterRef: ref("adapter.comfyui"),
      runtimeRef: ref("runtime.local"),
      runtimeContractDigest: digest,
      graphSha256: digest,
      state: "QUEUED" as const,
    };
    const adapters = new AdapterRegistry([
      {
        adapterRef: ref("adapter.comfyui"),
        runtimeRef: ref("runtime.local"),
        submit: async () => {
          calls.push("submit");
          return { taskId: "new" };
        },
        status: async () => "PENDING" as const,
        reconcile: async () => "PENDING" as const,
        retain: async () => [],
        cancel: async () => ({ cancelled: false, remoteTerminationConfirmed: false }),
      },
    ]);
    const worker = new GenerationWorker(adapters, {
      claimReconciliation: async () => null,
      claimNext: async () => attempt,
      consumeBeforeSubmit: async () => false,
      markSubmitted: async () => undefined,
      markTerminal: async (_id, code) => {
        calls.push(code);
      },
      markReconciled: async () => undefined,
    });
    await expect(worker.runOnce()).resolves.toMatchObject({ state: "CONSUMPTION_REJECTED" });
    expect(calls).toEqual(["AUTHORIZATION_CONSUMPTION_REJECTED"]);
  });
});

describe("createLiveTestAPreview", () => {
  it("proves exact facts without creating an authorization or external call", () => {
    const registry = new CapabilityRegistry([profile()]);
    const spec = freezeGenerationSpec(registry, ref("implementation.video"), { prompt: "cup" });
    const graph = materializeGraph(spec, { "1": { class_type: "VideoNode" } });
    const preview = createLiveTestAPreview({
      facts: {
        workerStopped: true,
        noActiveBatch: true,
        sourceSha256: LIVE_TEST_A_SCENE_SHA256,
        mcpHealthy: true,
        runtimeHealthy: true,
        providerHealthy: true,
        aiQaHealthy: true,
        generationPriceMicros: 100,
        aiQaPriceMicros: 20,
        pricesExpireAt: "2030-01-01T00:00:00.000Z",
      },
      spec,
      graph,
      now: new Date("2029-01-01T00:00:00.000Z"),
    });
    expect(preview).toMatchObject({
      shotOrdinal: 1,
      totalMaximumCostMicros: 120,
      generationMaximumCostMicros: 100,
      aiQaMaximumCostMicros: 20,
      implementationRef: spec.implementationRef,
      runtimeContractDigest: spec.runtimeContractDigest,
      confirmationRequired: true,
      retryAllowed: false,
    });
  });

  it("blocks a preview with expired price facts", () => {
    const registry = new CapabilityRegistry([profile()]);
    const spec = freezeGenerationSpec(registry, ref("implementation.video"), { prompt: "cup" });
    const graph = materializeGraph(spec, { "1": { class_type: "VideoNode" } });
    expect(() =>
      createLiveTestAPreview({
        facts: {
          workerStopped: true,
          noActiveBatch: true,
          sourceSha256: LIVE_TEST_A_SCENE_SHA256,
          mcpHealthy: true,
          runtimeHealthy: true,
          providerHealthy: true,
          aiQaHealthy: true,
          generationPriceMicros: 100,
          aiQaPriceMicros: 20,
          pricesExpireAt: "2020-01-01T00:00:00.000Z",
        },
        spec,
        graph,
        now: new Date("2029-01-01T00:00:00.000Z"),
      }),
    ).toThrow("PRICE_EXPIRED");
  });

  it("blocks any source other than the verified red-cup scene file", () => {
    const registry = new CapabilityRegistry([profile()]);
    const spec = freezeGenerationSpec(registry, ref("implementation.video"), { prompt: "cup" });
    const graph = materializeGraph(spec, { "1": { class_type: "VideoNode" } });
    expect(() =>
      createLiveTestAPreview({
        facts: {
          workerStopped: true,
          noActiveBatch: true,
          sourceSha256: digest,
          mcpHealthy: true,
          runtimeHealthy: true,
          providerHealthy: true,
          aiQaHealthy: true,
          generationPriceMicros: 100,
          aiQaPriceMicros: 20,
          pricesExpireAt: "2030-01-01T00:00:00.000Z",
        },
        spec,
        graph,
        now: new Date("2029-01-01T00:00:00.000Z"),
      }),
    ).toThrow("SOURCE_HASH_MISMATCH");
  });
});
