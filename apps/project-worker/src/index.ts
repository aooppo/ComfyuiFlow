import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  AdapterRegistry,
  ComfyUiMcpAdapter,
  GenerationWorker,
  PrismaGenerationMainlineStore,
  prisma,
} from "@comfyuiflow/project-core";
import { loadProjectEnvFile } from "@comfyuiflow/spike-core";
import { runWorkerLoop, workerPollInterval } from "./worker-loop.js";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
loadProjectEnvFile(workspaceRoot);

const mcpEnvironmentKeys = [
  "COMFYUI_BASE_URL",
  "COMFYUI_LIVE_ENABLED",
  "COMFYUI_API_KEY",
  "COMFY_API_KEY",
  "COMFYUI_AUTH_TOKEN",
  "SPIKE_DATA_DIR",
  "PROJECT_ASSET_STORAGE_DIR",
  "PROJECT_GENERATED_STORAGE_DIR",
  "DATABASE_URL",
] as const;

function mcpChildEnvironment(): Record<string, string> {
  const environment = getDefaultEnvironment();
  for (const key of mcpEnvironmentKeys) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

async function main() {
  const client = new Client({ name: "comfyuiflow-project-worker", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["--silent", "mcp:comfyui"],
    cwd: workspaceRoot,
    env: mcpChildEnvironment(),
    stderr: "pipe",
  });
  await client.connect(transport);
  const mcp = {
    async callTool(name: string, input: Record<string, unknown>) {
      const response = await client.callTool({ name, arguments: input });
      return (response.structuredContent ?? {}) as Record<string, unknown>;
    },
  };
  const adapters = new AdapterRegistry([
    new ComfyUiMcpAdapter(
      { id: "adapter.comfyui-mcp", version: "1.0.0" },
      { id: "runtime.comfyui-mcp", version: "1.0.0" },
      mcp,
    ),
  ]);
  const generationWorker = new GenerationWorker(
    adapters,
    new PrismaGenerationMainlineStore(prisma),
  );
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await runWorkerLoop({
      once: process.env.PROJECT_WORKER_ONCE === "true",
      pollIntervalMs: workerPollInterval(process.env.PROJECT_WORKER_POLL_INTERVAL_MS),
      shouldStop: () => stopping,
      runGeneration: () => generationWorker.runOnce(),
      onResult: (operation, result) =>
        process.stdout.write(
          `${JSON.stringify({ operation, result: (result as { state?: string; status?: string }).state ?? (result as { status?: string }).status ?? "completed" })}\n`,
        ),
      onError: (error) =>
        process.stderr.write(
          `Project worker turn failed: ${error instanceof Error ? error.message : "unknown"}\n`,
        ),
    });
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

void main().catch(async (error: unknown) => {
  process.stderr.write(
    `Project worker failed: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  await prisma.$disconnect();
  process.exitCode = 1;
});
