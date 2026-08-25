import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ContinuityService as ContinuityServiceType,
  KeyframeService as KeyframeServiceType,
  ProjectPrisma,
  StoryboardService as StoryboardServiceType,
} from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";

describe.runIf(enabled)("Continuity PostgreSQL lineage", () => {
  let client: ProjectPrisma;
  let storyboards: StoryboardServiceType;
  let continuity: ContinuityServiceType;
  let keyframes: KeyframeServiceType;
  let storyboardId: string;
  let storageRoot: string;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test"))
      throw new Error("Continuity tests require an isolated *_test database");
    const module = await import("@comfyuiflow/project-core");
    client = module.prisma;
    storyboards = new module.StoryboardService(client, { phase2BindingsEnabled: true });
    continuity = new module.ContinuityService(client);
    storageRoot = await mkdtemp(join(tmpdir(), "comfyuiflow-continuity-test-"));
    keyframes = new module.KeyframeService(
      client,
      new module.LocalContentStorage({ root: storageRoot }),
    );

    const project = await client.project.create({
      data: { name: "Continuity QA", targetAspectRatio: "PORTRAIT_9_16" },
    });
    const storyboard = await storyboards.create(project.id, {
      title: "Three shared boundaries",
      creativeBrief: "Verify N+1 continuity lineage without external calls.",
    });
    storyboardId = storyboard.id;
    const generated = await storyboards.generate(storyboard.id, 0);
    const preview = await storyboards.previewAssets(generated.headVersionId!);
    await storyboards.resolveAssets(generated.headVersionId!, {
      candidateResultHash: preview.resultHash,
      selections: [],
    });
    await storyboards.decide(generated.headVersionId!, generated.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
  });

  afterAll(async () => {
    await client.$disconnect();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("persists one shared boundary per cut and blocks paid keyframes when references are absent", async () => {
    const current = await storyboards.get(storyboardId);
    const version = await continuity.suggest(storyboardId, {
      expectedStoryboardRowVersion: current.rowVersion,
      idempotencyKey: randomUUID(),
    });
    expect(version.boundaries).toHaveLength(4);
    expect(version.shotStates).toHaveLength(3);
    expect(version.shotStates[0]?.endBoundaryId).toBe(version.shotStates[1]?.startBoundaryId);
    expect(version.shotStates[1]?.endBoundaryId).toBe(version.shotStates[2]?.startBoundaryId);

    const preflight = await continuity.preflight(version.id);
    expect(preflight).toMatchObject({ ready: true, externalCalls: 0, blockers: [] });
    await continuity.decide(version.id, {
      decision: "APPROVED",
      preflightHash: preflight.preflightHash,
      idempotencyKey: randomUUID(),
    });

    const imagePreview = await keyframes.preview(version.id, {
      providerProfileId: "fake-keyframe-v1",
    });
    expect(imagePreview).toMatchObject({
      ready: false,
      maximumCalls: 4,
      externalCalls: 0,
      noRetry: true,
    });
    expect(imagePreview.blockers).toContain("KEYFRAME_REFERENCES_MISSING");
    await expect(
      keyframes.create(version.id, {
        providerProfileId: "fake-keyframe-v1",
        planHash: imagePreview.planHash,
      }),
    ).rejects.toMatchObject({ code: "KEYFRAME_REFERENCES_MISSING" });
    expect(await client.keyframeAttempt.count()).toBe(0);
  });

  it("runs the bounded Fake N+1 contact sheet and requires human approval", async () => {
    const module = await import("@comfyuiflow/project-core");
    const storage = new module.LocalContentStorage({ root: storageRoot });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEklEQVR4nGNkYPjLwMDAwgAGAAsXAQPfmWhAAAAAAElFTkSuQmCC",
      "base64",
    );
    const preserved = await storage.preserve(
      (async function* () {
        yield png;
      })(),
    );
    const storyboard = await storyboards.get(storyboardId);
    const stored = await client.storedObject.create({
      data: {
        sha256: preserved.sha256,
        byteSize: BigInt(preserved.byteSize),
        detectedMimeType: preserved.detectedMimeType,
        storageKey: preserved.storageKey,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
    const projectAsset = await client.asset.create({
      data: {
        projectId: storyboard.projectId,
        storedObjectId: stored.id,
        originalFilename: "approved-room.png",
        displayName: "批准的主场景",
        mediaType: "IMAGE",
        role: "SCENE",
        status: "READY",
        width: 2,
        height: 2,
      },
    });
    const productionAsset = await client.productionAsset.create({
      data: {
        projectId: storyboard.projectId,
        type: "SCENE",
        name: "批准的主场景",
        normalizedName: "批准的主场景",
      },
    });
    const productionVersion = await client.productionAssetVersion.create({
      data: {
        projectId: storyboard.projectId,
        productionAssetId: productionAsset.id,
        versionNumber: 1,
        status: "ACTIVE",
        displayName: "批准的主场景",
        sourceType: "OWNER",
        publishedAt: new Date(),
      },
    });
    await client.productionAsset.update({
      where: { id: productionAsset.id },
      data: { currentVersionId: productionVersion.id },
    });
    const versionFile = await client.assetVersionFile.create({
      data: {
        projectId: storyboard.projectId,
        productionAssetVersionId: productionVersion.id,
        projectAssetId: projectAsset.id,
        referenceUsage: "SCENE_STYLE",
        approvalStatus: "ACCEPTED",
        isPreferred: true,
        status: "ACTIVE",
      },
    });

    const view = await continuity.getForStoryboard(storyboardId);
    const head = view.profile!.headVersion!;
    const boundaryIndex = new Map(
      head.boundaries.map((boundary) => [boundary.id, boundary.boundaryIndex]),
    );
    const withReference = await continuity.save(view.profile!.id, {
      parentVersionId: head.id,
      expectedRowVersion: view.profile!.rowVersion,
      idempotencyKey: randomUUID(),
      subjects: [
        ...head.subjects.map((subject) => ({
          subjectKey: subject.subjectKey,
          kind: subject.kind,
          label: subject.label,
          productionAssetVersionId: subject.productionAssetVersionId,
          assetVersionFileId: subject.assetVersionFileId,
          sourceSha256: subject.sourceSha256,
          facts: subject.factsJson as Record<string, unknown>,
          rules: subject.rules.map((rule) => ({
            propertyKey: rule.propertyKey,
            policy: rule.policy,
            importance: rule.importance,
            expectedValue: rule.expectedValueJson,
            ...(rule.explanation ? { explanation: rule.explanation } : {}),
          })),
        })),
        {
          subjectKey: "environment:approved-room",
          kind: "ENVIRONMENT",
          label: "批准的主场景",
          productionAssetVersionId: productionVersion.id,
          assetVersionFileId: versionFile.id,
          sourceSha256: preserved.sha256,
          facts: { layout: "approved" },
          rules: [
            {
              propertyKey: "canonical_state",
              policy: "WHOLE_FILM_HOLD",
              importance: "HARD",
              expectedValue: preserved.sha256,
              explanation: "全片保持同一个主场景",
            },
          ],
        },
      ],
      boundaries: head.boundaries.map((boundary) => ({
        boundaryIndex: boundary.boundaryIndex,
        label: boundary.label,
        state: {
          ...(boundary.stateJson as Record<string, unknown>),
          "environment:approved-room": preserved.sha256,
        },
      })),
      shots: head.shotStates.map((shot) => ({
        storyboardShotId: shot.storyboardShotId,
        ordinal: shot.ordinal,
        startBoundaryIndex: boundaryIndex.get(shot.startBoundaryId)!,
        endBoundaryIndex: boundaryIndex.get(shot.endBoundaryId)!,
        declaredChanges: shot.declaredChangesJson as Record<string, unknown>,
      })),
    });
    const preflight = await continuity.preflight(withReference.id);
    expect(preflight.ready).toBe(true);
    await continuity.decide(withReference.id, {
      decision: "APPROVED",
      preflightHash: preflight.preflightHash,
      idempotencyKey: randomUUID(),
    });

    const preview = await keyframes.preview(withReference.id, {
      providerProfileId: "fake-keyframe-v1",
    });
    expect(preview).toMatchObject({ ready: true, maximumCalls: 4, externalCalls: 0 });
    const plan = await keyframes.create(withReference.id, {
      providerProfileId: "fake-keyframe-v1",
      planHash: preview.planHash,
    });
    await keyframes.authorize(plan.id, {
      planHash: preview.planHash,
      confirmed: true,
      maximumCalls: 4,
      expiresInSeconds: 300,
      idempotencyKey: randomUUID(),
    });
    const executed = await keyframes.execute(plan.id);
    expect(executed.status).toBe("AWAITING_REVIEW");
    expect(executed.targets).toHaveLength(4);
    expect(await client.keyframeAttempt.count({ where: { providerCallCount: 0 } })).toBe(4);
    for (const target of executed.targets) {
      const artifact = target.artifact!;
      expect(artifact).toMatchObject({ width: 768, height: 1344 });
      await keyframes.decideArtifact(artifact.id, {
        decision: "APPROVED",
        idempotencyKey: randomUUID(),
      });
    }
    expect((await keyframes.get(plan.id)).status).toBe("APPROVED");
    await expect(
      client.$executeRawUnsafe(
        `UPDATE "ShotBoundary" SET "label" = 'mutated' WHERE "id" = '${withReference.boundaries[0]!.id}'`,
      ),
    ).rejects.toThrow(/append-only/);
    const attempt = await client.keyframeAttempt.findFirstOrThrow();
    await expect(
      client.$executeRawUnsafe(
        `UPDATE "KeyframeAttempt" SET "requestHash" = '${"f".repeat(64)}' WHERE "id" = '${attempt.id}'`,
      ),
    ).rejects.toThrow(/identity is immutable/);
  });
});
