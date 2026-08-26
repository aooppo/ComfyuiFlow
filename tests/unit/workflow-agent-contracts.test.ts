import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BatchCostSnapshotSchema,
  GenerationRegistrySchema,
  ShotExecutionPlanSchema,
  ShotRequirementSpecV2Schema,
  WorkflowAgentErrorCodeSchema,
  workflowAgentErrorCodes,
} from "@comfyuiflow/contracts";

const registry = JSON.parse(readFileSync(resolve("generation/registry.json"), "utf8"));

const uuid = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64);

describe("workflow agent contracts", () => {
  it("parses the additive generation registry and rejects unknown fields", () => {
    expect(GenerationRegistrySchema.parse(registry).implementations).toHaveLength(3);
    expect(() => GenerationRegistrySchema.parse({ ...registry, credential: "secret" })).toThrow();
  });

  it("keeps ShotRequirementSpec V2 provider-neutral and strict", () => {
    const value = {
      schemaVersion: "shot-requirement-spec-v2",
      projectId: uuid,
      storyboardId: uuid,
      storyboardVersionId: uuid,
      generationPlanVersionId: uuid,
      storyboardShotId: uuid,
      shotKey: uuid,
      ordinal: 1,
      startState: "start",
      action: "action",
      endState: "end",
      camera: "locked",
      composition: "centered",
      durationSeconds: 4,
      aspectRatio: "PORTRAIT_9_16",
      references: [],
      dependencies: [],
      modelSelection: { mode: "AUTO" },
      requirementHash: hash,
    } as const;
    expect(ShotRequirementSpecV2Schema.parse(value)).toEqual(value);
    expect(() => ShotRequirementSpecV2Schema.parse({ ...value, providerId: "hidden" })).toThrow();
  });

  it("uses an executor discriminant and never accepts a raw endpoint", () => {
    const base = {
      schemaVersion: "shot-execution-plan-v1",
      planId: uuid,
      projectId: uuid,
      generationPlanVersionId: uuid,
      generationSpecId: uuid,
      implementationId: "minimax-h3-reference-comfyui-partner-v1",
      implementationVersion: "1.0.0",
      adapterId: "comfyui-partner-h3-reference",
      adapterVersion: "1.0.0",
      planTemplateSha256: hash,
      estimatedCostMicros: 514800,
      maximumCostMicros: 514800,
      currency: "USD",
      inputBindings: [],
      executorType: "DIRECT_PROVIDER_API",
      endpointProfileVersion: "provider-endpoint-v1",
      safeRequestSnapshotHash: hash,
    } as const;
    expect(ShotExecutionPlanSchema.parse(base).executorType).toBe("DIRECT_PROVIDER_API");
    expect(() => ShotExecutionPlanSchema.parse({ ...base, endpoint: "https://secret" })).toThrow();
  });

  it("validates integer-micros ceilings and exposes required stable errors", () => {
    expect(() =>
      BatchCostSnapshotSchema.parse({
        schemaVersion: "batch-cost-snapshot-v1",
        currency: "USD",
        estimatedCostMicros: 20,
        maximumCostMicros: 10,
        generationCalls: 1,
        qaCalls: 0,
        pricingExpiresAt: "2026-09-01T00:00:00.000Z",
        retryPolicy: "NO_RETRY_NO_FALLBACK",
        snapshotHash: hash,
      }),
    ).toThrow();
    expect(workflowAgentErrorCodes).toContain("REPAIR_PROPOSAL_STALE");
    expect(WorkflowAgentErrorCodeSchema.parse("SUBMISSION_AMBIGUOUS")).toBe("SUBMISSION_AMBIGUOUS");
  });
});
