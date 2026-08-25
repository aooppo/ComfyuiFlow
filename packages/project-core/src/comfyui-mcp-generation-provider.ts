import { readFile } from "node:fs/promises";
import type { GenerationExecutionSlotV1 } from "@comfyuiflow/contracts";
import type {
  GenerationProvider,
  GenerationSubmissionTarget,
  RetainedProviderArtifact,
} from "./generation-provider.js";
import { GENERIC_H3_WORKFLOW_ID, GENERIC_H3_WORKFLOW_SHA256 } from "./generation-provider.js";

export interface ComfyUiMcpToolClient {
  callTool<T = unknown>(name: string, input: Record<string, unknown>): Promise<T>;
}

export interface MaterializedGenerationSlot extends GenerationExecutionSlotV1 {
  localPath: string;
}

export interface McpGenerationSubmissionTarget extends GenerationSubmissionTarget {
  slots: MaterializedGenerationSlot[];
  grantId: string;
}

/**
 * The LIVE adapter deliberately knows only MCP tool names. It cannot receive an endpoint,
 * workflow JSON, node map, or arbitrary model parameters from a request.
 */
export class ComfyUiMcpGenerationProvider implements GenerationProvider {
  readonly profileId = "minimax-h3-4s-v1" as const;

  constructor(private readonly mcp: ComfyUiMcpToolClient) {}

  async preflight() {
    const result = await this.mcp.callTool<any>("comfyui_check_readiness", {
      workflowId: GENERIC_H3_WORKFLOW_ID,
    });
    return {
      ready: result?.ready === true,
      blockers: result?.ready === true ? [] : ["WORKFLOW_NOT_READY"],
    };
  }

  async submit(rawTarget: GenerationSubmissionTarget) {
    const target = rawTarget as McpGenerationSubmissionTarget;
    const byRole = Object.fromEntries(target.slots.map((slot) => [slot.role, slot]));
    const staged = async (role: GenerationExecutionSlotV1["role"], mcpRole: string) => {
      const slot = byRole[role];
      if (!slot) throw new Error(`Required registered slot ${role} is missing`);
      return this.mcp.callTool<any>("comfyui_stage_input", {
        workflowId: GENERIC_H3_WORKFLOW_ID,
        role: mcpRole,
        localPath: slot.localPath,
        expectedSha256: slot.sha256,
      });
    };
    const [scene, product, character, characterFace, characterRear] = await Promise.all([
      staged("SCENE", "scene"),
      staged("PRODUCT", "product"),
      staged("CHARACTER_FULL_BODY", "character"),
      staged("CHARACTER_FACE", "characterFace"),
      staged("CHARACTER_REAR", "characterRear"),
    ]);
    const submitted = await this.mcp.callTool<any>("comfyui_submit_project_workflow", {
      workflowId: GENERIC_H3_WORKFLOW_ID,
      workflowSha256: GENERIC_H3_WORKFLOW_SHA256,
      promptId: target.promptId,
      runId: target.jobId,
      authorizationConsumptionId: target.grantId,
      scene,
      product,
      character,
      characterFace,
      characterRear,
      shot: {
        positivePrompt: target.compiledPrompt,
        durationSeconds: 4,
        width: 768,
        height: 1344,
        fps: 24,
      },
      authorizationScope: {
        workflowId: GENERIC_H3_WORKFLOW_ID,
        workflowSha256: GENERIC_H3_WORKFLOW_SHA256,
        assetHashes: target.slots.map((slot) => ({
          role: slot.role === "CHARACTER_FULL_BODY" ? "CHARACTER" : slot.role,
          sha256: slot.sha256,
        })),
      },
    });
    return { taskId: String(submitted?.promptId ?? target.promptId) };
  }

  async status(taskId: string) {
    const result = await this.mcp.callTool<any>("comfyui_get_job_status", { promptId: taskId });
    const value = String(result?.status ?? "PENDING").toUpperCase();
    if (["COMPLETED", "FAILED", "CANCELLED", "RUNNING", "UNKNOWN"].includes(value))
      return value as "COMPLETED" | "FAILED" | "CANCELLED" | "RUNNING" | "UNKNOWN";
    if (value === "IN_PROGRESS") return "RUNNING" as const;
    return "PENDING" as const;
  }

  async retainArtifacts(taskId: string, jobId: string): Promise<RetainedProviderArtifact[]> {
    const result = await this.mcp.callTool<any>("comfyui_get_artifacts", {
      promptId: taskId,
      runId: jobId,
      workflowId: GENERIC_H3_WORKFLOW_ID,
    });
    const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
    return Promise.all(
      artifacts.map(async (artifact: any) => ({
        mimeType: "video/mp4" as const,
        bytes: new Uint8Array(await readFile(String(artifact.path))),
        providerReference: {
          promptId: taskId,
          sha256: artifact.sha256,
          outputType: artifact.outputType,
        },
      })),
    );
  }

  async cancel(taskId: string) {
    const result = await this.mcp.callTool<any>("comfyui_cancel_job", { promptId: taskId });
    return {
      cancelled: result?.cancelled === true,
      remoteTerminationConfirmed: result?.cancelled === true,
    };
  }
}
