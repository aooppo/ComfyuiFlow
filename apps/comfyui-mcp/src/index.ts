#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  allowlistedNodeInfo,
  captureNodeCatalog,
  ComfyUiClient,
} from "@comfyuiflow/comfyui-bridge";
import { loadProjectEnvFile, loadRuntimeConfig } from "@comfyuiflow/spike-core";
import { LocalContentStorage, prisma, resolveStorageRoot } from "@comfyuiflow/project-core";
import { createPrismaMainlineExecutionStore } from "./execution-plan-store.js";
import { createComfyUiMcpServer } from "./server.js";

loadProjectEnvFile();
const config = loadRuntimeConfig();
const sourceStorageRoot = resolveStorageRoot(
  process.env.PROJECT_ASSET_STORAGE_DIR ?? "./var/project-assets",
);
const generatedStorageRoot = resolveStorageRoot(
  process.env.PROJECT_GENERATED_STORAGE_DIR ?? "./var/project-generated",
);
const client = new ComfyUiClient(config.comfyuiBaseUrl, {
  ...(config.comfyOrgApiKey ? { comfyOrgApiKey: config.comfyOrgApiKey } : {}),
  ...(config.comfyOrgAuthToken ? { comfyOrgAuthToken: config.comfyOrgAuthToken } : {}),
});
const server = createComfyUiMcpServer({
  client,
  liveEnabled: config.comfyuiLiveEnabled,
  allowedInputRoots: [sourceStorageRoot, generatedStorageRoot],
  mainlineExecutionStore: createPrismaMainlineExecutionStore({
    prisma,
    sourceStorage: new LocalContentStorage({ root: sourceStorageRoot }),
    generatedStorage: new LocalContentStorage({ root: generatedStorageRoot }),
  }),
  async recheckMainlineRuntimeContract(input) {
    const contracts = await prisma.$queryRawUnsafe<Array<{ nodeClassesJson: unknown }>>(
      `SELECT "nodeClassesJson" FROM "RuntimeContract" WHERE "ref" = $1 AND "version" = $2 AND "digest" = $3`,
      input.runtimeRef.id,
      input.runtimeRef.version,
      input.runtimeContractDigest,
    );
    const nodeClasses = Array.isArray(contracts[0]?.nodeClassesJson)
      ? contracts[0]!.nodeClassesJson.map(String)
      : [];
    if (!nodeClasses.length) return { ready: false, blockers: ["RUNTIME_CONTRACT_NOT_FOUND"] };
    const catalog = await captureNodeCatalog(client, nodeClasses);
    const missing = nodeClasses.filter((className) => !allowlistedNodeInfo(catalog, className));
    return {
      ready: missing.length === 0,
      blockers: missing.map((item) => `NODE_CLASS_UNAVAILABLE:${item}`),
    };
  },
});

await server.connect(new StdioServerTransport());
console.error("ComfyuiFlow MCP bridge running on stdio");
