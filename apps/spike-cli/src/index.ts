#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import {
  CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
  CODEXMANAGER_LOCAL_PROVIDER_ID,
  CodexManagerLocalProvider,
} from "@comfyuiflow/ai-providers";
import { WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import {
  AuthorizationService,
  ReviewService,
  SpikeRunService,
  getSpikeStatus,
  loadRuntimeConfig,
  verifyVideoArtifact,
} from "@comfyuiflow/spike-core";
import { buildDryRun } from "./dry-run.js";
import { buildDiscovery } from "./discover.js";
import { McpComfyUiClient } from "./mcp-client.js";

const program = new Command();
program.name("comfyuiflow-spike").description("Zero-call by default ComfyUI vertical spike");

program.command("discover").action(async () => {
  const mcp = new McpComfyUiClient();
  await mcp.connect();
  try {
    process.stdout.write(`${JSON.stringify(await buildDiscovery(mcp), null, 2)}\n`);
  } finally {
    await mcp.close();
  }
});

program
  .command("dry-run")
  .requiredOption("--request <path>")
  .action(async ({ request }: { request: string }) => {
    const config = loadRuntimeConfig();
    const value = JSON.parse(await readFile(request, "utf8"));
    const mcp = new McpComfyUiClient();
    const director = new CodexManagerLocalProvider();
    await mcp.connect();
    try {
      const output = await buildDryRun(value, {
        dataRoot: config.spikeDataDir,
        registry: new WorkflowRegistry(config.workflowRegistryPath),
        readiness: (workflowId) => mcp.checkReadiness(workflowId),
        directorReadiness: () => director.validateConfiguration(),
      });
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    } finally {
      await mcp.close();
    }
  });

async function withMcp<T>(callback: (mcp: McpComfyUiClient) => Promise<T>): Promise<T> {
  const mcp = new McpComfyUiClient();
  await mcp.connect();
  try {
    return await callback(mcp);
  } finally {
    await mcp.close();
  }
}

async function dryRunFromPath(requestPath: string) {
  const config = loadRuntimeConfig();
  const value = JSON.parse(await readFile(requestPath, "utf8"));
  const director = new CodexManagerLocalProvider();
  return withMcp((mcp) =>
    buildDryRun(value, {
      dataRoot: config.spikeDataDir,
      registry: new WorkflowRegistry(config.workflowRegistryPath),
      readiness: (workflowId) => mcp.checkReadiness(workflowId),
      directorReadiness: () => director.validateConfiguration(),
    }),
  );
}

program
  .command("grant")
  .argument("<operation>", "director or generation")
  .requiredOption("--request <path>")
  .option("--expires-in <minutes>", "grant lifetime", "15")
  .action(async (operation: string, options: { request: string; expiresIn: string }) => {
    if (operation !== "director" && operation !== "generation") {
      throw new Error("Grant operation must be director or generation");
    }
    const minutes = Number(options.expiresIn);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60) {
      throw new Error("Grant lifetime must be between 0 and 60 minutes");
    }
    const config = loadRuntimeConfig();
    const preview = await dryRunFromPath(options.request);
    const grant = await new AuthorizationService(config.spikeDataDir).createGrant({
      operation: operation === "director" ? "DIRECTOR_GENERATE" : "COMFYUI_SUBMIT",
      scopeHash: preview.scopeHash,
      expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          grantId: grant.id,
          operation: grant.operation,
          scopeHash: grant.scopeHash,
          maxCalls: grant.maxCalls,
          expiresAt: grant.expiresAt,
          providerCalls: 0,
        },
        null,
        2,
      )}\n`,
    );
  });

program
  .command("run")
  .requiredOption("--request <path>")
  .requiredOption("--director-grant <id>")
  .requiredOption("--generation-grant <id>")
  .action(async (options: { request: string; directorGrant: string; generationGrant: string }) => {
    const config = loadRuntimeConfig();
    if (!config.codexManagerLiveEnabled || !config.comfyuiLiveEnabled) {
      throw new Error("Both CODEX_MANAGER_LIVE_ENABLED=1 and COMFYUI_LIVE_ENABLED=1 are required");
    }
    if (!config.codexManagerConfigured) throw new Error("CODEX_MANAGER_API_KEY is missing");
    const preview = await dryRunFromPath(options.request);
    if (!preview.readiness.ready) throw new Error("ComfyUI workflow is not ready");
    const runId = randomUUID();
    const promptId = randomUUID();
    const mcp = new McpComfyUiClient();
    await mcp.connect();
    try {
      const generation = {
        submit: async (input: any) => {
          const characterAsset = preview.assets.find((asset) => asset.role === "CHARACTER")!;
          const sceneAsset = preview.assets.find((asset) => asset.role === "SCENE")!;
          const [character, scene] = await Promise.all([
            mcp.stageInput({
              workflowId: preview.workflow.workflowId,
              role: "character",
              localPath: characterAsset.storedPath,
              expectedSha256: characterAsset.sha256,
            }),
            mcp.stageInput({
              workflowId: preview.workflow.workflowId,
              role: "scene",
              localPath: sceneAsset.storedPath,
              expectedSha256: sceneAsset.sha256,
            }),
          ]);
          const shot = input.shot;
          return mcp.submit({
            workflowId: preview.workflow.workflowId,
            workflowSha256: preview.workflow.sha256,
            promptId,
            runId,
            grantId: options.generationGrant,
            character,
            scene,
            authorizationScope: preview.authorizationScope,
            shot: {
              positivePrompt: [
                shot.startState,
                shot.action,
                shot.endState,
                shot.camera,
                shot.composition,
                ...(shot.continuityRequirements ?? []),
              ].join("\n"),
              durationSeconds: shot.durationSeconds,
              width: preview.workflow.constraints.width,
              height: preview.workflow.constraints.height,
              fps: preview.workflow.constraints.fps,
            },
          });
        },
        status: (id: string) => mcp.status(id),
        retainArtifacts: async (input: { promptId: string; runId: string }) => {
          const retained = (await mcp.retainArtifacts({
            ...input,
            workflowId: preview.workflow.workflowId,
          })) as Array<any>;
          return Promise.all(
            retained.map((artifact) =>
              verifyVideoArtifact({
                path: artifact.path,
                runId: input.runId,
                promptId: input.promptId,
                sourceReference: artifact.sourceReference,
                mimeType: artifact.mimeType,
              }),
            ),
          );
        },
      };
      const director = new CodexManagerLocalProvider();
      const directorConfiguration = await director.validateConfiguration();
      if (!directorConfiguration.configured) {
        throw new Error(directorConfiguration.reason ?? "CodexManager local provider is disabled");
      }
      const service = await SpikeRunService.create({
        dataRoot: config.spikeDataDir,
        director,
        generation,
      });
      const outcome = await service.execute({
        runId,
        provenance: {
          sourceAssets: preview.assets.map((asset) => ({
            role: asset.role,
            sha256: asset.sha256,
            mimeType: asset.mimeType,
            byteSize: asset.byteSize,
          })),
          creativeDescription: preview.shotPreview.creativeDescription,
          director: {
            providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
            modelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
            promptTemplateVersion: "director-one-shot-v1",
            responseSchema: "ShotSpecification@1.0.0",
          },
          workflow: {
            workflowId: preview.workflow.workflowId,
            version: preview.workflow.version,
            sha256: preview.workflow.sha256,
          },
        },
        directorGrantId: options.directorGrant,
        directorScopeHash: preview.scopeHash,
        directorRequest: {
          taskType: "STORYBOARD_GENERATION",
          modelRef: {
            providerId: CODEXMANAGER_LOCAL_PROVIDER_ID,
            modelId: CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
          },
          creativeDescription: preview.shotPreview.creativeDescription,
          imageInputs: preview.assets,
          promptTemplateVersion: "director-one-shot-v1",
          metadata: {
            runId,
            requiredDurationSeconds: preview.workflow.constraints.durationSeconds.default,
          },
        },
        generationRequest: { workflowId: preview.workflow.workflowId },
      });
      process.stdout.write(`${JSON.stringify({ runId, ...outcome }, null, 2)}\n`);
    } finally {
      await mcp.close();
    }
  });

program
  .command("status")
  .requiredOption("--run <id>")
  .action(async ({ run }: { run: string }) => {
    const config = loadRuntimeConfig();
    process.stdout.write(
      `${JSON.stringify(await getSpikeStatus(config.spikeDataDir, run), null, 2)}\n`,
    );
  });

program
  .command("review")
  .requiredOption("--run <id>")
  .requiredOption("--decision <value>", "PASS, FAIL, or RISK_ACCEPTED")
  .option("--artifact <id>")
  .option("--notes <text>", "review notes", "")
  .action(
    async (options: {
      run: string;
      decision: "PASS" | "FAIL" | "RISK_ACCEPTED";
      artifact?: string;
      notes: string;
    }) => {
      const config = loadRuntimeConfig();
      const reviews = new ReviewService(config.spikeDataDir);
      const review = await reviews.record({
        runId: options.run,
        ...(options.artifact ? { artifactId: options.artifact } : {}),
        decision: options.decision,
        notes: options.notes,
      });
      process.stdout.write(
        `${JSON.stringify({ review, gate: await reviews.evaluateGate(options.run) }, null, 2)}\n`,
      );
    },
  );

program
  .command("reconcile")
  .requiredOption("--run <id>")
  .requiredOption("--prompt <id>")
  .requiredOption("--workflow <id>")
  .action(async (options: { run: string; prompt: string; workflow: string }) => {
    const config = loadRuntimeConfig();
    const mcp = new McpComfyUiClient();
    await mcp.connect();
    try {
      const generation = {
        submit: async () => {
          throw new Error("Reconciliation cannot submit");
        },
        status: (promptId: string) => mcp.status(promptId),
        retainArtifacts: async (input: { promptId: string; runId: string }) => {
          const retained = (await mcp.retainArtifacts({
            ...input,
            workflowId: options.workflow,
          })) as Array<any>;
          return Promise.all(
            retained.map((artifact) =>
              verifyVideoArtifact({
                path: artifact.path,
                runId: input.runId,
                promptId: input.promptId,
                sourceReference: artifact.sourceReference,
                mimeType: artifact.mimeType,
              }),
            ),
          );
        },
      };
      const service = await SpikeRunService.create({
        dataRoot: config.spikeDataDir,
        director: {
          generateStructured: async () => {
            throw new Error("Reconciliation cannot call the Director");
          },
        },
        generation,
      });
      process.stdout.write(
        `${JSON.stringify(
          await service.reconcile({
            runId: options.run,
            promptId: options.prompt,
            workflowId: options.workflow,
          }),
          null,
          2,
        )}\n`,
      );
    } finally {
      await mcp.close();
    }
  });

program
  .command("cancel")
  .requiredOption("--prompt <id>")
  .action(async ({ prompt }: { prompt: string }) => {
    const cancelled = await withMcp((mcp) => mcp.cancel(prompt));
    process.stdout.write(`${JSON.stringify({ promptId: prompt, cancelled }, null, 2)}\n`);
  });

await program.parseAsync();
