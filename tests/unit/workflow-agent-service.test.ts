import { describe, expect, it } from "vitest";
import {
  GenerationAdapterRegistry,
  WorkflowAgentService,
  computeShotRequirementHash,
} from "@comfyuiflow/project-core";
import type { GenerationImplementation, ShotRequirementSpecV2 } from "@comfyuiflow/contracts";

const implementation: GenerationImplementation = {
  implementationId: "ready-implementation",
  version: "1.0.0",
  providerId: "provider",
  modelProfileId: "model",
  executorType: "COMFYUI_GRAPH",
  adapterId: "adapter",
  adapterVersion: "1.0.0",
  defaultStatus: "READY",
  selectable: true,
  availabilityCode: "READY",
  capabilities: ["REFERENCE_TO_VIDEO", "FIRST_FRAME_TO_VIDEO", "PREVIOUS_FINAL_FRAME_TO_VIDEO"],
  referenceSlots: ["product", "first_frame"],
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
  nodeClasses: ["LoadImage"],
  pricing: {
    currency: "USD",
    estimatedCostMicros: 100,
    effectiveAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
  },
};
const registry = {
  document: {
    schemaVersion: "generation-registry-v1" as const,
    registryVersion: "test",
    providers: [
      {
        providerId: "provider",
        displayName: "Provider",
        authenticationProfileId: "auth",
        regions: ["test"],
        readinessCheckId: "ready",
      },
    ],
    models: [
      {
        modelProfileId: "model",
        providerId: "provider",
        modelFamily: "family",
        displayName: "Model",
        modelVersion: "1",
      },
    ],
    implementations: [implementation],
  },
  registrySha256: "b".repeat(64),
  providersById: new Map(),
  modelsById: new Map(),
  implementationsById: new Map([[implementation.implementationId, implementation]]),
};
const adapters = new GenerationAdapterRegistry([
  {
    adapterId: "adapter",
    adapterVersion: "1.0.0",
    executorType: "COMFYUI_GRAPH",
  } as never,
]);
const service = new WorkflowAgentService(registry, adapters);
const runtimeFacts = new Map([
  [
    "ready-implementation@1.0.0",
    {
      lifecycleStatus: "READY" as const,
      providerConfigured: true,
      readinessPassed: true,
      adapterImplemented: true,
      evidence: { passes: 10, attempts: 10 },
    },
  ],
]);
const compilationFacts = new Map([
  [
    "ready-implementation@1.0.0",
    { catalogReady: true, staticValidationPassed: true, preprocessingReady: true },
  ],
]);

function spec(ordinal: number, dependency?: ShotRequirementSpecV2["dependencies"][number]) {
  const shotKey = `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
  const unhashed = {
    schemaVersion: "shot-requirement-spec-v2" as const,
    projectId: "10000000-0000-4000-8000-000000000001",
    storyboardId: "10000000-0000-4000-8000-000000000002",
    storyboardVersionId: "10000000-0000-4000-8000-000000000003",
    generationPlanVersionId: "10000000-0000-4000-8000-000000000004",
    storyboardShotId: `20000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    shotKey,
    ordinal,
    startState: "start",
    action: "action",
    endState: "end",
    camera: "camera",
    composition: "composition",
    durationSeconds: 4,
    aspectRatio: "PORTRAIT_9_16" as const,
    references: [
      {
        assetVersionFileId: `30000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
        sha256: String(ordinal).repeat(64),
        semanticRole: "product",
      },
    ],
    dependencies: dependency ? [dependency] : [],
    modelSelection: { mode: "AUTO" as const },
  };
  return {
    ...unhashed,
    requirementHash: computeShotRequirementHash(unhashed),
  } as ShotRequirementSpecV2;
}

describe("Workflow Agent orchestration", () => {
  it("is byte-stable across 100 zero-call replans", () => {
    const shots = [{ generationSpecId: "40000000-0000-4000-8000-000000000001", spec: spec(1) }];
    const hashes = new Set(
      Array.from(
        { length: 100 },
        () =>
          service.plan({
            shots,
            runtimeFacts,
            compilationFacts,
            now: new Date("2026-08-26T00:00:00.000Z"),
          }).previewHash,
      ),
    );
    expect(hashes).toEqual(new Set([...hashes].slice(0, 1)));
    const result = service.plan({
      shots,
      runtimeFacts,
      compilationFacts,
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(result).toMatchObject({
      counts: { ready: 1, trial: 0, blocked: 0, waiting: 0 },
      externalCalls: 0,
      generationAuthorized: false,
    });
  });

  it("marks only downstream-compatible shots as waiting when an upstream plan is blocked", () => {
    const first = { ...spec(1), requirementHash: "f".repeat(64) };
    const secondKey = "00000000-0000-4000-8000-000000000002";
    const second = spec(2, {
      sourceShotKey: first.shotKey,
      targetShotKey: secondKey,
      type: "PREVIOUS_SHOT_FINAL_FRAME",
      importance: "HARD",
      requiredInputSlot: "first_frame",
    });
    const result = service.plan({
      shots: [
        { generationSpecId: "40000000-0000-4000-8000-000000000001", spec: first },
        { generationSpecId: "40000000-0000-4000-8000-000000000002", spec: second },
      ],
      runtimeFacts,
      compilationFacts,
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(result.shots.map((shot) => shot.planningOutcome)).toEqual([
      "BLOCKED",
      "WAITING_FOR_UPSTREAM_REPAIR",
    ]);
    expect(result.shots[0]?.blockerCodes).toContain("REQUIREMENT_HASH_MISMATCH");
  });
});
