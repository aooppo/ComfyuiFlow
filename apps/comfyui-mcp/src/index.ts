#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ComfyUiClient, WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { loadProjectEnvFile, loadRuntimeConfig } from "@comfyuiflow/spike-core";
import {
  GENERIC_H3_WORKFLOW_ID,
  GENERIC_H3_WORKFLOW_SHA256,
  HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
  HAILUO03_RUNTIME_CONTRACT_DIGEST,
  LocalContentStorage,
  prisma,
  resolveStorageRoot,
} from "@comfyuiflow/project-core";
import {
  createPrismaCapabilityV3ExecutionStore,
  createPrismaExecutionPlanStore,
} from "./execution-plan-store.js";
import { createComfyUiMcpServer } from "./server.js";

loadProjectEnvFile();

const config = loadRuntimeConfig();
const sourceStorageRoot = resolveStorageRoot(
  process.env.PROJECT_ASSET_STORAGE_DIR ?? "./var/project-assets",
);
const generatedStorageRoot = resolveStorageRoot(
  process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
);
const executionPlanStore = createPrismaExecutionPlanStore({
  prisma,
  sourceStorage: new LocalContentStorage({ root: sourceStorageRoot }),
  generatedStorage: new LocalContentStorage({ root: generatedStorageRoot }),
  workflowId: GENERIC_H3_WORKFLOW_ID,
  workflowSha256: GENERIC_H3_WORKFLOW_SHA256,
  workflowConstraints: { durationSeconds: 4, width: 768, height: 1344, fps: 24 },
});
const capabilityV3ExecutionStore = createPrismaCapabilityV3ExecutionStore({
  prisma,
  sourceStorage: new LocalContentStorage({ root: sourceStorageRoot }),
  generatedStorage: new LocalContentStorage({ root: generatedStorageRoot }),
});
const server = createComfyUiMcpServer({
  client: new ComfyUiClient(config.comfyuiBaseUrl, {
    ...(config.comfyOrgApiKey ? { comfyOrgApiKey: config.comfyOrgApiKey } : {}),
    ...(config.comfyOrgAuthToken ? { comfyOrgAuthToken: config.comfyOrgAuthToken } : {}),
  }),
  registry: new WorkflowRegistry(config.workflowRegistryPath),
  liveEnabled: config.comfyuiLiveEnabled,
  dataRoot: config.spikeDataDir,
  allowedInputRoots: [sourceStorageRoot, generatedStorageRoot],
  executionPlanStore,
  capabilityV3ExecutionStore,
  capabilityV3RuntimeContract: {
    capabilityEnvelopeDigest: HAILUO03_CAPABILITY_ENVELOPE_DIGEST,
    runtimeContractDigest: HAILUO03_RUNTIME_CONTRACT_DIGEST,
    nodeClasses: [
      "LoadImage",
      "LoadVideo",
      "LoadAudio",
      "MinimaxHailuo03ReferenceNode",
      "SaveVideo",
    ],
  },
  executionWorkflowId: GENERIC_H3_WORKFLOW_ID,
  executionAdapterId: "comfyui-partner-h3-reference",
  executionAdapterVersion: "1.0.0",
  async verifyProjectAuthorization(input) {
    const consumption = await prisma.authorizationConsumption.findFirst({
      where: {
        id: input.authorizationConsumptionId,
        generationJobId: input.generationJobId,
        operation: "GENERATION_SUBMIT",
      },
      include: { generationJob: { include: { generationBatch: true } } },
    });
    return Boolean(
      consumption?.generationJob &&
      consumption.generationJob.providerTaskId === input.promptId &&
      consumption.generationJob.status === "RUNNING" &&
      consumption.generationJob.generationBatch.workflowId === input.workflowId &&
      consumption.generationJob.generationBatch.workflowSha256 === input.workflowSha256,
    );
  },
});

await server.connect(new StdioServerTransport());
console.error("ComfyuiFlow MCP bridge running on stdio");
