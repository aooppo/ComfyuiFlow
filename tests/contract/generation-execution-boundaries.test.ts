import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  ComfyUiMcpGenerationProvider,
  GENERIC_H3_WORKFLOW_ID,
  GENERIC_H3_WORKFLOW_SHA256,
} from "@comfyuiflow/project-core";

describe("generation execution provider boundaries", () => {
  it("uses only registered MCP tools for readiness, staging, submission, polling, and cancellation", async () => {
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const provider = new ComfyUiMcpGenerationProvider({
      async callTool(name, input) {
        calls.push({ name, input });
        if (name === "comfyui_check_readiness") return { ready: true } as never;
        if (name === "comfyui_stage_input")
          return {
            name: `${input.role}.png`,
            subfolder: "project",
            type: "input",
            sourceSha256: input.expectedSha256,
            role: input.role,
          } as never;
        if (name === "comfyui_submit_project_workflow")
          return { promptId: input.promptId } as never;
        if (name === "comfyui_get_job_status") return { status: "COMPLETED" } as never;
        if (name === "comfyui_cancel_job") return { cancelled: true } as never;
        return {} as never;
      },
    });
    expect(await provider.preflight()).toEqual({ ready: true, blockers: [] });
    const promptId = crypto.randomUUID();
    await provider.submit({
      jobId: crypto.randomUUID(),
      promptId,
      workflowId: GENERIC_H3_WORKFLOW_ID,
      compiledPrompt: "six-section compiled prompt",
      grantId: crypto.randomUUID(),
      slots: ["SCENE", "PRODUCT", "CHARACTER_FULL_BODY", "CHARACTER_FACE", "CHARACTER_REAR"].map(
        (role) => ({
          role,
          projectAssetId: crypto.randomUUID(),
          assetVersionFileId: crypto.randomUUID(),
          productionAssetVersionId: crypto.randomUUID(),
          characterStateVersionId: null,
          sha256: "a".repeat(64),
          displayName: role,
          localPath: `/verified/${role}.png`,
        }),
      ),
    } as never);
    expect(await provider.status(promptId)).toBe("COMPLETED");
    expect(await provider.cancel(promptId)).toEqual({
      cancelled: true,
      remoteTerminationConfirmed: true,
    });
    expect(calls.map((call) => call.name)).toEqual([
      "comfyui_check_readiness",
      "comfyui_stage_input",
      "comfyui_stage_input",
      "comfyui_stage_input",
      "comfyui_stage_input",
      "comfyui_stage_input",
      "comfyui_submit_project_workflow",
      "comfyui_get_job_status",
      "comfyui_cancel_job",
    ]);
    const submission = calls.find((call) => call.name === "comfyui_submit_project_workflow")?.input;
    expect(submission).toMatchObject({
      workflowId: GENERIC_H3_WORKFLOW_ID,
      workflowSha256: GENERIC_H3_WORKFLOW_SHA256,
    });
    expect(JSON.stringify(calls)).not.toContain("http://");
    expect(JSON.stringify(calls)).not.toContain("https://");
  });

  it("does not expose arbitrary workflow or endpoint fields", () => {
    expect(vi.isMockFunction(globalThis.fetch)).toBe(false);
    expect(Object.keys(new ComfyUiMcpGenerationProvider({ callTool: vi.fn() })).sort()).toEqual([
      "mcp",
      "profileId",
    ]);
  });

  it("pauses an unconsumed job after an authorization boundary error", async () => {
    const source = await readFile("packages/project-core/src/generation-worker.ts", "utf8");
    expect(source).toContain("error instanceof ProjectAssetError");
    expect(source).toContain("pausePreflight(job.id, job.generationBatchId, error.code)");
  });

  it("allows immutable content-addressed bytes to be referenced by more than one artifact", async () => {
    const schema = await readFile("packages/project-core/prisma/schema.prisma", "utf8");
    const artifactModel = schema.match(/model GeneratedArtifact \{[\s\S]*?\n\}/)?.[0];
    expect(artifactModel).toBeDefined();
    expect(artifactModel).toMatch(/storageKey\s+String\s+@db\.VarChar\(255\)/);
    expect(artifactModel).not.toMatch(/storageKey\s+String\s+@unique/);
    expect(artifactModel).toContain("@@index([storageKey])");
  });

  it("pauses instead of hot-looping when retained artifact persistence fails", async () => {
    const source = await readFile("packages/project-core/src/generation-worker.ts", "utf8");
    expect(source).toContain(
      'pauseTechnical(job.id, job.generationBatchId, "ARTIFACT_RETENTION_FAILED")',
    );
  });

  it("closes a mixed terminal batch and exposes bounded owner-authored retry requirements", async () => {
    const [service, worker, editor, qaService, h3Prompt] = await Promise.all([
      readFile("packages/project-core/src/generation-execution-service.ts", "utf8"),
      readFile("packages/project-core/src/generation-worker.ts", "utf8"),
      readFile("apps/project-web/components/storyboards/shot-plan-editor.tsx", "utf8"),
      readFile("packages/project-core/src/generation-qa-service.ts", "utf8"),
      readFile("packages/project-core/src/h3-generation-prompt.ts", "utf8"),
    ]);
    for (const source of [service, worker]) {
      expect(source).toContain('"QA_PASS", "QA_FAIL", "TECHNICAL_FAILED", "CANCELLED"');
      expect(source).toContain('job.status === "CANCELLED"');
    }
    expect(editor).toContain("失败原因与重试要求（选择不通过时必填）");
    expect(editor).toContain("准备重试零调用预览");
    expect(editor).toContain("retryRequirements: executionPreview.retryRequirements");
    expect(service).toContain("async getBatch(batchId: string)");
    expect(service).toContain("await this.finishBatchIfTerminal(batchId)");
    expect(service).toContain('status: { notIn: ["COMPLETED", "CANCELLED"] }');
    expect(qaService).toContain("executionPrompt: target.compiledPrompt");
    expect(qaService).toContain("positivePrompt: spec.positivePrompt");
    expect(h3Prompt).toContain("${input.positivePrompt.trim()}");
    expect(service).toContain("positivePrompt: spec.positivePrompt");
    expect(service).toContain("promptSummary = spec.positivePrompt");
    expect(editor).toContain("实际 H3 镜头提示词");
    expect(editor).toContain("人物比例属于跨分镜连续性要求");
  });
});
