import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ComfyUiExecutionPlanService,
  ComfyUiExecutionService,
  allowlistedNodeInfo,
  captureNodeCatalog,
  checkWorkflowReadiness,
} from "@comfyuiflow/comfyui-bridge";
import type {
  ComfyUiClient,
  ComfyUiExecutionPlanStore,
  WorkflowRegistry,
} from "@comfyuiflow/comfyui-bridge";
import { AuthorizationService } from "@comfyuiflow/spike-core";

export interface ComfyUiMcpDependencies {
  client: ComfyUiClient;
  registry: WorkflowRegistry;
  liveEnabled: boolean;
  dataRoot: string;
  allowedInputRoots?: string[];
  executionPlanStore?: ComfyUiExecutionPlanStore;
  executionWorkflowId?: string;
  executionAdapterId?: string;
  executionAdapterVersion?: string;
  verifyProjectAuthorization?: (input: {
    authorizationConsumptionId: string;
    generationJobId: string;
    promptId: string;
    workflowId: string;
    workflowSha256: string;
  }) => Promise<boolean>;
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
  const executionPlans = dependencies.executionPlanStore
    ? new ComfyUiExecutionPlanService({
        store: dependencies.executionPlanStore,
        execution,
        async recheckReadiness(workflowId) {
          const readiness = await checkWorkflowReadiness(
            dependencies.client,
            dependencies.registry,
            workflowId,
          );
          return { ready: readiness.ready, blockers: readiness.blockers };
        },
      })
    : null;

  const nodeClasses = async () =>
    [
      ...new Set(
        (await dependencies.registry.manifests()).flatMap((item) => item.requiredNodeClasses),
      ),
    ].sort();

  server.registerTool(
    "comfyui_get_node_catalog",
    {
      description: "Return a redacted catalog for only project-allowlisted ComfyUI node classes",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const [catalog, stats] = await Promise.all([
        captureNodeCatalog(dependencies.client, await nodeClasses()),
        dependencies.client.getSystemStats(),
      ]);
      const system = stats.system;
      const runtimeVersion =
        system && typeof system === "object"
          ? String((system as Record<string, unknown>).comfyui_version ?? "unknown")
          : "unknown";
      return result({
        ...catalog,
        runtimeVersion,
        capturedAt: new Date().toISOString(),
        generationCalls: 0,
      });
    },
  );

  server.registerTool(
    "comfyui_get_node_info",
    {
      description: "Return one redacted node contract only when the class is project-allowlisted",
      inputSchema: {
        className: z.string().min(1),
        catalogSha256: z.string().regex(/^[a-f0-9]{64}$/),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ className, catalogSha256 }) => {
      const catalog = await captureNodeCatalog(dependencies.client, await nodeClasses());
      if (catalog.catalogSha256 !== catalogSha256) throw new Error("Node catalog is stale");
      const node = allowlistedNodeInfo(catalog, className);
      if (!node) throw new Error("Node class is not project-allowlisted");
      return result({ node, catalogSha256: catalog.catalogSha256, generationCalls: 0 });
    },
  );

  server.registerTool(
    "comfyui_validate_graph",
    {
      description:
        "Statically validate one registered graph without accepting graph JSON or a path",
      inputSchema: { workflowId: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ workflowId }) => {
      const catalog = await captureNodeCatalog(dependencies.client, await nodeClasses());
      return result(await dependencies.registry.validate(workflowId, catalog));
    },
  );

