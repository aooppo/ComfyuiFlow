import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ProjectPrisma,
  ProductionAssetService as ProductionAssetServiceType,
} from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";

describe.runIf(enabled)("Phase 2 convergence PostgreSQL gates", () => {
  let client: ProjectPrisma;
  let service: ProductionAssetServiceType;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test")) {
      throw new Error("Phase 2 PostgreSQL tests require an isolated *_test database");
    }
    const module = await import("@comfyuiflow/project-core");
    client = module.prisma;
    service = new module.ProductionAssetService(client);
    await reset(client);
  });

  afterAll(async () => {
    await reset(client);
    await client.$disconnect();
  });

  it("installs project-composite foreign keys and immutable history triggers", async () => {
    const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT conname AS name FROM pg_constraint WHERE conname IN (
        'AssetImportAttempt_project_asset_composite_fkey',
        'ProductionAssetVersion_project_asset_composite_fkey',
        'AssetVersionFile_project_version_composite_fkey',
        'CharacterStateComponent_project_state_fkey',
        'AssetUnderstandingRun_project_manifest_fkey'
      ) ORDER BY conname`,
    );
    expect(rows.map((row) => row.name)).toHaveLength(5);
    const triggers = await client.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE '%published_immutable'`,
    );
    expect(triggers.map((row) => row.name).sort()).toEqual([
      "CharacterStateVersion_published_immutable",
      "CharacterVersion_published_immutable",
      "ProductionAssetVersion_published_immutable",
    ]);
  });

  it("atomically rejects a cross-project file reference", async () => {
    const [first, second] = await Promise.all([project("First"), project("Second")]);
    const object = await client.storedObject.create({
      data: {
        sha256: "1".repeat(64),
        byteSize: 1n,
        detectedMimeType: "image/png",
        storageKey: "sha256/test/one",
      },
    });
    const asset = await client.asset.create({
      data: {
        projectId: first.id,
        storedObjectId: object.id,
        originalFilename: "one.png",
        displayName: "One",
        mediaType: "IMAGE",
        role: "PRODUCT",
      },
    });
    await expect(
      client.assetImportAttempt.create({
        data: {
          projectId: second.id,
          submittedFilename: "forged.png",
          requestedRole: "PRODUCT",
          outcome: "DUPLICATE",
          resultCode: "FORGED",
          assetId: asset.id,
        },
      }),
    ).rejects.toThrow();
    expect(await client.assetImportAttempt.count({ where: { projectId: second.id } })).toBe(0);
  });

  it("permits only one concurrent ACTIVE version and protects published content", async () => {
    const owner = await project("Version owner");
    const asset = await service.create(owner.id, { type: "OUTFIT", name: "Gala dress" });
    const firstDraft = asset.versions![0]!;
    const secondDraft = await service.createVersion(asset.id, firstDraft.id);
    const results = await Promise.allSettled([
      service.publishVersion(firstDraft.id),
      service.publishVersion(secondDraft.id),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      await client.productionAssetVersion.count({
        where: { productionAssetId: asset.id, status: "ACTIVE" },
      }),
    ).toBe(1);
    const active = await client.productionAssetVersion.findFirstOrThrow({
      where: { productionAssetId: asset.id, status: "ACTIVE" },
    });
    await expect(
      client.productionAssetVersion.update({
        where: { id: active.id },
        data: { displayName: "Mutated after publish" },
      }),
    ).rejects.toThrow(/immutable/);
    const readback = await client.productionAssetVersion.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(readback.displayName).not.toBe("Mutated after publish");
  });

  async function project(name: string) {
    return client.project.create({
      data: {
        id: randomUUID(),
        name,
        targetAspectRatio: "PORTRAIT_9_16",
      },
    });
  }
});

async function reset(client: ProjectPrisma) {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "UnderstandingApplication", "UnderstandingReview", "AssetUnderstandingRevision", "AiProviderAttempt", "AssetUnderstandingRun", "AiCallGrant", "AssetUnderstandingManifestItem", "AssetUnderstandingManifest", "CharacterStateComponent", "CharacterStateVersion", "CharacterVersion", "CharacterProfile", "ProductionAssetRelation", "AssetVersionFile", "ProductionAssetVersion", "ProductionAsset", "ProjectActivity", "AssetImportAttempt", "AssetImportBatch", "Asset", "MediaProbeResult", "StoredObject", "Project" CASCADE',
  );
}
