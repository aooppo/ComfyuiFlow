import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  GenerationPlanService as GenerationPlanServiceType,
  ProjectPrisma,
  StoryboardService as StoryboardServiceType,
} from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";

describe.runIf(enabled)("Generation Plan PostgreSQL history", () => {
  let client: ProjectPrisma;
  let storyboards: StoryboardServiceType;
  let plans: GenerationPlanServiceType;
  let approvedVersionId: string;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test"))
      throw new Error("Generation Plan tests require an isolated *_test database");
    const module = await import("@comfyuiflow/project-core");
    client = module.prisma;
    await reset(client);
    storyboards = new module.StoryboardService(client, { phase2BindingsEnabled: true });
    plans = new module.GenerationPlanService(client);
    const project = await client.project.create({
      data: { name: "Shot Planner QA", targetAspectRatio: "PORTRAIT_9_16" },
    });
    const storyboard = await storyboards.create(project.id, {
      title: "Three shots",
      creativeBrief: "A deterministic three-shot story.",
    });
    const generated = await storyboards.generate(storyboard.id, 0);
    const preview = await storyboards.previewAssets(generated.headVersionId!);
    await storyboards.resolveAssets(generated.headVersionId!, {
      candidateResultHash: preview.resultHash,
      selections: [],
    });
    await storyboards.decide(generated.headVersionId!, generated.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
    approvedVersionId = generated.headVersionId!;
  });

  afterAll(async () => {
    await reset(client);
    await client.$disconnect();
  });

  it("persists independent runs with identical deterministic contents and restart-safe readback", async () => {
    const sharedKey = randomUUID();
    const [first, concurrentReplay] = await Promise.all([
      plans.create(approvedVersionId, sharedKey),
      plans.create(approvedVersionId, sharedKey),
    ]);
    expect(concurrentReplay.id).toBe(first.id);
    const replay = await plans.create(approvedVersionId, first.idempotencyKey);
    const second = await plans.create(approvedVersionId, randomUUID());
    expect(replay.id).toBe(first.id);
    expect(first.id).not.toBe(second.id);
    expect(first.headVersion?.outputHash).toBe(second.headVersion?.outputHash);
    expect(first.headVersion?.specs).toHaveLength(3);
    expect(first.headVersion?.specs.map((spec) => spec.ordinal)).toEqual([1, 2, 3]);
    expect((await plans.get(first.id)).headVersion?.outputHash).toBe(first.headVersion?.outputHash);
  });

  it("appends owner versions with CAS, immutable history, preflight, approval, and revocation", async () => {
    const plan = await plans.create(approvedVersionId, randomUUID());
    const specs = plan.headVersion!.specs.map((spec) => ({
      schemaVersion: "generation-spec-v1" as const,
      plannerVersion: "deterministic-shot-planner-v1" as const,
      projectId: plan.projectId,
      storyboardId: plan.storyboardId,
      storyboardVersionId: plan.storyboardVersionId,
      manifestId: plan.manifestId,
      storyboardShotId: spec.storyboardShotId,
      shotKey: spec.shotKey,
      ordinal: spec.ordinal,
      startState: spec.startState,
      action: spec.action,
      endState: spec.endState,
      camera: spec.camera,
      composition: spec.composition,
      continuityRequirements: spec.continuityRequirements as string[],
      durationSeconds: spec.durationSeconds,
      positivePrompt: `${spec.positivePrompt}\nOwner note.`,
      references: spec.references.map((reference) => ({
        requirementId: reference.requirementId,
        productionAssetVersionId: reference.productionAssetVersionId,
        characterStateVersionId: reference.characterStateVersionId,
        assetVersionFileId: reference.assetVersionFileId,
        projectAssetId: reference.projectAssetId,
        sha256: reference.expectedSha256,
        referenceUsage: reference.referenceUsage,
      })),
      capabilityRequirements: spec.capabilityRequirements as never,
      inputHash: spec.inputHash,
      referencesHash: spec.referencesHash,
      outputHash: spec.outputHash,
    }));
    const appended = await plans.append(plan.id, plan.rowVersion, {
      parentVersionId: plan.headVersionId!,
      specs,
    });
    expect(appended.headVersion?.versionNumber).toBe(2);
    expect(appended.headVersion?.source).toBe("OWNER");
    await expect(
      plans.append(plan.id, plan.rowVersion, { parentVersionId: plan.headVersionId!, specs }),
    ).rejects.toMatchObject({ code: "PLAN_VERSION_CONFLICT" });
    const preflight = await plans.preflight(appended.headVersionId!);
    expect(preflight).toMatchObject({
      ready: true,
      blockers: [],
      generationAuthorized: false,
    });
    expect(preflight.shotResults).toEqual([
      { ordinal: 1, blockers: [] },
      { ordinal: 2, blockers: [] },
      { ordinal: 3, blockers: [] },
    ]);
    const approved = await plans.decide(
      appended.headVersionId!,
      appended.rowVersion,
      randomUUID(),
      { decision: "APPROVED" },
    );
    expect(approved.generationAuthorized).toBe(false);
    const afterApproval = await plans.get(plan.id);
    expect(afterApproval.approvedVersionId).toBe(appended.headVersionId);
    await plans.decide(appended.headVersionId!, afterApproval.rowVersion, randomUUID(), {
      decision: "REVOKED",
    });
    expect((await plans.get(plan.id)).approvedVersionId).toBeNull();
    await expect(
      client.$executeRawUnsafe(
        `UPDATE "GenerationSpec" SET "positivePrompt" = 'mutated' WHERE "generationPlanVersionId" = '${appended.headVersionId}'`,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it("atomically rejects an unapproved storyboard", async () => {
    const project = await client.project.findFirstOrThrow();
    const storyboard = await storyboards.create(project.id, {
      title: "Unapproved",
      creativeBrief: "Should remain blocked.",
    });
    const generated = await storyboards.generate(storyboard.id, 0);
    await expect(plans.create(generated.headVersionId!, randomUUID())).rejects.toMatchObject({
      code: "STORYBOARD_NOT_APPROVED",
    });
    expect(await client.generationPlan.count({ where: { storyboardId: storyboard.id } })).toBe(0);
  });

  it("enforces project identity at the GenerationPlan composite foreign keys", async () => {
    const approved = await client.storyboardVersion.findUniqueOrThrow({
      where: { id: approvedVersionId },
      include: { manifest: true },
    });
    const foreignProject = await client.project.create({
      data: { name: "Foreign project", targetAspectRatio: "PORTRAIT_9_16" },
    });
    await expect(
      client.generationPlan.create({
        data: {
          projectId: foreignProject.id,
          storyboardId: approved.storyboardId,
          storyboardVersionId: approved.id,
          manifestId: approved.manifest!.id,
          idempotencyKey: randomUUID(),
          requestHash: "f".repeat(64),
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    expect(await client.generationPlan.count({ where: { projectId: foreignProject.id } })).toBe(0);
  });

  it("blocks decisions for archived projects and invalidates preflight after a Storyboard edit", async () => {
    const source = await storyboards.getVersion(approvedVersionId);
    const storyboard = await storyboards.get(source.storyboardId);
    const plan = await plans.create(approvedVersionId, randomUUID());
    await client.project.update({
      where: { id: source.projectId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await expect(
      plans.decide(plan.headVersionId!, plan.rowVersion, randomUUID(), {
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "PROJECT_ARCHIVED" });
    await client.project.update({
      where: { id: source.projectId },
      data: { status: "ACTIVE", archivedAt: null },
    });
    await storyboards.save(storyboard.id, storyboard.rowVersion, {
      parentVersionId: storyboard.headVersionId,
      creativeBrief: storyboard.creativeBrief,
      shots: source.shots.map((shot) => ({
        schemaVersion: "shot-draft-v1" as const,
        shotKey: shot.shotKey,
        ordinal: shot.ordinal,
        title: shot.title,
        creativeDescription: shot.creativeDescription,
        startState: shot.startState,
        action: `${shot.action} New storyboard edit.`,
        endState: shot.endState,
        camera: shot.camera,
        composition: shot.composition,
        continuityRequirements: shot.continuityRequirements as string[],
        durationSeconds: shot.durationSeconds,
        assetRequirements: [],
      })),
    });
    const stale = await plans.preflight(plan.headVersionId!);
    expect(stale.ready).toBe(false);
    expect(stale.blockers).toContain("STORYBOARD_NOT_APPROVED");
  });
});

async function reset(client: ProjectPrisma) {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "GenerationPlanDecision", "GenerationSpecReference", "GenerationSpec", "GenerationPlanVersion", "GenerationPlan", "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "Project" CASCADE',
  );
}
