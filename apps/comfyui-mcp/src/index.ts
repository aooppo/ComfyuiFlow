#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ComfyUiClient, WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { loadRuntimeConfig } from "@comfyuiflow/spike-core";
import { createComfyUiMcpServer } from "./server.js";

const config = loadRuntimeConfig();
const server = createComfyUiMcpServer({
  client: new ComfyUiClient(config.comfyuiBaseUrl),
  registry: new WorkflowRegistry(config.workflowRegistryPath),
  liveEnabled: config.comfyuiLiveEnabled,
  dataRoot: config.spikeDataDir,
});

await server.connect(new StdioServerTransport());
console.error("ComfyuiFlow MCP bridge running on stdio");
