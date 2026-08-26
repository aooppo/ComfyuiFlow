import { describe, expect, it } from "vitest";
import type {
  GenerationImplementation,
  GenerationRequirements,
  ShotRequirementSpecV2,
} from "@comfyuiflow/contracts";
import type { LoadedGenerationRegistry } from "../../packages/project-core/src/workflow-agent/registry.js";
import {
  selectStoryboardImplementations,
  wilsonLowerBound,
  type ShotCandidateSet,
} from "../../packages/project-core/src/workflow-agent/implementation-selector.js";
import { resolveImplementationCandidates } from "../../packages/project-core/src/workflow-agent/capability-resolver.js";

function implementation(
  id: string,
  providerId: string,
  modelProfileId: string,
): GenerationImplementation {
  return {
    implementationId: id,
    version: "1.0.0",
    providerId,
    modelProfileId,
    executorType: "COMFYUI_GRAPH",
    adapterId: `${id}-adapter`,
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
    referenceWorkflowIds: [id],
    referenceWorkflowSha256: "a".repeat(64),
    patternIds: [],
    nodeClasses: [],
    pricing: {
      currency: "USD",
      estimatedCostMicros: 100,
      effectiveAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-09-01T00:00:00.000Z",
    },
  };
}

const a = implementation("a", "provider-a", "model-a");
const b = implementation("b", "provider-b", "model-b");
const shot = (shotKey: string, candidates: ShotCandidateSet["candidates"]): ShotCandidateSet => ({
  shotKey,
  ordinal: Number(shotKey),
  selection: { mode: "AUTO" },
  candidates,
});

describe("Workflow Agent implementation selector", () => {
  it("computes the 95 percent Wilson lower bound", () => {
    expect(wilsonLowerBound(8, 10)).toBeCloseTo(0.4902, 3);
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("optimizes the storyboard with switching penalties and stable ties", () => {
    const choice = selectStoryboardImplementations([
      shot("1", [
        {
          implementation: a,
          lifecycleStatus: "READY",
          evidence: { passes: 9, attempts: 10 },
          latencyMs: 500,
        },
        {
          implementation: b,
          lifecycleStatus: "READY",
          evidence: { passes: 8, attempts: 10 },
          latencyMs: 500,
        },
      ]),
      shot("2", [
        {
          implementation: b,
          lifecycleStatus: "READY",
          evidence: { passes: 9, attempts: 10 },
          latencyMs: 500,
        },
        {
          implementation: a,
          lifecycleStatus: "READY",
          evidence: { passes: 8, attempts: 10 },
          latencyMs: 500,
        },
      ]),
    ]);
    expect(choice.map((item) => item.implementation.implementationId)).toEqual(["a", "a"]);
    expect(choice[1]?.selectionReason.switchPenalty).toBe(0);
  });

  it("honors LOCKED then ordered PREFERRED before AUTO", () => {
    const locked = selectStoryboardImplementations([
      {
        ...shot("1", [
          { implementation: a, lifecycleStatus: "READY" },
          { implementation: b, lifecycleStatus: "READY" },
        ]),
        selection: { mode: "LOCKED", providerId: "provider-b", modelProfileId: "model-b" },
      },
    ]);
    expect(locked[0]?.implementation.implementationId).toBe("b");
    const preferred = selectStoryboardImplementations([
      {
        ...shot("1", [
          { implementation: a, lifecycleStatus: "READY" },
          { implementation: b, lifecycleStatus: "READY" },
        ]),
        selection: { mode: "PREFERRED", preferredModelFamilies: ["family-b", "family-a"] },
        modelFamilyByProfile: new Map([
          ["model-a", "family-a"],
          ["model-b", "family-b"],
        ]),
      },
    ]);
    expect(preferred[0]?.implementation.implementationId).toBe("b");
  });

  it("hard-filters capabilities, pricing, readiness, and adapters before scoring", () => {
    const registry = {
      document: {
        schemaVersion: "generation-registry-v1",
        registryVersion: "test",
        providers: [],
        models: [
          {
            modelProfileId: "model-a",
            providerId: "provider-a",
            modelFamily: "family-a",
            displayName: "A",
            modelVersion: "1",
          },
        ],
        implementations: [a],
      },
      registrySha256: "a".repeat(64),
      providersById: new Map(),
      modelsById: new Map(),
      implementationsById: new Map(),
    } as unknown as LoadedGenerationRegistry;
    const spec = {
      shotKey: "00000000-0000-4000-8000-000000000001",
      ordinal: 1,
      durationSeconds: 4,
      aspectRatio: "PORTRAIT_9_16",
      modelSelection: { mode: "AUTO" },
    } as unknown as ShotRequirementSpecV2;
    const requirements = {
      requiredCapabilities: [{ capability: "REFERENCE_TO_VIDEO", importance: "HARD" }],
      optionalCapabilities: [],
      requiredInputSlots: ["product"],
      blockers: [],
    } as unknown as GenerationRequirements;
    const blocked = resolveImplementationCandidates({
      spec,
      requirements,
      registry,
      runtimeFacts: new Map([["a@1.0.0", { lifecycleStatus: "READY", adapterImplemented: false }]]),
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(blocked.candidateSet.candidates).toEqual([]);
    expect(blocked.blockerCodes).toContain("ADAPTER_NOT_IMPLEMENTED");
    const ready = resolveImplementationCandidates({
      spec,
      requirements,
      registry,
      runtimeFacts: new Map([
        [
          "a@1.0.0",
          {
            lifecycleStatus: "READY",
            adapterImplemented: true,
            providerConfigured: true,
            readinessPassed: true,
          },
        ],
      ]),
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(ready.candidateSet.candidates).toHaveLength(1);
    const missingCapability = resolveImplementationCandidates({
      spec,
      requirements: {
        ...requirements,
        requiredCapabilities: [{ capability: "AUDIO_DRIVEN_VIDEO", importance: "HARD" }],
      },
      registry,
      runtimeFacts: new Map([["a@1.0.0", { lifecycleStatus: "READY" }]]),
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(missingCapability.blockerCodes).toContain("REQUIRED_CAPABILITY_UNAVAILABLE");
    const missingCredential = resolveImplementationCandidates({
      spec,
      requirements,
      registry,
      runtimeFacts: new Map([["a@1.0.0", { lifecycleStatus: "READY", providerConfigured: false }]]),
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(missingCredential.blockerCodes).toContain("PROVIDER_NOT_CONFIGURED");
    const noPriceRegistry = {
      ...registry,
      document: { ...registry.document, implementations: [{ ...a, pricing: null }] },
    } as LoadedGenerationRegistry;
    const missingPrice = resolveImplementationCandidates({
      spec,
      requirements,
      registry: noPriceRegistry,
      runtimeFacts: new Map([["a@1.0.0", { lifecycleStatus: "READY" }]]),
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(missingPrice.blockerCodes).toContain("COST_UNAVAILABLE");
  });
});
