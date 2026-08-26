import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  GenerationExecutionService as GenerationExecutionServiceType,
  GenerationPlanService as GenerationPlanServiceType,
  ProjectPrisma,
  StoryboardService as StoryboardServiceType,
} from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";

describe.runIf(enabled)("Generation execution PostgreSQL ledger", () => {
  let client: ProjectPrisma;
  let execution: GenerationExecutionServiceType;
  let projectId: string;
  let planVersionId: string;
  let specIds: string[];

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test"))
      throw new Error("Generation execution tests require an isolated *_test database");
    const module = await import("@comfyuiflow/project-core");
    client = module.prisma;
    execution = new module.GenerationExecutionService(
      client,
      undefined,
      {},
      {
        allowTestFixtures: true,
      },
    );
    await reset(client);
    const storyboards: StoryboardServiceType = new module.StoryboardService(client, {
      phase2BindingsEnabled: true,
    });
    const plans: GenerationPlanServiceType = new module.GenerationPlanService(client);
    const project = await client.project.create({
      data: { name: "Generation execution QA", targetAspectRatio: "PORTRAIT_9_16" },
    });
    projectId = project.id;
    const storyboard = await storyboards.create(project.id, {
      title: "Twenty-shot execution ledger",
      creativeBrief: "Stable persistence and authorization coverage.",
    });
    const generated = await storyboards.generate(storyboard.id, 0);
    const version = await storyboards.getVersion(generated.headVersionId!);
    const source = version.shots[0]!;
    const saved = await storyboards.save(storyboard.id, generated.rowVersion, {
      parentVersionId: generated.headVersionId,
      creativeBrief: generated.creativeBrief,
      shots: Array.from({ length: 20 }, (_, index) => ({
        schemaVersion: "shot-draft-v1" as const,
        shotKey: version.shots[index]?.shotKey ?? randomUUID(),
        ordinal: index + 1,
        title: `Execution shot ${index + 1}`,
        creativeDescription: source.creativeDescription,
        startState: source.startState,
        action: `${source.action} ${index + 1}`,
        endState: source.endState,
        camera: source.camera,
        composition: source.composition,
        continuityRequirements: source.continuityRequirements as string[],
        durationSeconds: 4,
        assetRequirements: [],
      })),
    });
    const assetPreview = await storyboards.previewAssets(saved.headVersionId!);
    await storyboards.resolveAssets(saved.headVersionId!, {
      candidateResultHash: assetPreview.resultHash,
      selections: [],
    });
    await storyboards.decide(saved.headVersionId!, saved.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
    const plan = await plans.create(saved.headVersionId!, randomUUID());
    await plans.decide(plan.headVersionId!, plan.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
    const approvedPlan = await plans.get(plan.id);
    planVersionId = approvedPlan.approvedVersionId!;
    specIds = approvedPlan.headVersion!.specs.map((spec) => spec.id);
  });

  afterAll(async () => {
    await reset(client);
    await client.$disconnect();
  });

  it.each([1, 4, 20])(
    "persists an ordered %i-shot subset with separate call ceilings",
    async (count) => {
      const batch = await seedBatch(client, projectId, planVersionId, specIds.slice(0, count));
      expect(
        await client.generationBatchTarget.count({ where: { generationBatchId: batch.id } }),
      ).toBe(count);
      expect(await client.generationJob.count({ where: { generationBatchId: batch.id } })).toBe(
        count,
      );
      const authorization = await client.executionAuthorization.findUniqueOrThrow({
        where: { generationBatchId: batch.id },
      });
      expect(authorization).toMatchObject({
        maximumGenerationCalls: count,
        maximumAiQaCalls: count,
      });
    },
  );

  it("atomically consumes each target operation once and never refunds failures", async () => {
    const batch = await seedBatch(client, projectId, planVersionId, specIds.slice(0, 1));
    const job = await client.generationJob.findFirstOrThrow({
      where: { generationBatchId: batch.id },
    });
    const settled = await Promise.allSettled([
      execution.consume(job.id, "GENERATION_SUBMIT", "1".repeat(64)),
      execution.consume(job.id, "GENERATION_SUBMIT", "1".repeat(64)),
    ]);
    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(
      await client.authorizationConsumption.count({
        where: { generationJobId: job.id, operation: "GENERATION_SUBMIT" },
      }),
    ).toBe(1);
    await expect(
      execution.consume(job.id, "GENERATION_SUBMIT", "2".repeat(64)),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_CONSUMED" });
  });

  it("rejects cross-project execution references at the database boundary", async () => {
    const batch = await seedBatch(client, projectId, planVersionId, specIds.slice(0, 1));
    const foreign = await client.project.create({
      data: { name: "Foreign generation tenant", targetAspectRatio: "PORTRAIT_9_16" },
    });
    await expect(
      client.generationBatchTarget.create({
        data: {
          projectId: foreign.id,
          generationBatchId: batch.id,
          generationSpecId: specIds[1]!,
          ordinal: 2,
          targetHash: "a".repeat(64),
          promptHash: "b".repeat(64),
          referencesHash: "c".repeat(64),
          compiledPrompt: "must be rejected",
          slotManifestJson: [],
        },
      }),
    ).rejects.toThrow();
  });

  it("retains one Fake MP4, records technical facts, and extracts three immutable frames", async () => {
    const module = await import("@comfyuiflow/project-core");
    const batch = await seedBatch(client, projectId, planVersionId, specIds.slice(0, 1));
    const job = await client.generationJob.findFirstOrThrow({
      where: { generationBatchId: batch.id },
    });
    const generatedRoot = await mkdtemp(join(tmpdir(), "comfyuiflow-generated-qa-"));
    try {
      const provider = new module.FakeGenerationProvider();
      const submitted = await provider.submit({
        jobId: job.id,
        promptId: randomUUID(),
        workflowId: "fake-project-shot-4s-v1",
        compiledPrompt: "Fake technical artifact",
        slots: [],
      });
      const artifacts = await provider.retainArtifacts(submitted.taskId);
      const service = new module.GeneratedArtifactService(
        client,
        new module.LocalContentStorage({ root: generatedRoot, maxBytes: 10 * 1024 * 1024 }),
      );
      const validated = await service.retainAndValidate(job.id, artifacts);
      expect(validated).toMatchObject({ valid: true });
      expect(validated.frames).toHaveLength(3);
      expect(validated.check).toMatchObject({
        status: "PASS",
        videoCodec: "h264",
        width: 32,
        height: 32,
      });
      expect(new Set(validated.frames.map((frame: any) => frame.role))).toEqual(
        new Set(["FIRST", "MIDDLE", "FINAL"]),
      );
      const decision = await execution.recordHumanQa(validated.artifact.id, randomUUID(), {
        decision: "PASS",
      });
      expect(decision.decision).toBe("PASS");
      expect(await client.generationBatch.findUnique({ where: { id: batch.id } })).toMatchObject({
        status: "COMPLETED",
      });
    } finally {
      await rm(generatedRoot, { recursive: true, force: true });
    }
  });
});

async function seedBatch(
  client: ProjectPrisma,
  projectId: string,
  generationPlanVersionId: string,
  generationSpecIds: string[],
) {
  const batch = await client.generationBatch.create({
    data: {
      projectId,
      generationPlanVersionId,
      providerProfileId: "fake-video-v1",
      providerId: "fake",
      modelId: "fake-video-v1",
      workflowId: "fake-project-shot-4s-v1",
      workflowVersion: "1.0.0",
      workflowSha256: "f".repeat(64),
      previewHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      scopeHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      idempotencyKey: randomUUID(),
    },
  });
  for (const [index, generationSpecId] of generationSpecIds.entries()) {
    const target = await client.generationBatchTarget.create({
      data: {
        projectId,
        generationBatchId: batch.id,
        generationSpecId,
        ordinal: index + 1,
        targetHash: String(index + 1)
          .padStart(64, "a")
          .slice(-64),
        promptHash: String(index + 1)
          .padStart(64, "b")
          .slice(-64),
        referencesHash: String(index + 1)
          .padStart(64, "c")
          .slice(-64),
        compiledPrompt: `compiled prompt ${index + 1}`,
        slotManifestJson: [],
      },
    });
    await client.generationJob.create({
      data: { projectId, generationBatchId: batch.id, generationBatchTargetId: target.id },
    });
  }
  await client.executionAuthorization.create({
    data: {
      projectId,
      generationBatchId: batch.id,
      scopeHash: batch.scopeHash,
      maximumGenerationCalls: generationSpecIds.length,
      maximumAiQaCalls: generationSpecIds.length,
      confirmedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return batch;
}

async function reset(client: ProjectPrisma) {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "GenerationImplementationEvidence", "ShotExecutionPlan", "GenerationImplementation", "HumanQaDecision", "AiQaResult", "AiQaRun", "ArtifactReviewFrame", "ArtifactTechnicalCheck", "GeneratedArtifact", "GenerationJobEvent", "AuthorizationConsumption", "GenerationJob", "ExecutionAuthorization", "GenerationBatchTarget", "GenerationBatch", "GenerationPlanDecision", "GenerationSpecReference", "GenerationSpec", "GenerationPlanVersion", "GenerationPlan", "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "Project" CASCADE',
  );
}
