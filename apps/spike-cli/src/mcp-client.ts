import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  JobStatusResultSchema,
  WorkflowReadinessSchema,
  type JobStatusResult,
  type WorkflowReadiness,
} from "@comfyuiflow/contracts";
import type {
  AuthorizedGenerationSubmission,
  StagedInputEvidence,
} from "@comfyuiflow/comfyui-bridge";

export class McpComfyUiClient {
  private readonly client = new Client({ name: "comfyuiflow-spike", version: "0.1.0" });
  private readonly transport: StdioClientTransport;

  constructor(
    cwd = process.cwd(),
    environment: Record<string, string> = process.env as Record<string, string>,
  ) {
    this.transport = new StdioClientTransport({
      command: "pnpm",
      args: ["mcp:comfyui"],
      cwd,
      env: environment,
      stderr: "inherit",
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  async listWorkflows(): Promise<Record<string, unknown>> {
    const response = await this.client.callTool({ name: "comfyui_list_workflows", arguments: {} });
    return (response.structuredContent ?? {}) as Record<string, unknown>;
  }

  async checkReadiness(workflowId: string): Promise<WorkflowReadiness> {
    const response = await this.client.callTool({
      name: "comfyui_check_readiness",
      arguments: { workflowId },
    });
    return WorkflowReadinessSchema.parse(response.structuredContent);
  }

  async getQueue(): Promise<{ running: string[]; pending: string[] }> {
    const response = await this.client.callTool({ name: "comfyui_get_queue", arguments: {} });
    if (response.isError) throw new Error("ComfyUI queue is unavailable");
    const value = response.structuredContent as Record<string, unknown>;
    return {
      running: Array.isArray(value.running)
        ? value.running.filter((item): item is string => typeof item === "string")
        : [],
      pending: Array.isArray(value.pending)
        ? value.pending.filter((item): item is string => typeof item === "string")
        : [],
    };
  }

  async stageInput(input: {
    workflowId: string;
    role: "character" | "scene";
    localPath: string;
    expectedSha256: string;
  }): Promise<StagedInputEvidence> {
    const response = await this.client.callTool({ name: "comfyui_stage_input", arguments: input });
    return response.structuredContent as unknown as StagedInputEvidence;
  }

  async submit(input: AuthorizedGenerationSubmission): Promise<{ promptId: string }> {
    const response = await this.client.callTool({
      name: "comfyui_submit_workflow",
      arguments: input as unknown as Record<string, unknown>,
    });
    const value = response.structuredContent as Record<string, unknown>;
    return { promptId: String(value.promptId) };
  }

  async status(promptId: string): Promise<JobStatusResult> {
    const response = await this.client.callTool({
      name: "comfyui_get_job_status",
      arguments: { promptId },
    });
    return JobStatusResultSchema.parse(response.structuredContent);
  }

  async retainArtifacts(input: { promptId: string; runId: string; workflowId: string }) {
    const response = await this.client.callTool({
      name: "comfyui_get_artifacts",
      arguments: input,
    });
    const value = response.structuredContent as { artifacts?: unknown[] };
    return value.artifacts ?? [];
  }

  async cancel(promptId: string): Promise<boolean> {
    const response = await this.client.callTool({
      name: "comfyui_cancel_job",
      arguments: { promptId },
    });
    return (response.structuredContent as Record<string, unknown>).cancelled === true;
  }
}
