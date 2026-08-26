import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectPrisma } from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";
const hash = (value: string) => value.repeat(64);

describe.runIf(enabled)("first real TRIAL scope PostgreSQL", () => {
  let client: ProjectPrisma;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test"))
      throw new Error("TRIAL scope tests require an isolated *_test database");
    client = (await import("@comfyuiflow/project-core")).prisma;
    await client.$executeRawUnsafe(
      'TRUNCATE TABLE "TrialScopeRevocation", "TrialScopeApprovalItem", "TrialScopeApproval", "GenerationBatchTargetV3Record", "GenerationBatchV3Record", "GenerationAuthorizationV3Record", "GenerationPlanV3Record", "GenerationSpecV3Record", "PlanningInputSnapshotV3Record", "ShotRequirementSpecV3Record", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardVersion", "Storyboard", "AssetVersionFile", "ProductionAssetVersion", "ProductionAsset", "Asset", "StoredObject", "Project" CASCADE',
    );
  });

  afterAll(async () => client.$disconnect());

  it("isolates partial scope, preserves idempotency/history, and fails closed on expiry, revocation, version and composition drift", async () => {
    const {
      CapabilityRegistryLoader,
      CapabilityWorkflowPlanningApplicationService,
      TrialScopeApprovalService,
    } = await import("@comfyuiflow/project-core");
    const project = await client.project.create({
      data: {
        name: "TRIAL scope isolation",
        targetAspectRatio: "PORTRAIT_9_16",
      },
    });
    const storyboard = await client.storyboard.create({
      data: {
        projectId: project.id,
        title: "Three TRIAL Shots",
        creativeBrief: "Three text-only shots for partial first-real-trial approval.",
      },
    });
    const version = await client.storyboardVersion.create({
      data: {
        projectId: project.id,
        storyboardId: storyboard.id,
        versionNumber: 1,
        source: "OWNER",
        creativeBrief: storyboard.creativeBrief,
        contractVersion: "storyboard-version-v1",
        contentHash: hash("a"),
      },
    });
    await client.storyboard.update({
      where: { id: storyboard.id },
      data: { headVersionId: version.id },
    });
    const shots = await Promise.all(
      [1, 2, 3].map((ordinal) =>
        client.storyboardShot.create({
          data: {
            projectId: project.id,
            storyboardVersionId: version.id,
            shotKey: randomUUID(),
            ordinal,
            title: `Text Shot ${ordinal}`,
            creativeDescription: `Text-only trial Shot ${ordinal}`,
            startState: "A quiet abstract space.",
            action: "Light moves through the scene.",
            endState: "The light settles.",
            camera: "Slow dolly forward.",
            composition: "Centered abstract composition.",
            continuityRequirements: [],
            durationSeconds: 5,
          },
        }),
      ),
    );
    const registryLoader = new CapabilityRegistryLoader();
    const planning = new CapabilityWorkflowPlanningApplicationService(client, registryLoader);
    const planningRequest = {
      schemaVersion: "workflow-planning-request-v3" as const,
      projectId: project.id,
      shotIds: shots.map((shot) => shot.id),
      storyboardRevisionRefs: [{ id: version.id, version: version.contentHash }],
      optionalOwnerConstraints: [],
    };
    const initial = await planning.previewAndPersistStoryboard(version.id, planningRequest);
    expect(initial.counts).toEqual({ ready: 0, trial: 0, blocked: 3 });
    expect(initial.shots.every((shot) => shot.blockerCodes.includes("TRIAL_SCOPE_REQUIRED"))).toBe(
      true,
    );
    expect(
      new Set(
        initial.shots.map(
          (shot) => `${shot.implementationRef.id}@${shot.implementationRef.version}`,
        ),
      ),
    ).toEqual(new Set(["implementation.hailuo03-text-partner@1.0.0"]));

    const service = new TrialScopeApprovalService(client, registryLoader);
    const selectedShotIds = [shots[0]!.id, shots[2]!.id];
    const idempotencyKey = `trial-${randomUUID()}`;
    const approvalRequest = {
      schemaVersion: "trial-scope-approval-create-request-v3" as const,
      generationPlanId: initial.planId,
      selectedShotIds,
      expiresInSeconds: 1_800,
      confirmed: true as const,
    };
    const created = await service.create(version.id, approvalRequest, idempotencyKey);
    expect(created).toMatchObject({
      status: "ACTIVE",
      externalCalls: 0,
      generationAuthorized: false,
      executionAuthorized: false,
    });
    expect(created.items.map((item) => item.shotId)).toEqual([...selectedShotIds].sort());
    const countsBeforeReplay = await Promise.all([
      client.trialScopeApproval.count(),
      client.trialScopeApprovalItem.count(),
      client.trialScopeRevocation.count(),
    ]);
    for (let index = 0; index < 10; index += 1)
      await expect(
        service.create(version.id, approvalRequest, idempotencyKey),
      ).resolves.toMatchObject({
        id: created.id,
      });
    await expect(
      Promise.all([
        client.trialScopeApproval.count(),
        client.trialScopeApprovalItem.count(),
        client.trialScopeRevocation.count(),
      ]),
    ).resolves.toEqual(countsBeforeReplay);
    await expect(
      service.create(
        version.id,
        { ...approvalRequest, selectedShotIds: [shots[1]!.id] },
        idempotencyKey,
      ),
    ).rejects.toMatchObject({ code: "TRIAL_SCOPE_IDEMPOTENCY_CONFLICT" });

    const partiallyAllowed = await planning.previewAndPersistStoryboard(
      version.id,
      planningRequest,
    );
    expect(partiallyAllowed.counts).toEqual({ ready: 0, trial: 2, blocked: 1 });
    expect(
      partiallyAllowed.shots.map((shot) => [shot.ordinal, shot.planningOutcome, shot.blockerCodes]),
    ).toEqual([
      [1, "TRIAL", []],
      [2, "BLOCKED", ["TRIAL_SCOPE_REQUIRED"]],
      [3, "TRIAL", []],
    ]);

    const revokeKey = `revoke-${randomUUID()}`;
    const revokeRequest = {
      schemaVersion: "trial-scope-revocation-request-v3" as const,
      reasonCode: "OWNER_REVOKED" as const,
      confirmed: true as const,
    };
    const revoked = await service.revoke(created.id, revokeRequest, revokeKey);
    expect(revoked.status).toBe("REVOKED");
    await expect(service.revoke(created.id, revokeRequest, revokeKey)).resolves.toMatchObject({
      id: created.id,
      status: "REVOKED",
    });
    await expect(client.trialScopeRevocation.count()).resolves.toBe(1);
    const blockedAgain = await planning.previewAndPersistStoryboard(version.id, planningRequest);
    expect(blockedAgain.counts).toEqual({ ready: 0, trial: 0, blocked: 3 });

    const expired = await service.create(
      version.id,
      approvalRequest,
      `expired-${randomUUID()}`,
      new Date(Date.now() - 3_600_000),
    );
    expect(expired.status).toBe("ACTIVE");
    expect(
      (await service.list(version.id)).approvals.find((item) => item.id === expired.id)?.status,
    ).toBe("EXPIRED");
    const reapproved = await service.create(
      version.id,
      approvalRequest,
      `reapprove-${randomUUID()}`,
    );
    expect(reapproved.status).toBe("ACTIVE");
    const history = await service.list(version.id);
    expect(history.approvals.map((item) => item.status)).toEqual(
      expect.arrayContaining(["ACTIVE", "EXPIRED", "REVOKED"]),
    );
    expect(history).toMatchObject({
      externalCalls: 0,
      generationAuthorized: false,
      executionAuthorized: false,
    });

    const registry = await registryLoader.load();
    const exactRef = "implementation.hailuo03-text-partner@1.0.0";
    const implementation = registry.implementationsByRef.get(exactRef)!;
    const drifted = {
      ...registry,
      implementationsByRef: new Map(registry.implementationsByRef).set(exactRef, {
        ...implementation,
        costPolicy: { kind: "LOCAL_COMPUTE" as const, resourceClass: "changed-local-gpu" },
      }),
    };
    const driftedItems = await service.activeItemsByShot(version.id, drifted);
    expect(driftedItems.get(shots[0]!.id)?.has(exactRef) ?? false).toBe(false);

    const version2 = await client.storyboardVersion.create({
      data: {
        projectId: project.id,
        storyboardId: storyboard.id,
        versionNumber: 2,
        parentVersionId: version.id,
        source: "OWNER",
        creativeBrief: storyboard.creativeBrief,
        contractVersion: "storyboard-version-v1",
        contentHash: hash("b"),
      },
    });
    await client.storyboard.update({
      where: { id: storyboard.id },
      data: { headVersionId: version2.id },
    });
    expect((await service.activeItemsByShot(version2.id, registry)).size).toBe(0);

    await expect(
      client.trialScopeApproval.update({
        where: { id: created.id },
        data: { scopeDigest: hash("f") },
      }),
    ).rejects.toThrow(/append-only/);
    await expect(
      client.trialScopeRevocation.delete({ where: { approvalId: created.id } }),
    ).rejects.toThrow(/append-only/);
  });
});
