import { describe, expect, it } from "vitest";
import {
  FakeGenerationProvider,
  GenerationAdapterError,
  GenerationAdapterRegistry,
  LegacyGenerationProviderAdapter,
} from "@comfyuiflow/project-core";

describe("GenerationAdapterRegistry", () => {
  it("resolves the exact adapter version and rejects missing or duplicate entries", () => {
    const adapter = new LegacyGenerationProviderAdapter(new FakeGenerationProvider());
    const registry = new GenerationAdapterRegistry([adapter]);
    expect(registry.resolve(adapter.adapterId, adapter.adapterVersion)).toBe(adapter);
    expect(registry.resolveIdentity(adapter.adapterId, adapter.adapterVersion)).toBe(adapter);
    expect(() => registry.resolve(adapter.adapterId, "2.0.0")).toThrow(/ADAPTER_NOT_IMPLEMENTED/);
    expect(() => new GenerationAdapterRegistry([adapter, adapter])).toThrow(/duplicate/i);
  });

  it("registers planning-only identities without exposing a submit adapter", () => {
    const registry = new GenerationAdapterRegistry().registerIdentity({
      adapterId: "planning-only",
      adapterVersion: "1.0.0",
      executorType: "COMFYUI_GRAPH",
    });
    expect(registry.resolveIdentity("planning-only", "1.0.0")).toEqual({
      adapterId: "planning-only",
      adapterVersion: "1.0.0",
      executorType: "COMFYUI_GRAPH",
    });
    expect(() => registry.resolve("planning-only", "1.0.0")).toThrow(/ADAPTER_NOT_IMPLEMENTED/);
  });

  it("wraps V1 without changing its zero-call preflight and task identity", async () => {
    const provider = new FakeGenerationProvider();
    const adapter = new LegacyGenerationProviderAdapter(provider);
    await expect(adapter.checkReadiness()).resolves.toEqual({ ready: true, blockers: [] });
    const result = await adapter.submit({
      jobId: "job",
      providerIdempotencyKey: "11111111-1111-4111-8111-111111111111",
      plan: {
        engineVersion: "LEGACY_V1",
        workflowId: "fake-project-shot-4s-v1",
        compiledPrompt: "fixture",
        slots: [],
      },
    });
    expect(result.taskId).toBe("11111111-1111-4111-8111-111111111111");
    expect(provider.calls.submit).toBe(1);
  });

  it("classifies deterministic and ambiguous failures explicitly", () => {
    expect(new GenerationAdapterError("PRE_DISPATCH_BLOCKED", "no call").ambiguous).toBe(false);
    expect(new GenerationAdapterError("SUBMISSION_AMBIGUOUS", "unknown").ambiguous).toBe(true);
  });
});