  server.registerTool(
    "comfyui_check_graph_readiness",
    {
      description: "Recheck the configured Workflow Agent execution adapter without generation",
      inputSchema: { adapterId: z.string().min(1), adapterVersion: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ adapterId, adapterVersion }) => {
      if (
        !dependencies.executionWorkflowId ||
        adapterId !== dependencies.executionAdapterId ||
        adapterVersion !== dependencies.executionAdapterVersion
      ) {
        return result({
          ready: false,
          blockers: ["EXECUTION_ADAPTER_NOT_CONFIGURED"],
          generationCalls: 0,
        });
      }
      const catalog = await captureNodeCatalog(dependencies.client, await nodeClasses());
      const [runtime, graph] = await Promise.all([
        checkWorkflowReadiness(
          dependencies.client,
          dependencies.registry,
          dependencies.executionWorkflowId,
        ),
        dependencies.registry.validate(dependencies.executionWorkflowId, catalog),
      ]);
      return result({
        ...runtime,
        ready: runtime.ready && graph.valid,
        catalogSha256: catalog.catalogSha256,
        graphSha256: graph.graphSha256,
        blockers: [...new Set([...runtime.blockers, ...graph.errors])],
        generationCalls: 0,
      });
    },
  );

  server.registerTool(
    "comfyui_submit_execution_plan",
    {
      description: "Submit only one database-frozen, authorized and materialized execution plan",
      inputSchema: {
        executionPlanId: z.string().uuid(),
        executionPlanSha256: z.string().regex(/^[a-f0-9]{64}$/),
        generationJobId: z.string().uuid(),
        authorizationConsumptionId: z.string().uuid(),
        materializedExecutionSha256: z.string().regex(/^[a-f0-9]{64}$/),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      if (!executionPlans) throw new Error("Execution-plan store is unavailable");
      return result(await executionPlans.submit(input));
    },
  );

  server.registerTool(
    "comfyui_retain_execution_plan_artifacts",
    {
      description: "Retain artifacts only for an existing database generation job",
      inputSchema: { generationJobId: z.string().uuid() },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ generationJobId }) => {
      if (!executionPlans) throw new Error("Execution-plan store is unavailable");
      return result({ artifacts: await executionPlans.retain(generationJobId) });
    },
  );

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
    role: z.enum(["character", "scene", "product", "characterFace", "characterRear"]),
  });

  server.registerTool(
    "comfyui_stage_input",
    {
      description: "Upload one immutable, hash-verified spike input to the registered workflow",
      inputSchema: {
        workflowId: z.string().min(1),
        role: z.enum(["character", "scene", "product", "characterFace", "characterRear"]),
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
        product: stagedInput.optional(),
        characterFace: stagedInput.optional(),
        characterRear: stagedInput.optional(),
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
      const { authorizationScope, product, characterFace, characterRear, ...submission } = input;
      return result(
        await execution.submit({
          ...submission,
          ...(product ? { product } : {}),
          ...(characterFace ? { characterFace } : {}),
          ...(characterRear ? { characterRear } : {}),
          ...(authorizationScope ? { authorizationScope } : {}),
        }),
      );
    },
  );

  server.registerTool(
    "comfyui_submit_project_workflow",
    {
      description:
        "Submit one registered project workflow after verifying its already-consumed database authorization",
      inputSchema: {
        workflowId: z.string().min(1),
        workflowSha256: z.string().regex(/^[a-f0-9]{64}$/),
        promptId: z.string().uuid(),
        runId: z.string().uuid(),
        authorizationConsumptionId: z.string().uuid(),
        character: stagedInput,
        scene: stagedInput,
        product: stagedInput,
        characterFace: stagedInput,
        characterRear: stagedInput,
        shot: z.object({
          positivePrompt: z.string().min(1),
          durationSeconds: z.literal(4),
          width: z.literal(768),
          height: z.literal(1344),
          fps: z.literal(24),
        }),
        authorizationScope: z.record(z.string(), z.unknown()),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ authorizationConsumptionId, ...submission }) => {
      const verified = await dependencies.verifyProjectAuthorization?.({
        authorizationConsumptionId,
        generationJobId: submission.runId,
        promptId: submission.promptId,
        workflowId: submission.workflowId,
        workflowSha256: submission.workflowSha256,
      });
      if (!verified) throw new Error("Project generation authorization could not be verified");
      return result(await execution.submitPreauthorized(submission));
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
