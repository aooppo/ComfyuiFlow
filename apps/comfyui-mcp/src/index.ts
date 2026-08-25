#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ComfyUiClient, WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { loadProjectEnvFile, loadRuntimeConfig } from "@comfyuiflow/spike-core";
import { prisma } from "@comfyuiflow/project-core";
import { createComfyUiMcpServer } from "./server.js";

loadProjectEnvFile();

const config = loadRuntimeConfig();
const server = createComfyUiMcpServer({
  client: new ComfyUiClient(config.comfyuiBaseUrl, {
    ...(config.comfyOrgApiKey ? { comfyOrgApiKey: config.comfyOrgApiKey } : {}),
    ...(config.comfyOrgAuthToken ? { comfyOrgAuthToken: config.comfyOrgAuthToken } : {}),
  }),
  registry: new WorkflowRegistry(config.workflowRegistryPath),
  liveEnabled: config.comfyuiLiveEnabled,
  dataRoot: config.spikeDataDir,
  allowedInputRoots: [process.env.PROJECT_ASSET_STORAGE_DIR ?? "./var/project-assets"],
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
