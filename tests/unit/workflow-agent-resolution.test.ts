import { describe, expect, it } from "vitest";
import type { GenerationImplementation } from "@comfyuiflow/contracts";
import { GenerationAdapterRegistry } from "../../packages/project-core/src/generation-adapter.js";
import { compileDirectRequestTemplate } from "../../packages/project-core/src/workflow-agent/direct-request-compiler.js";
import { resolveExecutionPattern } from "../../packages/project-core/src/workflow-agent/pattern-resolver.js";
import { validatePlanningCandidate } from "../../packages/project-core/src/workflow-agent/validator.js";

const base = {
  implementationId: "implementation",
  version: "1.0.0",
  providerId: "provider",
  modelProfileId: "model",
  adapterId: "adapter",
  adapterVersion: "1.0.0",
  defaultStatus: "READY",
  selectable: true,
  availabilityCode: "READY",
  capabilities: ["REFERENCE_TO_VIDEO"],
  referenceSlots: ["product"],
  constraints: {
    durationSeconds: { min: 4, max: 4 },
    width: 768,
    height: 1344,
    fps: 24,
    aspectRatios: ["PORTRAIT_9_16"],
  },
  referenceWorkflowIds: ["workflow"],
  referenceWorkflowSha256: "a".repeat(64),
  patternIds: [],
  nodeClasses: [],
  pricing: {
    currency: "USD",
    estimatedCostMicros: 100,
    effectiveAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
  },
} as unknown as Omit<GenerationImplementation, "executorType">;

describe("Workflow Agent compiler resolution", () => {
  it("prefers a READY reference workflow and gates TRIAL on a real pattern", () => {
    const ready = resolveExecutionPattern(
      {
        implementation: { ...base, executorType: "COMFYUI_GRAPH" } as GenerationImplementation,
        lifecycleStatus: "READY",
      },
      { catalogReady: true, staticValidationPassed: true, preprocessingReady: true },
    );
    expect(ready).toMatchObject({
      outcome: "READY",
      sourceType: "REFERENCE_WORKFLOW",
      sourceId: "workflow",
      blockerCodes: [],
    });
    const trial = resolveExecutionPattern(
      {
        implementation: {
          ...base,
          executorType: "COMFYUI_GRAPH",
          referenceWorkflowIds: [],
          referenceWorkflowSha256: undefined,
          patternIds: ["pattern"],
        } as GenerationImplementation,
        lifecycleStatus: "TRIAL",
      },
      { catalogReady: false, staticValidationPassed: true, preprocessingReady: true },
    );
    expect(trial.outcome).toBe("BLOCKED");
    expect(trial.blockerCodes).toContain("CATALOG_STALE");
  });

  it("compiles only registered direct requests and excludes credential-shaped fields", () => {
    const implementation = {
      ...base,
      executorType: "DIRECT_PROVIDER_API",
      referenceWorkflowIds: [],
      referenceWorkflowSha256: undefined,
    } as GenerationImplementation;
    const endpointProfiles = new Map([
      [
        "adapter@1.0.0",
        {
          endpointProfileVersion: "endpoint-v1",
          adapterId: "adapter",
          adapterVersion: "1.0.0",
          allowedFields: ["prompt", "duration"],
        },
      ],
    ]);
    const first = compileDirectRequestTemplate({
      implementation,
      endpointProfiles,
      request: { duration: 4, prompt: "safe" },
    });
    const second = compileDirectRequestTemplate({
      implementation,
      endpointProfiles,
      request: { prompt: "safe", duration: 4 },
    });
    expect(first.safeRequestSnapshotHash).toBe(second.safeRequestSnapshotHash);
    expect(() =>
      compileDirectRequestTemplate({
        implementation,
        endpointProfiles,
        request: { apiKey: "secret" },
      }),
    ).toThrow("PRE_DISPATCH_BLOCKED");
    expect(() =>
      compileDirectRequestTemplate({
        implementation,
        endpointProfiles: new Map(),
        request: { prompt: "safe" },
      }),
    ).toThrow("ADAPTER_NOT_IMPLEMENTED");
    expect(() =>
      compileDirectRequestTemplate({
        implementation: { ...implementation, pricing: null },
        endpointProfiles,
        request: { prompt: "safe" },
      }),
    ).toThrow("COST_UNAVAILABLE");
  });

  it("blocks missing adapters before dispatch", () => {
    const implementation = { ...base, executorType: "COMFYUI_GRAPH" } as GenerationImplementation;
    const pattern = resolveExecutionPattern(
      { implementation, lifecycleStatus: "READY" },
      { catalogReady: true, staticValidationPassed: true, preprocessingReady: true },
    );
    expect(
      validatePlanningCandidate({
        implementation,
        pattern,
        adapterRegistry: new GenerationAdapterRegistry(),
        now: new Date("2026-08-26T00:00:00.000Z"),
      }),
    ).toEqual({ planningOutcome: "BLOCKED", blockerCodes: ["ADAPTER_NOT_IMPLEMENTED"] });
  });
});
