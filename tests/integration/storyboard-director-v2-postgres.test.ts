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
  let storage: any;
  let service: any;
  let worker: any;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!url.pathname.endsWith("_test")) throw new Error("isolated *_test database required");
    const core = await import("@comfyuiflow/project-core");
    const { FakeStoryboardProvider } = await import("@comfyuiflow/ai-providers");
    client = core.prisma;
    root = await mkdtemp(path.join(tmpdir(), "director-v2-"));
    storage = new core.LocalContentStorage({ root });
    service = new core.StoryboardDirectorService(client, storage, {}, { allowTestFixtures: true });
    worker = new core.StoryboardDirectorWorker(
      client,
      { fake: new FakeStoryboardProvider() },
      storage,
    );
    await client.$executeRawUnsafe(
      'TRUNCATE TABLE "GenerationImplementationEvidence", "ShotExecutionPlan", "GenerationImplementation", "StoryboardDirectorProposalDecision", "StoryboardDirectorProposal", "StoryboardDirectorAttempt", "StoryboardDirectorAuthorization", "StoryboardDirectorInputReference", "StoryboardDecision", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardDirectorRun", "StoryboardVersion", "Storyboard", "AssetVersionFile", "ProductionAssetVersion", "ProductionAsset", "Asset", "StoredObject", "Project" CASCADE',
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
  it("atomically creates one Storyboard and one bounded real Director Run idempotently", async () => {
    const core = await import("@comfyuiflow/project-core");
    const project = await client.project.findFirstOrThrow();
    const createService = new core.StoryboardDirectorService(client, storage, {
      PROJECT_STORYBOARD_DIRECTOR_LIVE_ENABLED: "true",
      STORYBOARD_DIRECTOR_CODEXMANAGER_BILLING_CHANNEL: "LOCAL_TEST_BILLING",
      STORYBOARD_DIRECTOR_CODEXMANAGER_MAX_COST_USD: "5.00",
      STORYBOARD_DIRECTOR_CODEXMANAGER_PRICE_EFFECTIVE_AT: "2026-08-25T00:00:00.000Z",
      STORYBOARD_DIRECTOR_CODEXMANAGER_PRICE_EXPIRES_AT: "2099-12-31T23:59:59.000Z",
    });
    const input = {
      title: "Create with AI",
      creativeBrief: "Generate a coherent three-shot scene proposal.",
    };
    const before = await Promise.all([
      client.storyboard.count(),
      client.storyboardDirectorRun.count(),
      client.storyboardDirectorAuthorization.count(),
      client.storyboardDirectorAttempt.count(),
    ]);
    const preview = await createService.previewCreate(project.id, input);
    expect(preview).toMatchObject({
      providerId: "codexmanager-local",
      modelId: "gpt-5.6-terra",
      maxShotCount: 3,
      maxCostUsd: 5,
      maxExternalCalls: 1,
      externalCalls: 0,
      canConfirm: true,
      retryPolicy: "NO_RETRY_NO_FALLBACK",
    });
    const request = {
      ...input,
      previewHash: preview.previewHash,
      idempotencyKey: randomUUID(),
    };
    const created = await createService.createAndConfirm(project.id, request);
    const repeated = await createService.createAndConfirm(project.id, request);
    expect(() => JSON.stringify(created)).not.toThrow();
    expect(() => JSON.stringify(repeated)).not.toThrow();
    expect(repeated.id).toBe(created.id);
    const exact = await client.storyboard.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        headVersion: { include: { shots: true } },
        runs: { include: { authorization: true, inputReferences: true, attempts: true } },
      },
    });
    expect(exact).toMatchObject({ rowVersion: 1, headVersion: { source: "OWNER" } });
    expect(exact.headVersion?.shots).toHaveLength(0);
    expect(exact.runs).toHaveLength(1);
    expect(exact.runs[0]).toMatchObject({
      providerId: "codexmanager-local",
      requestedModelId: "gpt-5.6-terra",
      maxShotCount: 3,
      providerCallCount: 0,
      status: "QUEUED",
      authorization: { maxCalls: 1, consumedAt: null },
      attempts: [],
    });
    expect(exact.runs[0]!.inputReferences.length).toBeGreaterThan(0);
    await expect(
      createService.createAndConfirm(project.id, {
        ...request,
        creativeBrief: "A changed scope must not reuse the preview.",
      }),
    ).rejects.toMatchObject({ code: "DIRECTOR_CREATE_PREVIEW_STALE" });
    await expect(
      Promise.all([
        client.storyboard.count(),
        client.storyboardDirectorRun.count(),
        client.storyboardDirectorAuthorization.count(),
        client.storyboardDirectorAttempt.count(),
      ]),
    ).resolves.toEqual([before[0] + 1, before[1] + 1, before[2] + 1, before[3]]);

    const emptyProject = await client.project.create({
      data: { name: "No eligible Director references", targetAspectRatio: "PORTRAIT_9_16" },
    });
    const emptyPreview = await createService.previewCreate(emptyProject.id, input);
    expect(emptyPreview.canConfirm).toBe(false);
    const beforeEmpty = await client.storyboard.count({ where: { projectId: emptyProject.id } });
    await expect(
      createService.createAndConfirm(emptyProject.id, {
        ...input,
        previewHash: emptyPreview.previewHash,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "DIRECTOR_REFERENCE_SELECTION_INVALID" });
    await expect(client.storyboard.count({ where: { projectId: emptyProject.id } })).resolves.toBe(
      beforeEmpty,
    );
    await client.storyboardDirectorRun.update({
      where: { id: created.directorRun.id },
      data: {
        status: "FAILED",
        safeResultCode: "TEST_ZERO_CALL_CANCELLED",
        finishedAt: new Date(),
      },
    });
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
  it("adopts one Fake split repair with stable keys, revalidated bindings, and partial invalidation", async () => {
    const core = await import("@comfyuiflow/project-core");
    const project = await client.project.findFirstOrThrow();
    const storyboards = new core.StoryboardService(client, { phase2BindingsEnabled: true });
    const generationPlans = new core.GenerationPlanService(client);
    const repairService = new core.WorkflowRepairService(client);
    const board = await storyboards.create(project.id, {
      title: "Repair branch",
      creativeBrief: "Repair only the blocked middle Shot",
    });
    const generated = await storyboards.generate(board.id, board.rowVersion);
    const sourceVersion = await storyboards.getVersion(generated.headVersionId!);
    const assetPreview = await storyboards.previewAssets(sourceVersion.id);
    const selections = assetPreview.results.map((entry: any) => ({
      requirementId: entry.requirementId,
      assetVersionFileIds: entry.result.eligible.map((candidate: any) => candidate.bindingId),
    }));
    await storyboards.resolveAssets(sourceVersion.id, {
      candidateResultHash: assetPreview.resultHash,
      selections,
    });
    await storyboards.decide(sourceVersion.id, generated.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
    const generationPlan = await generationPlans.create(sourceVersion.id, randomUUID());
    await generationPlans.decide(
      generationPlan.headVersionId!,
      generationPlan.rowVersion,
      randomUUID(),
      { decision: "APPROVED" },
    );
    const loadedPlan = await generationPlans.get(generationPlan.id);
    const specs = loadedPlan.headVersion!.specs;
    const implementation = await client.generationImplementation.create({
      data: {
        id: randomUUID(),
        implementationKey: `repair-test-${randomUUID()}`,
        version: "1.0.0",
        providerProfileId: "fake-video-v1",
        modelProfileId: "fake-video-v1",
        executorType: "DIRECT_PROVIDER_API",
        adapterId: "repair-test-adapter",
        adapterVersion: "1.0.0",
        registrySha256: "1".repeat(64),
        capabilitySnapshotHash: "2".repeat(64),
        constraintsSnapshotHash: "3".repeat(64),
        patternSnapshotHash: "4".repeat(64),
        runtimeSnapshotHash: "5".repeat(64),
        compilerSnapshotHash: "6".repeat(64),
        status: "READY",
      },
    });
    const shotPlans = [] as any[];
    for (const [index, spec] of specs.entries()) {
      const payload = {
        schemaVersion: "shot-execution-plan-draft-v1",
        blockerCodes: index === 1 ? ["UNSUPPORTED_REQUIREMENTS"] : [],
        inputBindings:
          index === 2
            ? [
                {
                  type: "PREVIOUS_SHOT_FINAL_FRAME",
                  sourceShotKey: specs[1]!.shotKey,
                  inputSlot: "first_frame",
                },
              ]
            : [],
      };
      shotPlans.push(
        await client.shotExecutionPlan.create({
          data: {
            id: randomUUID(),
            projectId: project.id,
            generationPlanVersionId: loadedPlan.headVersion!.id,
            generationSpecId: spec.id,
            implementationId: index === 1 ? null : implementation.id,
            executorType: index === 1 ? null : implementation.executorType,
            adapterId: index === 1 ? null : implementation.adapterId,
            adapterVersion: index === 1 ? null : implementation.adapterVersion,
            planningInputHash: String(index + 1).repeat(64),
            requirementsHash: String(index + 4).repeat(64),
            capabilitySnapshotHash: String(index + 7).repeat(64),
            payloadJson: payload,
            planTemplateSha256: core.canonicalSha256(payload),
            planningOutcome: index === 1 ? "BLOCKED" : "READY",
            blockerCode: index === 1 ? "UNSUPPORTED_REQUIREMENTS" : null,
          },
        }),
      );
    }
    const repair = await repairService.preview(shotPlans[1]!.id);
    expect(repair.externalCalls).toBe(0);
    const split = repair.proposals.find((proposal: any) => proposal.action === "SPLIT_SHOT")!;
    const directorPreview = await service.previewRepair(shotPlans[1]!.id, {
      proposalHash: split.proposalHash,
      impactHash: repair.impactHash,
      action: "SPLIT_SHOT",
      profileId: "fake-storyboard-v2",
    });
    const currentBoard = await client.storyboard.findUniqueOrThrow({ where: { id: board.id } });
    const run = await service.confirmRepair(shotPlans[1]!.id, currentBoard.rowVersion, {
      proposalHash: split.proposalHash,
      impactHash: repair.impactHash,
      action: "SPLIT_SHOT",
      profileId: "fake-storyboard-v2",
      selectedAssetVersionFileIds: directorPreview.references.map(
        (reference: any) => reference.assetVersionFileId,
      ),
      previewHash: directorPreview.previewHash,
      idempotencyKey: randomUUID(),
    });
    await worker.processNext("repair-worker");
    const completed = await service.getRun(run.id);
    expect(completed).toMatchObject({
      status: "COMPLETED",
      runKind: "SHOT_REPAIR",
      providerCallCount: 0,
    });
    expect(completed.attempts).toHaveLength(1);
    const proposal = await service.getProposal(completed.proposal!.id);
    const normalized = proposal.normalizedProposalJson as any;
    expect(normalized.shots).toHaveLength(2);
    expect(normalized.shots.map((shot: any) => shot.shotKey)).toEqual([
      expect.stringMatching(/^[a-f0-9-]{36}$/),
      expect.stringMatching(/^[a-f0-9-]{36}$/),
    ]);
    expect(new Set(normalized.shots.map((shot: any) => shot.shotKey)).size).toBe(2);
    const beforeStale = await client.storyboard.findUniqueOrThrow({ where: { id: board.id } });
    await expect(
      service.adoptRepair(proposal.id, beforeStale.rowVersion, {
        idempotencyKey: randomUUID(),
        proposalHash: "f".repeat(64),
        impactHash: repair.impactHash,
        narrativeSummary: normalized.narrativeSummary,
        shots: normalized.shots,
      }),
    ).rejects.toMatchObject({ code: "REPAIR_PROPOSAL_STALE" });
    expect(
      (await client.storyboard.findUniqueOrThrow({ where: { id: board.id } })).headVersionId,
    ).toBe(beforeStale.headVersionId);
    const adopted = await service.adoptRepair(proposal.id, beforeStale.rowVersion, {
      idempotencyKey: randomUUID(),
      proposalHash: proposal.outputHash,
      impactHash: repair.impactHash,
      narrativeSummary: normalized.narrativeSummary,
      shots: normalized.shots,
    });
    expect(adopted).toMatchObject({
      storyboardVersionAppended: true,
      externalCalls: 0,
      generationAuthorized: false,
      affectedShotKeys: [specs[1]!.shotKey, specs[2]!.shotKey],
    });
    const repairedBoard = await client.storyboard.findUniqueOrThrow({
      where: { id: board.id },
      include: {
        headVersion: {
          include: {
            shots: { include: { requirements: true }, orderBy: { ordinal: "asc" } },
            manifest: { include: { bindings: true } },
          },
        },
      },
    });
    expect(repairedBoard.approvedVersionId).toBeNull();
    expect(repairedBoard.headVersion?.parentVersionId).toBe(sourceVersion.id);
    expect(repairedBoard.headVersion?.shots).toHaveLength(4);
    expect(repairedBoard.headVersion?.shots[0]?.shotKey).toBe(specs[0]!.shotKey);
    expect(repairedBoard.headVersion?.shots[3]?.shotKey).toBe(specs[2]!.shotKey);
    expect(repairedBoard.headVersion?.shots.slice(1, 3).map((shot) => shot.shotKey)).toEqual(
      normalized.shots.map((shot: any) => shot.shotKey),
    );
    expect(repairedBoard.headVersion?.manifest?.policyVersion).toBe(
      "repair-binding-revalidation-v1",
    );
    expect(repairedBoard.headVersion?.manifest?.bindings.length).toBeGreaterThan(0);
    expect(
      await client.shotExecutionPlan.findUniqueOrThrow({ where: { id: shotPlans[0]!.id } }),
    ).toMatchObject({ lifecycleStatus: "DRAFT" });
    for (const plan of shotPlans.slice(1)) {
      expect(
        await client.shotExecutionPlan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).toMatchObject({
        lifecycleStatus: "INVALIDATED",
        invalidationCode: "STORYBOARD_REPAIR_ADOPTED",
      });
    }
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
