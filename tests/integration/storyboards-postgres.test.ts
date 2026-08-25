import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ProjectPrisma,
  StoryboardService as StoryboardServiceType,
} from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";

describe.runIf(enabled)("Storyboard PostgreSQL workspace", () => {
  let client: ProjectPrisma;
  let closed: StoryboardServiceType;
  let open: StoryboardServiceType;
  let projectId: string;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test")) {
      throw new Error("Storyboard PostgreSQL tests require an isolated *_test database");
    }
    const module = await import("@comfyuiflow/project-core");
    client = module.prisma;
    await reset(client);
    closed = new module.StoryboardService(client, { phase2BindingsEnabled: false });
    open = new module.StoryboardService(client, { phase2BindingsEnabled: true });
    const project = await client.project.create({
      data: {
        name: "Storyboard QA",
        brief: "Three-shot zero-call test",
        targetAspectRatio: "PORTRAIT_9_16",
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await reset(client);
    await client.$disconnect();
  });

  it("creates, generates, appends, and reloads immutable three-shot versions", async () => {
    const storyboard = await closed.create(projectId, {
      title: "Coffee table reveal",
      creativeBrief: "Introduce, reveal, and resolve the product story.",
    });
    const generated = await closed.generate(storyboard.id, 0);
    expect(generated.rowVersion).toBe(1);
    expect(generated.headVersion?.shots.map((shot) => shot.ordinal)).toEqual([1, 2, 3]);
    expect(await client.storyboardDirectorRun.count({ where: { providerCallCount: 0 } })).toBe(1);

    const input = {
      parentVersionId: generated.headVersionId,
      creativeBrief: generated.creativeBrief,
      shots: generated.headVersion!.shots.map((shot) => ({
        schemaVersion: "shot-draft-v1" as const,
        shotKey: shot.shotKey,
        ordinal: shot.ordinal,
        title: shot.title,
        creativeDescription: shot.creativeDescription,
        startState: shot.startState,
        action: `${shot.action} Owner refinement.`,
        endState: shot.endState,
        camera: shot.camera,
        composition: shot.composition,
        continuityRequirements: shot.continuityRequirements as string[],
        durationSeconds: shot.durationSeconds,
        assetRequirements: [],
      })),
    };
    const saved = await closed.save(storyboard.id, 1, input);
    expect(saved.rowVersion).toBe(2);
    await expect(closed.save(storyboard.id, 1, input)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    expect(await client.storyboardVersion.count({ where: { storyboardId: storyboard.id } })).toBe(
      2,
    );
    await expect(
      client.$executeRawUnsafe(
        `UPDATE "StoryboardVersion" SET "creativeBrief" = 'mutated' WHERE "id" = '${saved.headVersionId}'`,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it("keeps formal writes closed, then freezes and explicitly approves under injected gate", async () => {
    const storyboard = await client.storyboard.findFirstOrThrow({ where: { projectId } });
    const preview = await closed.previewAssets(storyboard.headVersionId!);
    expect(preview.results).toEqual([]);
    await expect(
      closed.resolveAssets(storyboard.headVersionId!, {
        candidateResultHash: preview.resultHash,
        selections: [],
      }),
    ).rejects.toMatchObject({ code: "PHASE2_GATE_CLOSED" });
    expect(await client.assetResolutionManifest.count()).toBe(0);

    const manifest = await open.resolveAssets(storyboard.headVersionId!, {
      candidateResultHash: preview.resultHash,
      selections: [],
    });
    expect(manifest.bindings).toEqual([]);
    const decision = await open.decide(
      storyboard.headVersionId!,
      storyboard.rowVersion,
      randomUUID(),
      { decision: "APPROVED" },
    );
    expect(decision.generationAuthorized).toBe(false);
    const readback = await open.get(storyboard.id);
    expect(readback.approvedVersionId).toBe(storyboard.headVersionId);
  });
});

async function reset(client: ProjectPrisma) {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "Project" CASCADE',
  );
}
