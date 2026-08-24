#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ComfyUiClient, WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { loadProjectEnvFile, loadRuntimeConfig } from "@comfyuiflow/spike-core";
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
});

await server.connect(new StdioServerTransport());
console.error("ComfyuiFlow MCP bridge running on stdio");
