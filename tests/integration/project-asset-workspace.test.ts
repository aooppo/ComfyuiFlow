import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  AssetService as AssetServiceType,
  ProjectPrisma,
  ProjectService as ProjectServiceType,
} from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const wav = (() => {
  const samples = Buffer.alloc(800);
  const value = Buffer.alloc(44 + samples.length);
  value.write("RIFF", 0);
  value.writeUInt32LE(36 + samples.length, 4);
  value.write("WAVEfmt ", 8);
  value.writeUInt32LE(16, 16);
  value.writeUInt16LE(1, 20);
  value.writeUInt16LE(1, 22);
  value.writeUInt32LE(8_000, 24);
  value.writeUInt32LE(8_000, 28);
  value.writeUInt16LE(1, 32);
  value.writeUInt16LE(8, 34);
  value.write("data", 36);
  value.writeUInt32LE(samples.length, 40);
  samples.copy(value, 44);
  return value;
})();

async function* chunks(value: Buffer) {
  yield value;
}

async function clearWorkspace(client: ProjectPrisma) {
  await client.understandingApplication.deleteMany();
  await client.understandingReview.deleteMany();
  await client.assetUnderstandingRevision.deleteMany();
  await client.aiProviderAttempt.deleteMany();
  await client.assetUnderstandingRun.deleteMany();
  await client.aiCallGrant.deleteMany();
  await client.assetUnderstandingManifestItem.deleteMany();
  await client.assetUnderstandingManifest.deleteMany();
  await client.characterStateComponent.deleteMany();
  await client.characterStateVersion.deleteMany();
  await client.characterVersion.deleteMany();
  await client.characterProfile.deleteMany();
  await client.productionAssetRelation.deleteMany();
  await client.assetVersionFile.deleteMany();
  await client.productionAssetVersion.deleteMany();
  await client.productionAsset.deleteMany();
  await client.projectActivity.deleteMany();
  await client.assetImportAttempt.deleteMany();
  await client.assetImportBatch.deleteMany();
  await client.asset.deleteMany();
  await client.mediaProbeResult.deleteMany();
  await client.storedObject.deleteMany();
  await client.project.deleteMany();
}

describe.runIf(enabled)("Project/Asset PostgreSQL workspace", () => {
  let projectService: ProjectServiceType;
  let assetService: AssetServiceType;
  let client: ProjectPrisma;
  let storageRoot: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), "comfyuiflow-project-integration-"));
    const module = await import("@comfyuiflow/project-core");
    client = module.prisma;
    projectService = new module.ProjectService(client);
    assetService = new module.AssetService(
      client,
      new module.LocalContentStorage({ root: storageRoot, maxBytes: 10_000 }),
    );
    await clearWorkspace(client);
  });

  afterAll(async () => {
    await clearWorkspace(client);
    await client?.$disconnect();
    await rm(storageRoot, { force: true, recursive: true });
  });

  it("persists the complete project lifecycle with append-only activity", async () => {
    const created = await projectService.create({
      name: "DECOROLALA Coffee Table",
      brief: "Four-second source study",
      targetAspectRatio: "PORTRAIT_9_16",
    });
    const updated = await projectService.update(created.id, { name: "Coffee Table Campaign" });
    expect(updated.name).toBe("Coffee Table Campaign");
    expect((await projectService.list())[0]?.id).toBe(created.id);
    expect((await projectService.archive(created.id)).status).toBe("ARCHIVED");
    expect((await projectService.restore(created.id)).status).toBe("ACTIVE");
    expect(await client.projectActivity.count({ where: { projectId: created.id } })).toBe(4);
  });

  it("imports, deduplicates, filters, edits, reads, and provenance-safely removes an asset", async () => {
    const project = (await projectService.list())[0]!;
    const imported = await assetService.importStream({
      projectId: project.id,
      filename: "../source.png",
      role: "PRODUCT",
      stream: chunks(png),
    });
    expect(imported.outcome).toBe("IMPORTED");
    if (imported.outcome !== "IMPORTED") throw new Error("Expected import success");
    expect(imported.asset.sha256).toBe(createHash("sha256").update(png).digest("hex"));
    expect(imported.asset.width).toBe(1);

    const duplicate = await assetService.importStream({
      projectId: project.id,
      filename: "duplicate.png",
      role: "SCENE",
      stream: chunks(png),
    });
    expect(duplicate.outcome).toBe("DUPLICATE");
    expect((await assetService.list(project.id, { role: "PRODUCT" })).count).toBe(1);

    const audio = await assetService.importStream({
      projectId: project.id,
      filename: "ambience.wav",
      role: "AUDIO",
      stream: chunks(wav),
    });
    expect(audio.outcome).toBe("IMPORTED");
    if (audio.outcome !== "IMPORTED") throw new Error("Expected audio import success");
    expect(audio.asset.mediaType).toBe("AUDIO");

    const updated = await assetService.update(imported.asset.id, {
      displayName: "Hero table",
      notes: "Immutable source",
    });
    expect(updated.sha256).toBe(imported.asset.sha256);
    const content = await assetService.content(updated.id);
    expect(await readFile(content.absolutePath)).toEqual(png);

    const module = await import("@comfyuiflow/project-core");
    const restartedAssetService = new module.AssetService(
      client,
      new module.LocalContentStorage({ root: storageRoot, maxBytes: 10_000 }),
    );
    const restartedContent = await restartedAssetService.content(updated.id);
    expect(
      createHash("sha256")
        .update(await readFile(restartedContent.absolutePath))
        .digest("hex"),
    ).toBe(updated.sha256);

    expect((await assetService.remove(updated.id)).status).toBe("REMOVED");
    expect((await assetService.list(project.id, { mediaType: "IMAGE" })).count).toBe(0);
    expect((await assetService.list(project.id, { mediaType: "AUDIO" })).count).toBe(1);
    expect(await client.storedObject.count()).toBe(2);
    expect(await client.assetImportAttempt.count({ where: { projectId: project.id } })).toBe(3);
    expect(await readFile(content.absolutePath)).toEqual(png);
  });

  it("returns the first useful view of a 500-asset project within two seconds", async () => {
    const project = await projectService.create({
      name: "Performance library",
      brief: null,
      targetAspectRatio: "SQUARE_1_1",
    });
    const objects = Array.from({ length: 500 }, (_, index) => ({
      id: randomUUID(),
      sha256: (index + 10_000).toString(16).padStart(64, "0"),
      byteSize: 1n,
      detectedMimeType: "image/png",
      storageKey: `sha256/performance/${index}`,
      verificationStatus: "VERIFIED" as const,
      verifiedAt: new Date(),
    }));
    await client.storedObject.createMany({ data: objects });
    await client.asset.createMany({
      data: objects.map((object, index) => ({
        projectId: project.id,
        storedObjectId: object.id,
        originalFilename: `asset-${index}.png`,
        displayName: `Asset ${index}`,
        mediaType: "IMAGE",
        role: index % 2 === 0 ? "SCENE" : "PRODUCT",
        status: "READY" as const,
      })),
    });

    const started = performance.now();
    const result = await assetService.list(project.id);
    const elapsed = performance.now() - started;
    expect(result.count).toBe(500);
    expect(elapsed).toBeLessThan(2_000);
  });
});
