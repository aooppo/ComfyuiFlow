import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  ComfyUiExecutionPlanService,
  type ComfyUiExecutionPlanStore,
  type FrozenComfyUiExecutionRecord,
} from "@comfyuiflow/comfyui-bridge";
import { ComfyUiExecutionPlanAdapter, GenerationAdapterRegistry } from "@comfyuiflow/project-core";

const sha = (value: string) => value.repeat(64).slice(0, 64);

describe("Workflow Agent ComfyUI adapter", () => {
  it("dispatches only frozen identity and hashes, never local paths or graph JSON", async () => {
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const promptId = randomUUID();
    const mcp = {
      async callTool(name: string, input: Record<string, unknown>) {
        calls.push({ name, input });
        return { promptId };
      },
    };
    const adapter = new ComfyUiExecutionPlanAdapter("registered-adapter", "1.0.0", mcp);
    const registry = new GenerationAdapterRegistry([adapter]);
    const materializedExecutionSha256 = sha("b");
    const plan = await registry.resolve("registered-adapter", "1.0.0").compileExecutionPlan({
      engineVersion: "WORKFLOW_AGENT_V1",
      executionPlanId: randomUUID(),
      executionPlanSha256: sha("c"),
      authorizationConsumptionId: randomUUID(),
      payload: {
        executionInputSnapshot: { materializedExecutionSha256 },
        localPath: "/must/not/cross/the/tool/boundary.png",
        graph: { "1": { class_type: "Unsafe" } },
      },
    });
    await adapter.submit({ jobId: randomUUID(), providerIdempotencyKey: promptId, plan });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("comfyui_submit_execution_plan");
    expect(Object.keys(calls[0]?.input ?? {}).sort()).toEqual([
      "authorizationConsumptionId",
      "executionPlanId",
      "executionPlanSha256",
      "generationJobId",
      "materializedExecutionSha256",
    ]);
    expect(JSON.stringify(calls[0]?.input)).not.toMatch(/localPath|must\/not|class_type|graph/);
  });

  it("rechecks plan, authorization, materialized SHA and stages paths only inside the bridge", async () => {
    const identity = {
      executionPlanId: randomUUID(),
      executionPlanSha256: sha("d"),
      generationJobId: randomUUID(),
      authorizationConsumptionId: randomUUID(),
      materializedExecutionSha256: sha("e"),
    };
    const record: FrozenComfyUiExecutionRecord = {
      ...identity,
      lifecycleStatus: "FROZEN",
      executorType: "COMFYUI_GRAPH",
      generationJobStatus: "RUNNING",
      authorizationOperation: "GENERATION_SUBMIT",
      authorizationGenerationJobId: identity.generationJobId,
      authorizationMaterializedPlanSha256: identity.materializedExecutionSha256,
      workflowId: "trusted-workflow",
      workflowSha256: sha("f"),
      providerTaskId: randomUUID(),
      compiledPrompt: "A non-empty frozen prompt",
      durationSeconds: 4,
      width: 768,
      height: 1344,
      fps: 24,
      outputPrefix: "comfyuiflow/project/plan/shot-01",
      inputs: [
        { role: "SCENE", localPath: "/internal/scene.png", sha256: sha("1") },
        { role: "CHARACTER_FULL_BODY", localPath: "/internal/character.png", sha256: sha("2") },
      ],
    };
    const store: ComfyUiExecutionPlanStore = {
      loadForSubmission: vi.fn(async () => record),
      loadSubmitted: vi.fn(async () => record),
    };
    const stageInput = vi.fn(async (input: any) => ({
      name: `${input.role}.png`,
      subfolder: "comfyuiflow",
      type: "input",
      sourceSha256: input.expectedSha256,
      role: input.role,
    }));
    const submitPreauthorized = vi.fn(async () => ({
      promptId: record.providerTaskId,
      queueNumber: 1,
      nodeErrors: {},
    }));
    const service = new ComfyUiExecutionPlanService({
      store,
      execution: { stageInput, submitPreauthorized, assertLiveEnabled: () => undefined } as any,
      recheckReadiness: async () => ({ ready: true, blockers: [] }),
    });
    await expect(service.submit(identity)).resolves.toMatchObject({
      promptId: record.providerTaskId,
    });
    expect(stageInput).toHaveBeenCalledWith(
      expect.objectContaining({ localPath: "/internal/scene.png" }),
    );
    expect(submitPreauthorized).toHaveBeenCalledTimes(1);
    await expect(
      service.submit({ ...identity, materializedExecutionSha256: sha("0") }),
    ).rejects.toThrow("IDENTITY_MISMATCH");
    expect(submitPreauthorized).toHaveBeenCalledTimes(1);
  });

  it("fails closed before staging when real submission is disabled but keeps status query-only", async () => {
    const identity = {
      executionPlanId: randomUUID(),
      executionPlanSha256: sha("3"),
      generationJobId: randomUUID(),
      authorizationConsumptionId: randomUUID(),
      materializedExecutionSha256: sha("4"),
    };
    const record = {
      ...identity,
      lifecycleStatus: "FROZEN",
      executorType: "COMFYUI_GRAPH",
      generationJobStatus: "RUNNING",
      authorizationOperation: "GENERATION_SUBMIT",
      authorizationGenerationJobId: identity.generationJobId,
      authorizationMaterializedPlanSha256: identity.materializedExecutionSha256,
      workflowId: "trusted-workflow",
      workflowSha256: sha("5"),
      providerTaskId: randomUUID(),
      compiledPrompt: "prompt",
      durationSeconds: 4,
      width: 768,
      height: 1344,
      fps: 24,
      outputPrefix: "comfyuiflow/project/plan/shot-01",
      inputs: [
        { role: "SCENE", localPath: "/internal/scene.png", sha256: sha("6") },
        { role: "CHARACTER_FULL_BODY", localPath: "/internal/character.png", sha256: sha("7") },
      ],
    } as FrozenComfyUiExecutionRecord;
    const stageInput = vi.fn();
    const status = vi.fn(async () => ({
      promptId: record.providerTaskId,
      status: "IN_PROGRESS",
      outputCount: 0,
      artifacts: [],
    }));
    const service = new ComfyUiExecutionPlanService({
      store: { loadForSubmission: async () => record, loadSubmitted: async () => record },
      execution: {
        assertLiveEnabled: () => {
          throw new Error("ComfyUI LIVE is disabled");
        },
        stageInput,
        status,
      } as any,
      recheckReadiness: async () => ({ ready: true, blockers: [] }),
    });
    await expect(service.submit(identity)).rejects.toThrow("LIVE is disabled");
    expect(stageInput).not.toHaveBeenCalled();
    await expect(service.status(identity.generationJobId)).resolves.toMatchObject({
      status: "IN_PROGRESS",
    });
    expect(status).toHaveBeenCalledWith(record.providerTaskId);
  });
});
