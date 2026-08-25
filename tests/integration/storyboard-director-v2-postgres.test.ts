import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectPrisma } from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";
describe.runIf(enabled)("Storyboard Director V2 PostgreSQL", () => {
  let client: ProjectPrisma;
  let root: string;
  let service: any;
  let worker: any;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!url.pathname.endsWith("_test")) throw new Error("isolated *_test database required");
    const core = await import("@comfyuiflow/project-core");
    client = core.prisma;
    root = await mkdtemp(path.join(tmpdir(), "director-v2-"));
    const storage = new core.LocalContentStorage({ root });
    service = new core.StoryboardDirectorService(client, storage, {});
    worker = new core.StoryboardDirectorWorker(client, undefined, storage);
    await client.$executeRawUnsafe(
      'TRUNCATE TABLE "StoryboardDirectorProposalDecision", "StoryboardDirectorProposal", "StoryboardDirectorAttempt", "StoryboardDirectorAuthorization", "StoryboardDirectorInputReference", "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "AssetVersionFile", "ProductionAssetVersion", "ProductionAsset", "Asset", "StoredObject", "Project" CASCADE',
    );
    const project = await client.project.create({
      data: { name: "Director QA", targetAspectRatio: "PORTRAIT_9_16" },
    });
    const preserved = await storage.preserve(
      (async function* () {
        yield Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        );
      })(),
    );
    const stored = await client.storedObject.create({
      data: {
        sha256: preserved.sha256,
        byteSize: preserved.byteSize,
        detectedMimeType: preserved.detectedMimeType,
        storageKey: preserved.storageKey,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
    const file = await client.asset.create({
      data: {
        projectId: project.id,
        storedObjectId: stored.id,
        originalFilename: "scene.png",
        displayName: "场景",
        mediaType: "IMAGE",
        role: "SCENE",
        status: "READY",
      },
    });
    const semantic = await client.productionAsset.create({
      data: { projectId: project.id, type: "SCENE", name: "场景", normalizedName: "场景" },
    });
    const version = await client.productionAssetVersion.create({
      data: {
        projectId: project.id,
        productionAssetId: semantic.id,
        versionNumber: 1,
        status: "ACTIVE",
        displayName: "场景",
        factsJson: { location: "studio" },
        publishedAt: new Date(),
      },
    });
    await client.productionAsset.update({
      where: { id: semantic.id },
      data: { currentVersionId: version.id },
    });
    await client.assetVersionFile.create({
      data: {
        projectId: project.id,
        productionAssetVersionId: version.id,
        projectAssetId: file.id,
        referenceUsage: "SCENE_STYLE",
        approvalStatus: "ACCEPTED",
        status: "ACTIVE",
        isPreferred: true,
      },
    });
    const storyboard = await client.storyboard.create({
      data: { projectId: project.id, title: "Terra proposal", creativeBrief: "展示产品" },
    });
    const versionId = randomUUID();
    await client.storyboardVersion.create({
      data: {
        id: versionId,
        projectId: project.id,
        storyboardId: storyboard.id,
        versionNumber: 1,
        source: "OWNER",
        creativeBrief: storyboard.creativeBrief,
        contractVersion: "storyboard-version-v1",
        contentHash: "a".repeat(64),
        shots: {
          create: [
            {
              projectId: project.id,
              shotKey: randomUUID(),
              ordinal: 1,
              title: "现有镜头",
              creativeDescription: "当前版本",
              startState: "开始",
              action: "动作",
              endState: "结束",
              camera: "中景",
              composition: "居中",
              continuityRequirements: [],
              durationSeconds: 2,
            },
          ],
        },
      },
    });
    await client.storyboard.update({
      where: { id: storyboard.id },
      data: { headVersionId: versionId, approvedVersionId: versionId, rowVersion: 1 },
    });
  });
  afterAll(async () => {
    await client.$disconnect();
    await rm(root, { recursive: true, force: true });
  });
  it("previews without writes, consumes once, preserves approval until explicit adoption", async () => {
    const board = await client.storyboard.findFirstOrThrow();
    const beforeRuns = await client.storyboardDirectorRun.count();
    const preview = await service.preview(board.id, {
      profileId: "fake-storyboard-v2",
      maxShotCount: 2,
    });
    expect(preview.externalCalls).toBe(0);
    expect(await client.storyboardDirectorRun.count()).toBe(beforeRuns);
    const run = await service.confirm(board.id, board.rowVersion, {
      profileId: "fake-storyboard-v2",
      maxShotCount: 2,
      selectedAssetVersionFileIds: preview.references.map((r: any) => r.assetVersionFileId),
      previewHash: preview.previewHash,
      idempotencyKey: randomUUID(),
    });
    await expect(
      service.confirm(board.id, board.rowVersion, {
        profileId: "fake-storyboard-v2",
        maxShotCount: 2,
        selectedAssetVersionFileIds: preview.references.map(
          (reference: any) => reference.assetVersionFileId,
        ),
        previewHash: preview.previewHash,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "DIRECTOR_RUN_ALREADY_ACTIVE" });
    await worker.processNext("test-worker");
    const completed = await service.getRun(run.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.attempts).toHaveLength(1);
    const unchanged = await client.storyboard.findUniqueOrThrow({ where: { id: board.id } });
    expect(unchanged.headVersionId).toBe(board.headVersionId);
    expect(unchanged.approvedVersionId).toBe(board.approvedVersionId);
    const proposal = await service.getProposal(completed.proposal!.id);
    const normalized = proposal.normalizedProposalJson as any;
    await service.adopt(proposal.id, unchanged.rowVersion, {
      idempotencyKey: randomUUID(),
      narrativeSummary: normalized.narrativeSummary,
      shots: normalized.shots,
    });
    const adopted = await client.storyboard.findUniqueOrThrow({
      where: { id: board.id },
      include: { headVersion: true },
    });
    expect(adopted.headVersion?.source).toBe("AI_DIRECTOR");
    expect(adopted.approvedVersionId).toBeNull();
    expect(await client.storyboardDirectorAttempt.count()).toBe(1);
    expect(
      await client.storyboardDirectorRun.findUniqueOrThrow({ where: { id: run.id } }),
    ).toMatchObject({ providerCallCount: 0 });
  });
  it("marks an expired consumed lease ambiguous without retrying", async () => {
    const board = await client.storyboard.findFirstOrThrow({ include: { headVersion: true } });
    const run = await client.storyboardDirectorRun.create({
      data: {
        projectId: board.projectId,
        storyboardId: board.id,
        providerId: "fake",
        requestedModelId: "fake-storyboard-v2",
        contractVersion: "storyboard-generation-v2",
        promptTemplateVersion: "storyboard-director-v2",
        requestHash: "c".repeat(64),
        status: "RUNNING",
        safeResultCode: "DIRECTOR_RUNNING",
        providerCallCount: 0,
        maxShotCount: 1,
        headVersionId: board.headVersionId,
        headContentHash: board.headVersion!.contentHash,
        scopeHash: "d".repeat(64),
        priceSnapshotHash: "e".repeat(64),
        billingChannel: "ZERO_CALL_FAKE",
        maxCostUsd: 0,
        priceEffectiveAt: new Date("2026-08-25T00:00:00Z"),
        priceExpiresAt: new Date("2099-01-01T00:00:00Z"),
        idempotencyKey: randomUUID(),
        leaseOwner: "lost-worker",
        leaseExpiresAt: new Date(Date.now() - 1_000),
        authorization: {
          create: {
            projectId: board.projectId,
            maxCalls: 1,
            expiresAt: new Date("2099-01-01T00:00:00Z"),
            consumedAt: new Date(),
          },
        },
        attempts: {
          create: {
            projectId: board.projectId,
            ordinal: 1,
            status: "STARTED",
            safeResultCode: "DIRECTOR_ATTEMPT_STARTED",
          },
        },
      },
    });
    await worker.processNext("recovery-worker");
    expect(
      await client.storyboardDirectorRun.findUniqueOrThrow({ where: { id: run.id } }),
    ).toMatchObject({
      status: "AMBIGUOUS",
      safeResultCode: "DIRECTOR_WORKER_LOST",
      providerCallCount: 0,
    });
    expect(
      await client.storyboardDirectorAttempt.findFirstOrThrow({ where: { runId: run.id } }),
    ).toMatchObject({ status: "AMBIGUOUS" });
  });
});
