import { fileURLToPath } from "node:url";
import {
  FakeAssetUnderstandingProvider,
  FakeVideoQaProvider,
  CodexManagerLocalVideoQaProvider,
  OpenAiAssetUnderstandingProvider,
  type AiModelProvider,
} from "@comfyuiflow/ai-providers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  AnalysisWorker,
  ComfyUiMcpGenerationProvider,
  FakeGenerationProvider,
  GenerationWorker,
  StoryboardDirectorWorker,
  prisma,
  type ComfyUiMcpToolClient,
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
  "WORKFLOW_REGISTRY_PATH",
  "PROJECT_ASSET_STORAGE_DIR",
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

function providerFromEnvironment(): AiModelProvider {
  const provider = process.env.ASSET_UNDERSTANDING_PROVIDER ?? "fake";
  if (provider === "fake") return new FakeAssetUnderstandingProvider();
  if (provider === "openai") return new OpenAiAssetUnderstandingProvider();
  throw new Error("ASSET_UNDERSTANDING_PROVIDER is not registered");
}

async function main() {
  const analysisWorker = new AnalysisWorker(providerFromEnvironment());
  const generationProfile = process.env.GENERATION_PROVIDER_PROFILE ?? "fake-video-v1";
  let closeMcp: (() => Promise<void>) | undefined;
  const generationProvider =
    generationProfile === "fake-video-v1"
      ? new FakeGenerationProvider()
      : await (async () => {
          if (
            generationProfile !== "minimax-h3-4s-v1" ||
            process.env.PROJECT_GENERATION_LIVE_ENABLED !== "true"
          )
            throw new Error("LIVE generation profile is not enabled");
          const client = new Client({ name: "comfyuiflow-project-worker", version: "0.1.0" });
          const transport = new StdioClientTransport({
            command: "pnpm",
            args: ["--silent", "mcp:comfyui"],
            cwd: workspaceRoot,
            env: mcpChildEnvironment(),
            stderr: "pipe",
          });
          await client.connect(transport);
          closeMcp = () => client.close();
          const mcp: ComfyUiMcpToolClient = {
            async callTool(name, input) {
              const response = await client.callTool({ name, arguments: input });
              return (response.structuredContent ?? {}) as any;
            },
          };
          return new ComfyUiMcpGenerationProvider(mcp);
        })();
  const qaProvider =
    generationProfile === "fake-video-v1"
      ? new FakeVideoQaProvider()
      : new CodexManagerLocalVideoQaProvider();
  const generationWorker = new GenerationWorker(generationProvider, qaProvider);
  const directorWorker = new StoryboardDirectorWorker();
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
      runAnalysis: () => analysisWorker.runOnce(`project-worker:${process.pid}`),
      runGeneration: () => generationWorker.runOnce(`generation-worker:${process.pid}`),
      runDirector: () => directorWorker.processNext(`storyboard-director-worker:${process.pid}`),
      onResult: (operation, result) =>
        process.stdout.write(
          `${JSON.stringify({ operation, result: result.status ?? "completed" })}\n`,
        ),
      onError: (error) =>
        process.stderr.write(
          `Project worker turn failed: ${error instanceof Error ? error.message : "unknown"}\n`,
        ),
    });
  } finally {
    await closeMcp?.();
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
