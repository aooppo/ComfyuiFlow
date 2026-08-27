#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  allowlistedNodeInfo,
  captureNodeCatalog,
  ComfyUiClient,
  preflightZeroCallGraph,
  runtimeFingerprintForSystemStats,
} from "@comfyuiflow/comfyui-bridge";
import { loadProjectEnvFile, loadRuntimeConfig } from "@comfyuiflow/spike-core";
import {
  GraphValidationEvidenceService,
  LocalContentStorage,
  prisma,
  resolveStorageRoot,
} from "@comfyuiflow/project-core";
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
const graphValidationEvidence = new GraphValidationEvidenceService(prisma);
const server = createComfyUiMcpServer({
  client,
  liveEnabled: config.comfyuiLiveEnabled,
  allowedInputRoots: [sourceStorageRoot, generatedStorageRoot],
  mainlineExecutionStore: createPrismaMainlineExecutionStore({
    prisma,
    sourceStorage: new LocalContentStorage({ root: sourceStorageRoot }),
    generatedStorage: new LocalContentStorage({ root: generatedStorageRoot }),
  }),
  async preflightMainlineGraph(graphSnapshotId) {
    return graphValidationEvidence.preflight(graphSnapshotId, (snapshot) =>
      preflightZeroCallGraph(client, snapshot),
    );
  },
  async listMainlineGraphValidationEvidence(graphSnapshotId) {
    return { evidence: await graphValidationEvidence.list(graphSnapshotId) };
  },
  async recheckMainlineRuntimeContract(input) {
    const contracts = await prisma.$queryRawUnsafe<Array<{ nodeClassesJson: unknown }>>(
      `SELECT "nodeClassesJson" FROM "RuntimeContract" WHERE "ref" = $1 AND "version" = $2 AND "digest" = $3`,
      input.runtimeRef.id,
      input.runtimeRef.version,
      input.runtimeContractDigest,
    );
    const nodeClasses = Array.isArray(contracts[0]?.nodeClassesJson)
      ? contracts[0]!.nodeClassesJson.filter((item): item is string => typeof item === "string")
      : [];
    if (!nodeClasses.length || JSON.stringify(nodeClasses) !== JSON.stringify(input.nodeClasses))
      return { ready: false, blockers: ["RUNTIME_CONTRACT_NOT_FOUND_OR_CHANGED"] };
    let catalog;
    let runtimeFingerprintSha256: string;
    try {
      [catalog, runtimeFingerprintSha256] = await Promise.all([
        captureNodeCatalog(client, nodeClasses),
        client.getSystemStats().then(runtimeFingerprintForSystemStats),
      ]);
    } catch {
      return { ready: false, blockers: ["RUNTIME_FACTS_UNAVAILABLE"] };
    }
    const missing = nodeClasses.filter((className) => !allowlistedNodeInfo(catalog, className));
    return {
      ready:
        missing.length === 0 &&
        catalog.catalogSha256 === input.evidence.nodeCatalogSha256 &&
        runtimeFingerprintSha256 === input.evidence.runtimeFingerprintSha256,
      blockers: [
        ...missing.map((item) => `NODE_CLASS_UNAVAILABLE:${item}`),
        ...(catalog.catalogSha256 === input.evidence.nodeCatalogSha256
          ? []
          : ["NODE_CATALOG_CHANGED"]),
        ...(runtimeFingerprintSha256 === input.evidence.runtimeFingerprintSha256
          ? []
          : ["RUNTIME_FACTS_CHANGED"]),
      ],
    };
  },
});

await server.connect(new StdioServerTransport());
console.error("ComfyuiFlow MCP bridge running on stdio");
