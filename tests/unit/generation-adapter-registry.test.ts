import { describe, expect, it } from "vitest";
import {
  FakeGenerationProvider,
  GenerationAdapterError,
  createCapabilityAdapterFactoryRegistry,
  GenerationAdapterRegistry,
  LegacyGenerationProviderAdapter,
} from "@comfyuiflow/project-core";
import { AdapterProfileV2Schema } from "@comfyuiflow/contracts";

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

  it("builds the same exact generic ComfyUI adapter identity for Web and Worker", () => {
    const profile = AdapterProfileV2Schema.parse({
      id: "adapter.comfyui-mcp",
      version: "2.0.0",
      protocol: "comfyui-mcp-v2",
      factoryKey: "comfyui-mcp-v2",
      operations: ["READINESS", "SUBMIT", "STATUS", "CANCEL", "RECONCILE", "ARTIFACTS"],
    });
    const mcp = { callTool: async () => ({ ready: true, blockers: [] }) };
    const factories = createCapabilityAdapterFactoryRegistry();
    const web = factories.create(profile, { comfyUiMcp: mcp });
    const worker = factories.create(profile, { comfyUiMcp: mcp });
    expect({ id: web.adapterId, version: web.adapterVersion, type: web.executorType }).toEqual({
      id: worker.adapterId,
      version: worker.adapterVersion,
      type: worker.executorType,
    });
    expect(() =>
      createCapabilityAdapterFactoryRegistry().create(
        { ...profile, version: "2.0.1" },
        { comfyUiMcp: mcp },
      ),
    ).toThrow(/ADAPTER_NOT_IMPLEMENTED/);
  });

  it("rejects test-only production adapters and missing transport before dispatch", () => {
    const profile = AdapterProfileV2Schema.parse({
      id: "adapter.comfyui-mcp",
      version: "2.0.0",
      protocol: "comfyui-mcp-v2",
      factoryKey: "comfyui-mcp-v2",
      operations: ["READINESS", "SUBMIT", "STATUS", "CANCEL", "RECONCILE", "ARTIFACTS"],
    });
    const factories = createCapabilityAdapterFactoryRegistry();
    expect(() => factories.create(profile, {}, { production: true, testOnly: true })).toThrow(
      /PRE_DISPATCH_BLOCKED/,
    );
    expect(() => factories.create(profile, {})).toThrow(/PRE_DISPATCH_BLOCKED/);
  });
});
