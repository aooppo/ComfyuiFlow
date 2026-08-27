import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ComfyUiFrozenExecutor,
  ComfyUiMainlineExecutionService,
  captureNodeCatalog,
  type ComfyUiClient,
  type ComfyUiMainlineExecutionStore,
} from "@comfyuiflow/comfyui-bridge";

export interface ComfyUiMcpDependencies {
  client: ComfyUiClient;
  liveEnabled: boolean;
  allowedInputRoots: string[];
  mainlineExecutionStore?: ComfyUiMainlineExecutionStore;
  recheckMainlineRuntimeContract?(input: {
    runtimeRef: { id: string; version: string };
    runtimeContractDigest: string;
    graphSha256: string;
    evidence: {
      id: string;
      outcome: "PASS";
      graphSha256: string;
      runtimeContractDigest: string;
      runtimeFingerprintSha256: string;
      nodeCatalogSha256: string;
    };
    nodeClasses: string[];
  }): Promise<{ ready: boolean; blockers: string[] }>;
  preflightMainlineGraph?(graphSnapshotId: string): Promise<object>;
  listMainlineGraphValidationEvidence?(graphSnapshotId: string): Promise<object>;
}

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

export function createComfyUiMcpServer(dependencies: ComfyUiMcpDependencies): McpServer {
  const server = new McpServer({ name: "comfyuiflow-comfyui", version: "1.0.0" });
  const execution = new ComfyUiFrozenExecutor({
    client: dependencies.client,
    liveEnabled: dependencies.liveEnabled,
    allowedInputRoots: dependencies.allowedInputRoots,
  });
  const mainline =
    dependencies.mainlineExecutionStore && dependencies.recheckMainlineRuntimeContract
      ? new ComfyUiMainlineExecutionService({
          store: dependencies.mainlineExecutionStore,
          execution,
          recheckRuntimeContract: dependencies.recheckMainlineRuntimeContract,
        })
      : null;

  server.registerTool(
    "preflight_mainline_graph",
    {
      description:
        "Validate one persisted frozen graph with read-only ComfyUI runtime facts; never submits generation",
      inputSchema: { graphSnapshotId: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ graphSnapshotId }) => {
      if (!dependencies.preflightMainlineGraph) throw new Error("GRAPH_PREFLIGHT_UNAVAILABLE");
      return result(await dependencies.preflightMainlineGraph(graphSnapshotId));
    },
  );
  server.registerTool(
    "get_mainline_graph_validation_evidence",
    {
      description: "Read immutable safe technical evidence for one persisted frozen graph",
      inputSchema: { graphSnapshotId: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ graphSnapshotId }) => {
      if (!dependencies.listMainlineGraphValidationEvidence)
        throw new Error("GRAPH_VALIDATION_EVIDENCE_UNAVAILABLE");
      return result(await dependencies.listMainlineGraphValidationEvidence(graphSnapshotId));
    },
  );

  server.registerTool(
    "get_generation_attempt_status",
    {
      description: "Read status only for one submitted frozen GenerationAttempt",
      inputSchema: { attemptId: z.string().uuid(), taskId: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ attemptId }) => {
      if (!mainline) throw new Error("MAINLINE_EXECUTION_STORE_UNAVAILABLE");
      return result(await mainline.status(attemptId));
    },
  );
  server.registerTool(
    "submit_generation_attempt",
    {
      description: "Submit one authorized frozen GenerationAttempt; raw graph input is forbidden",
      inputSchema: {
        attemptId: z.string().uuid(),
        adapterRef: z.object({ id: z.string().min(1), version: z.string().min(1) }),
        runtimeRef: z.object({ id: z.string().min(1), version: z.string().min(1) }),
        runtimeContractDigest: z.string().regex(/^[a-f0-9]{64}$/),
        graphSha256: z.string().regex(/^[a-f0-9]{64}$/),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (identity) => {
      if (!mainline) throw new Error("MAINLINE_EXECUTION_STORE_UNAVAILABLE");
      return result(await mainline.submit(identity));
    },
  );
  server.registerTool(
    "retain_generation_artifacts",
    {
      description: "Retain artifacts only for one completed frozen GenerationAttempt",
      inputSchema: { attemptId: z.string().uuid(), taskId: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ attemptId }) => {
      if (!mainline) throw new Error("MAINLINE_EXECUTION_STORE_UNAVAILABLE");
      return result({ artifacts: await mainline.retain(attemptId) });
    },
  );
  server.registerTool(
    "get_runtime_node_catalog",
    {
      description: "Return redacted node details for explicitly requested RuntimeContract classes",
      inputSchema: { nodeClasses: z.array(z.string().min(1)).min(1).max(100) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ nodeClasses }) =>
      result({
        ...(await captureNodeCatalog(dependencies.client, nodeClasses)),
        generationCalls: 0,
      }),
  );
  return server;
}
