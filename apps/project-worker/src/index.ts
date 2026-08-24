import {
  FakeAssetUnderstandingProvider,
  OpenAiAssetUnderstandingProvider,
  type AiModelProvider,
} from "@comfyuiflow/ai-providers";
import { AnalysisWorker, prisma } from "@comfyuiflow/project-core";

function providerFromEnvironment(): AiModelProvider {
  const provider = process.env.ASSET_UNDERSTANDING_PROVIDER ?? "fake";
  if (provider === "fake") return new FakeAssetUnderstandingProvider();
  if (provider === "openai") return new OpenAiAssetUnderstandingProvider();
  throw new Error("ASSET_UNDERSTANDING_PROVIDER is not registered");
}

async function main() {
  const worker = new AnalysisWorker(providerFromEnvironment());
  const result = await worker.runOnce(`project-worker:${process.pid}`);
  if (result)
    process.stdout.write(
      `${JSON.stringify({ operation: "asset_understanding_worker", result: result.status })}\n`,
    );
  await prisma.$disconnect();
}

void main().catch(async (error: unknown) => {
  process.stderr.write(
    `Project worker failed: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  await prisma.$disconnect();
  process.exitCode = 1;
});
