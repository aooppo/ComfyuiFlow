import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { ComfyUiExecutionService, checkWorkflowReadiness } from "@comfyuiflow/comfyui-bridge";
import type { ComfyUiClient, WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { AuthorizationService } from "@comfyuiflow/spike-core";

export interface ComfyUiMcpDependencies {
  client: ComfyUiClient;
  registry: WorkflowRegistry;
  liveEnabled: boolean;
  dataRoot: string;
}

function result(value: unknown) {
  const structuredContent = value as Record<string, unknown>;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent,
  };
}

export function createComfyUiMcpServer(dependencies: ComfyUiMcpDependencies): McpServer {
  const server = new McpServer({ name: "comfyuiflow-comfyui", version: "0.1.0" });
  const execution = new ComfyUiExecutionService({
    ...dependencies,
    authorization: new AuthorizationService(dependencies.dataRoot),
  });

  server.registerTool(
    "comfyui_list_workflows",
    {
      description: "List only project-registered ComfyUI workflows without contacting ComfyUI",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const workflows = await dependencies.registry.manifests();
      return result({
        workflows: workflows.map((workflow) => ({
          workflowId: workflow.workflowId,
          version: workflow.version,
          displayName: workflow.displayName,
          enabled: workflow.enabled,
          sha256: workflow.sha256,
          constraints: workflow.constraints,
        })),
        generationCalls: 0,
      });
    },
  );

  server.registerTool(
    "comfyui_check_readiness",
    {
      description:
        "Check registered workflow, node, model, and endpoint readiness without generation",
      inputSchema: { workflowId: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ workflowId }) =>
      result(await checkWorkflowReadiness(dependencies.client, dependencies.registry, workflowId)),
  );

  server.registerTool(
    "comfyui_get_queue",
    {
      description: "List running and pending prompt IDs without returning workflow payloads",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => result({ ...(await dependencies.client.getQueue()), generationCalls: 0 }),
  );

  const stagedInput = z.object({
    name: z.string().min(1),
    subfolder: z.string(),
    type: z.literal("input"),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    role: z.enum(["character", "scene"]),
  });

  server.registerTool(
    "comfyui_stage_input",
    {
      description: "Upload one immutable, hash-verified spike input to the registered workflow",
      inputSchema: {
        workflowId: z.string().min(1),
        role: z.enum(["character", "scene"]),
        localPath: z.string().min(1),
        expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => result(await execution.stageInput(input)),
  );

  server.registerTool(
    "comfyui_submit_workflow",
    {
      description: "Consume one exact grant and submit one registered workflow without retry",
      inputSchema: {
        workflowId: z.string().min(1),
        workflowSha256: z.string().regex(/^[a-f0-9]{64}$/),
        promptId: z.string().uuid(),
        runId: z.string().uuid(),
        grantId: z.string().uuid(),
        character: stagedInput,
        scene: stagedInput,
        shot: z.object({
          positivePrompt: z.string().min(1),
          durationSeconds: z.number().positive(),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          fps: z.number().positive(),
        }),
        authorizationScope: z.record(z.string(), z.unknown()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      const { authorizationScope, ...submission } = input;
      return result(
        await execution.submit(
          authorizationScope ? { ...submission, authorizationScope } : submission,
        ),
      );
    },
  );

  server.registerTool(
    "comfyui_get_job_status",
    {
      description: "Poll one existing ComfyUI prompt ID; never submits or retries",
      inputSchema: { promptId: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ promptId }) => result(await execution.status(promptId)),
  );

  server.registerTool(
    "comfyui_get_artifacts",
    {
      description: "Retain output declared by the registered workflow for one completed task",
      inputSchema: {
        promptId: z.string().uuid(),
        runId: z.string().uuid(),
        workflowId: z.string().min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => result({ artifacts: await execution.retainArtifacts(input) }),
  );

  server.registerTool(
    "comfyui_cancel_job",
    {
      description: "Target and idempotently cancel exactly one existing ComfyUI prompt ID",
      inputSchema: { promptId: z.string().uuid() },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ promptId }) => result({ promptId, cancelled: await execution.cancel(promptId) }),
  );

  return server;
}
