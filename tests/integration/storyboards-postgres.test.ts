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
    await createActiveSemanticAsset(client, projectId, "PROP", "Coffee Table");
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
    expect(generated.headVersion?.shots.map((shot) => shot.requirements)).toEqual([
      [
        expect.objectContaining({
          requirementKey: "shot-1-prop-coffee-table",
          contractVersion: "asset-candidate-v1",
        }),
      ],
      [
        expect.objectContaining({
          requirementKey: "shot-2-prop-coffee-table",
          contractVersion: "asset-candidate-v1",
        }),
      ],
      [
        expect.objectContaining({
          requirementKey: "shot-3-prop-coffee-table",
          contractVersion: "asset-candidate-v1",
        }),
      ],
    ]);
    const generatedPreview = await closed.previewAssets(generated.headVersionId!);
    expect(generatedPreview.gaps).toEqual([]);
    const generatedManifest = await open.resolveAssets(generated.headVersionId!, {
      candidateResultHash: generatedPreview.resultHash,
      selections: generatedPreview.results.map((entry) => ({
        requirementId: entry.requirementId,
        assetVersionFileIds: [entry.result.eligible[0]!.bindingId],
      })),
    });
    expect(generatedManifest.bindings).toHaveLength(3);
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
    expect(
      await client.assetResolutionManifest.count({
        where: { storyboardVersionId: storyboard.headVersionId! },
      }),
    ).toBe(0);

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

  it("hard-deletes only empty storyboards and archives/restores versioned history", async () => {
    const empty = await open.create(projectId, {
      title: "Accidental empty card",
      creativeBrief: "Delete before any durable history exists.",
    });
    await expect(open.deleteEmpty(empty.id, empty.rowVersion)).resolves.toEqual({
      id: empty.id,
      deleted: true,
    });
    expect(await client.storyboard.count({ where: { id: empty.id } })).toBe(0);

    const versioned = await open.create(projectId, {
      title: "Recoverable history",
      creativeBrief: "Archive without destroying immutable versions.",
    });
    const generated = await open.generate(versioned.id, versioned.rowVersion);
    const before = await open.getVersion(generated.headVersionId!);
    const archived = await open.archive(versioned.id, generated.rowVersion);
    expect(archived.status).toBe("ARCHIVED");
    expect((await open.list(projectId)).some((item) => item.id === versioned.id)).toBe(false);
    expect((await open.list(projectId, 50, "ARCHIVED")).map((item) => item.id)).toContain(
      versioned.id,
    );
    await expect(open.generate(versioned.id, archived.rowVersion)).rejects.toMatchObject({
      code: "STORYBOARD_ARCHIVED",
    });
    const restored = await open.restore(versioned.id, archived.rowVersion);
    expect(restored.status).toBe("ACTIVE");
    expect((await open.getVersion(generated.headVersionId!)).contentHash).toBe(before.contentHash);
    await expect(open.deleteEmpty(versioned.id, restored.rowVersion)).rejects.toMatchObject({
      code: "STORYBOARD_DELETE_REQUIRES_ARCHIVE",
    });
  });
});

async function reset(client: ProjectPrisma) {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "Project" CASCADE',
  );
}

async function createActiveSemanticAsset(
  client: ProjectPrisma,
  projectId: string,
  type: "PROP",
  name: string,
) {
  const asset = await client.productionAsset.create({
    data: {
      projectId,
      type,
      name,
      normalizedName: name.toLocaleLowerCase(),
    },
  });
  const version = await client.productionAssetVersion.create({
    data: {
      projectId,
      productionAssetId: asset.id,
      versionNumber: 1,
      displayName: name,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
  await client.productionAsset.update({
    where: { id: asset.id },
    data: { currentVersionId: version.id },
  });
  const nonce = randomUUID().replaceAll("-", "");
  const storedObject = await client.storedObject.create({
    data: {
      sha256: `${nonce}${nonce}`,
      byteSize: 1,
      detectedMimeType: "image/png",
      storageKey: `tests/storyboard/${nonce}`,
      verificationStatus: "VERIFIED",
    },
  });
  const file = await client.asset.create({
    data: {
      projectId,
      storedObjectId: storedObject.id,
      originalFilename: `${name}.png`,
      displayName: name,
      mediaType: "IMAGE",
      role: "PROP",
      status: "READY",
      width: 10,
      height: 10,
    },
  });
  await client.assetVersionFile.create({
    data: {
      projectId,
      productionAssetVersionId: version.id,
      projectAssetId: file.id,
      referenceUsage: "PROP_DETAIL",
      approvalStatus: "ACCEPTED",
      status: "ACTIVE",
    },
  });
}
