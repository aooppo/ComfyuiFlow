import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectPrisma } from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";
const hash = (value: string) => value.repeat(64);

describe.runIf(enabled)("Capability workflow PostgreSQL foundation", () => {
  let client: ProjectPrisma;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test")) {
      throw new Error("Capability workflow tests require an isolated *_test database");
    }
    client = (await import("@comfyuiflow/project-core")).prisma;
    await client.$executeRawUnsafe(
      'TRUNCATE TABLE "TrialScopeRevocation", "TrialScopeApprovalItem", "TrialScopeApproval", "GenerationBatchTargetV3Record", "GenerationBatchV3Record", "CapabilityImplementationEvidence", "CapabilityRegistryPublication", "CapabilityDiscoveryCandidate", "GenerationAuthorizationV3Record", "GenerationPlanV3Record", "GenerationSpecV3Record", "PlanningInputSnapshotV3Record", "ShotRequirementSpecV3Record", "CapabilityGenerationImplementation", "CapabilityCompilerProfile", "CapabilityAdapterProfile", "CapabilityModelProfile", "CapabilityProviderProfile", "CapabilityRuntimeProfile", "ShotAssetBinding", "AssetResolutionManifest", "ShotAssetRequirement", "StoryboardShot", "StoryboardVersion", "Storyboard", "AssetVersionFile", "ProductionAssetVersion", "ProductionAsset", "Asset", "StoredObject", "Project" CASCADE',
    );
  });

  afterAll(async () => client.$disconnect());

  it("installs every additive registry and V3 lineage table without removing legacy GenerationSpec", async () => {
    const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
         ('CapabilityRuntimeProfile', 'CapabilityProviderProfile', 'CapabilityModelProfile',
          'CapabilityAdapterProfile', 'CapabilityCompilerProfile',
          'CapabilityGenerationImplementation', 'CapabilityDiscoveryCandidate',
          'CapabilityRegistryPublication', 'CapabilityImplementationEvidence',
          'ShotRequirementSpecV3Record', 'PlanningInputSnapshotV3Record',
          'GenerationSpecV3Record', 'GenerationPlanV3Record', 'GenerationAuthorizationV3Record',
          'GenerationBatchV3Record', 'GenerationBatchTargetV3Record', 'TrialScopeApproval',
          'TrialScopeApprovalItem', 'TrialScopeRevocation')
       ORDER BY table_name`,
    );
    expect(tables).toHaveLength(19);
    await expect(
      client.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "GenerationSpec"`),
    ).resolves.toEqual([expect.objectContaining({ count: expect.any(Number) })]);
  });

  it("preserves exact composition identity while allowing only implementation lifecycle changes", async () => {
    const runtime = await client.capabilityRuntimeProfile.create({
      data: {
        id: randomUUID(),
        profileKey: `runtime.${randomUUID()}`,
        version: "1.0.0",
        kind: "COMFYUI_MCP",
        payloadJson: { connectionRef: "runtime.local", enabled: true },
        payloadHash: hash("1"),
      },
    });
    const provider = await client.capabilityProviderProfile.create({
      data: {
        id: randomUUID(),
        profileKey: `provider.${randomUUID()}`,
        version: "1.0.0",
        kind: "LOCAL_COMPUTE",
        payloadJson: { authorityRef: "local-owner", enabled: true },
        payloadHash: hash("2"),
      },
    });
    const model = await client.capabilityModelProfile.create({
      data: {
        id: randomUUID(),
        profileKey: `model.${randomUUID()}`,
        version: "1.0.0",
        providerKey: provider.profileKey,
        providerVersion: provider.version,
        payloadJson: { family: "local-video", capabilityCodes: ["TEXT_TO_VIDEO"] },
        payloadHash: hash("3"),
      },
    });
    const adapter = await client.capabilityAdapterProfile.create({
      data: {
        id: randomUUID(),
        profileKey: `adapter.${randomUUID()}`,
        version: "1.0.0",
        factoryKey: "comfyui-mcp-v2",
        payloadJson: { protocol: "comfyui-mcp-v2" },
        payloadHash: hash("4"),
      },
    });
    const compiler = await client.capabilityCompilerProfile.create({
      data: {
        id: randomUUID(),
        profileKey: `compiler.${randomUUID()}`,
        version: "1.0.0",
        compilerKey: "text-video-v1",
        payloadJson: { inputContract: { text: true } },
        payloadHash: hash("5"),
      },
    });
    const implementation = await client.capabilityGenerationImplementation.create({
      data: {
        id: randomUUID(),
        implementationKey: `implementation.${randomUUID()}`,
        version: "1.0.0",
        runtimeKey: runtime.profileKey,
        runtimeVersion: runtime.version,
        providerKey: provider.profileKey,
        providerVersion: provider.version,
        modelKey: model.profileKey,
        modelVersion: model.version,
        adapterKey: adapter.profileKey,
        adapterVersion: adapter.version,
        compilerKey: compiler.profileKey,
        compilerVersion: compiler.version,
        capabilityJson: ["TEXT_TO_VIDEO"],
        costPolicyJson: { kind: "LOCAL_COMPUTE" },
        compositionHash: hash("6"),
        lifecycle: "TRIAL",
        testOnly: false,
      },
    });
    await expect(
      client.capabilityGenerationImplementation.update({
        where: { id: implementation.id },
        data: { lifecycle: "READY", lifecycleReasonCode: "EXACT_VERSION_EVIDENCE_ACCEPTED" },
      }),
    ).resolves.toMatchObject({ lifecycle: "READY" });
    await expect(
      client.capabilityGenerationImplementation.update({
        where: { id: implementation.id },
        data: { compilerVersion: "2.0.0" },
      }),
    ).rejects.toThrow(/immutable/);
    await expect(
      client.capabilityRuntimeProfile.update({
        where: { id: runtime.id },
        data: { payloadHash: hash("9") },
      }),
    ).rejects.toThrow(/append-only/);
  });

  it("keeps evidence and V3 Shot Planner handoff records append-only", async () => {
    const runtime = await client.capabilityRuntimeProfile.findFirstOrThrow();
    const implementation = await client.capabilityGenerationImplementation.findFirstOrThrow();
    const compiler = await client.capabilityCompilerProfile.findFirstOrThrow();
    const evidence = await client.capabilityImplementationEvidence.create({
      data: {
        id: randomUUID(),
        implementationKey: implementation.implementationKey,
        implementationVersion: implementation.version,
        compilerKey: compiler.profileKey,
        compilerVersion: compiler.version,
        kind: "CONTRACT",
        outcome: "PASS",
        evidenceJson: { runtimeRef: runtime.profileKey },
        evidenceHash: hash("7"),
        callCount: 0,
      },
    });
    await expect(
      client.capabilityImplementationEvidence.update({
        where: { id: evidence.id },
        data: { outcome: "FAIL" },
      }),
    ).rejects.toThrow(/append-only/);

    const requirement = await client.shotRequirementSpecV3Record.create({
      data: {
        id: randomUUID(),
        projectId: randomUUID(),
        storyboardVersionId: randomUUID(),
        storyboardShotId: randomUUID(),
        shotId: randomUUID(),
        version: "1",
        payloadJson: { character: "OMITTED" },
        requirementHash: hash("a"),
      },
    });
    await expect(
      client.shotRequirementSpecV3Record.update({
        where: { id: requirement.id },
        data: { payloadJson: { character: "REQUIRED" } },
      }),
    ).rejects.toThrow(/append-only/);
  });

  it("syncs exact Registry V2 composition idempotently", async () => {
    const { CapabilityRegistryLoader, RegistryPublicationService } =
      await import("@comfyuiflow/project-core");
    const registry = await new CapabilityRegistryLoader().load();
    const service = new RegistryPublicationService(client);
    const first = await service.syncRegistry(registry);
    const second = await service.syncRegistry(registry);
    expect(second).toEqual(first);
    await expect(client.capabilityRuntimeProfile.count()).resolves.toBeGreaterThanOrEqual(
      registry.document.runtimes.length,
    );
    await expect(client.capabilityGenerationImplementation.count()).resolves.toBeGreaterThanOrEqual(
      registry.document.implementations.length,
    );
  });

  it("keeps a bound READY Shot independent from a blocked Shot and supersedes snapshots", async () => {
    const { CapabilityRegistryLoader, CapabilityWorkflowPlanningApplicationService } =
      await import("@comfyuiflow/project-core");
    const project = await client.project.create({
      data: {
        name: "Capability planning isolation",
        targetAspectRatio: "PORTRAIT_9_16",
      },
    });
    const storyboard = await client.storyboard.create({
      data: {
        projectId: project.id,
        title: "Independent Shots",
        creativeBrief: "One resolvable product Shot and one unresolved product Shot.",
      },
    });
    const revisionHash = hash("b");
    const version = await client.storyboardVersion.create({
      data: {
        projectId: project.id,
        storyboardId: storyboard.id,
        versionNumber: 1,
        source: "OWNER",
        creativeBrief: storyboard.creativeBrief,
        contractVersion: "storyboard-version-v1",
        contentHash: revisionHash,
      },
    });
    await client.storyboard.update({
      where: { id: storyboard.id },
      data: { headVersionId: version.id },
    });
    const shots = await Promise.all(
      [1, 2].map((ordinal) =>
        client.storyboardShot.create({
          data: {
            projectId: project.id,
            storyboardVersionId: version.id,
            shotKey: randomUUID(),
            ordinal,
            title: `Shot ${ordinal}`,
            creativeDescription: `Product Shot ${ordinal}`,
            startState: "Product rests in a clean studio.",
            action: "Camera reveals the product.",
            endState: "Product remains clearly visible.",
            camera: "Slow dolly in.",
            composition: "Product centered.",
            continuityRequirements: [],
            durationSeconds: 5,
          },
        }),
      ),
    );
    const requirements = await Promise.all(
      shots.map((shot, index) =>
        client.shotAssetRequirement.create({
          data: {
            projectId: project.id,
            storyboardVersionId: version.id,
            storyboardShotId: shot.id,
            requirementKey: `shot-${index + 1}-product`,
            contractVersion: "asset-candidate-v1",
            inputJson: { assetType: "PROP", projectId: project.id },
            inputHash: hash(index === 0 ? "c" : "d"),
          },
        }),
      ),
    );
    const semanticAsset = await client.productionAsset.create({
      data: {
        projectId: project.id,
        type: "PROP",
        name: "Reviewed Product",
        normalizedName: "reviewed product",
      },
    });
    const semanticVersion = await client.productionAssetVersion.create({
      data: {
        projectId: project.id,
        productionAssetId: semanticAsset.id,
        versionNumber: 1,
        status: "ACTIVE",
        displayName: "Reviewed Product",
        publishedAt: new Date(),
      },
    });
    await client.productionAsset.update({
      where: { id: semanticAsset.id },
      data: { currentVersionId: semanticVersion.id },
    });
    const storedObject = await client.storedObject.create({
      data: {
        sha256: hash("e"),
        byteSize: 1,
        detectedMimeType: "image/png",
        storageKey: `tests/capability/${randomUUID()}`,
        verificationStatus: "VERIFIED",
      },
    });
    const projectAsset = await client.asset.create({
      data: {
        projectId: project.id,
        storedObjectId: storedObject.id,
        originalFilename: "ignored-name.png",
        displayName: "Reviewed Product Reference",
        mediaType: "IMAGE",
        role: "PROP",
        status: "READY",
      },
    });
    const assetVersionFile = await client.assetVersionFile.create({
      data: {
        projectId: project.id,
        productionAssetVersionId: semanticVersion.id,
        projectAssetId: projectAsset.id,
        referenceUsage: "PROP_DETAIL",
        approvalStatus: "ACCEPTED",
        status: "ACTIVE",
      },
    });
    const autoShot = await client.storyboardShot.create({
      data: {
        projectId: project.id,
        storyboardVersionId: version.id,
        shotKey: randomUUID(),
        ordinal: 3,
        title: "Automatically bound Shot",
        creativeDescription: "Use the exact reviewed product version without an approval gate.",
        startState: "The product is visible.",
        action: "The camera approaches the product.",
        endState: "The product remains stable.",
        camera: "Slow push in.",
        composition: "Product centered.",
        continuityRequirements: [],
        durationSeconds: 5,
      },
    });
    await client.shotAssetRequirement.create({
      data: {
        projectId: project.id,
        storyboardVersionId: version.id,
        storyboardShotId: autoShot.id,
        requirementKey: "shot-3-product",
        contractVersion: "asset-candidate-v1",
        inputJson: {
          contractVersion: "asset-candidate-v1",
          projectId: project.id,
          requirementId: "shot-3-product",
          assetType: "PROP",
          productionAssetId: semanticAsset.id,
          productionAssetVersionId: semanticVersion.id,
          referenceUsages: ["PROP_DETAIL"],
          viewpoints: [],
          shotScales: [],
          mediaCapability: { mediaType: "IMAGE", acceptedMimeTypes: [] },
          policy: {
            allowUnspecifiedViewpoint: false,
            allowUnspecifiedShotScale: false,
          },
        },
        inputHash: hash("2"),
      },
    });
    const manifest = await client.assetResolutionManifest.create({
      data: {
        projectId: project.id,
        storyboardVersionId: version.id,
        policyVersion: "test-v1",
        requirementsHash: hash("f"),
        candidateSnapshotJson: {},
        candidateResultHash: hash("0"),
        finalBindingsHash: hash("1"),
      },
    });
    await client.shotAssetBinding.create({
      data: {
        projectId: project.id,
        manifestId: manifest.id,
        requirementId: requirements[0]!.id,
        productionAssetVersionId: semanticVersion.id,
        assetVersionFileId: assetVersionFile.id,
        projectAssetId: projectAsset.id,
      },
    });

    const service = new CapabilityWorkflowPlanningApplicationService(
      client,
      new CapabilityRegistryLoader(),
    );
    const baseRequest = {
      schemaVersion: "workflow-planning-request-v3" as const,
      projectId: project.id,
      shotIds: shots.map((shot) => shot.id),
      storyboardRevisionRefs: [{ id: version.id, version: version.contentHash }],
      optionalOwnerConstraints: [],
    };
    const first = await service.previewAndPersistStoryboard(version.id, baseRequest);
    expect(first.counts).toEqual({ ready: 1, trial: 0, blocked: 1 });
    expect(first.shots.map((shot) => shot.planningOutcome)).toEqual(["READY", "BLOCKED"]);
    expect(first.shots).toHaveLength(2);
    expect(new Set(first.shots.map((shot) => shot.generationSpecRef.id)).size).toBe(2);
    await expect(
      client.generationSpecV3Record.count({ where: { projectId: project.id } }),
    ).resolves.toBe(2);

    const originalSnapshot = await client.planningInputSnapshotV3Record.findFirstOrThrow({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    });
    const originalPayload = originalSnapshot.payloadJson;
    await service.previewAndPersistStoryboard(version.id, {
      ...baseRequest,
      optionalOwnerConstraints: [{ shotId: shots[0]!.id, purpose: "STYLE" }],
    });
    await expect(
      client.planningInputSnapshotV3Record.count({ where: { projectId: project.id } }),
    ).resolves.toBe(3);
    await expect(
      client.planningInputSnapshotV3Record.findUniqueOrThrow({
        where: { id: originalSnapshot.id },
      }),
    ).resolves.toMatchObject({ payloadJson: originalPayload });

    const automaticallyBound = await service.previewAndPersistStoryboard(version.id, {
      ...baseRequest,
      shotIds: [autoShot.id],
    });
    expect(automaticallyBound.counts).toEqual({ ready: 1, trial: 0, blocked: 0 });
    expect(automaticallyBound.shots[0]).toMatchObject({
      planningOutcome: "READY",
      blockerCodes: [],
      bindings: [
        expect.objectContaining({
          purpose: "PRODUCT",
          sourceKind: "SEMANTIC_ASSET_VERSION",
          sourceRef: { id: semanticVersion.id, version: "1" },
          sha256: storedObject.sha256,
        }),
      ],
    });

    const { GenerationExecutionService } = await import("@comfyuiflow/project-core");
    const execution = new GenerationExecutionService(client, undefined, {
      PROJECT_GENERATION_LIVE_ENABLED: "true",
    });
    const executionPreview = await execution.previewV3(automaticallyBound.planId, {
      schemaVersion: "capability-generation-execution-preview-request-v3",
      shotIds: [autoShot.id],
    });
    expect(executionPreview).toMatchObject({
      ready: true,
      submissionBlockers: [],
      expectedCalls: 1,
      maximumCalls: 1,
      maximumAiQaCalls: 1,
      externalCalls: 0,
      generationAuthorized: false,
    });
    const idempotencyKey = randomUUID();
    const request = {
      engineVersion: "CAPABILITY_V3" as const,
      generationPlanId: automaticallyBound.planId,
      shotIds: [autoShot.id],
      planDigest: executionPreview.planDigest,
      previewHash: executionPreview.previewHash,
      costPolicyDigest: executionPreview.costPolicyDigest,
      maximumCalls: executionPreview.maximumCalls,
      maximumAiQaCalls: executionPreview.maximumAiQaCalls,
      maximumCostMicros: executionPreview.maximumCostMicros,
      confirmed: true as const,
      noRetry: true as const,
      noFallback: true as const,
      expiresInSeconds: 300,
    };
    const created = await execution.createBatch(request, idempotencyKey);
    expect(created).toMatchObject({
      schemaVersion: "capability-generation-batch-v3",
      generationPlanId: automaticallyBound.planId,
      expectedCalls: 1,
      maximumCalls: 1,
      authorization: { consumedCalls: 0, noRetry: true, noFallback: true },
      targets: [
        expect.objectContaining({
          shotId: autoShot.id,
          generationSpecId: automaticallyBound.shots[0]!.generationSpecRef.id,
          state: "QUEUED",
        }),
      ],
    });
    await expect(execution.createBatch(request, idempotencyKey)).resolves.toMatchObject({
      id: created.id,
    });
    const rowCounts = await Promise.all([
      client.generationAuthorizationV3Record.count(),
      client.generationBatchV3Record.count(),
      client.generationBatchTargetV3Record.count(),
    ]);
    await expect(
      execution.createBatch({ ...request, previewHash: hash("9") }, randomUUID()),
    ).rejects.toMatchObject({ code: "PREVIEW_STALE" });
    await expect(
      Promise.all([
        client.generationAuthorizationV3Record.count(),
        client.generationBatchV3Record.count(),
        client.generationBatchTargetV3Record.count(),
      ]),
    ).resolves.toEqual(rowCounts);
  });

  it("keeps discovery non-selectable and requires explicit exact-version evidence promotion", async () => {
    const {
      CapabilityDiscoveryService,
      ImplementationEvidenceService,
      RegistryPublicationService,
    } = await import("@comfyuiflow/project-core");
    const candidateId = `discovery.${randomUUID()}`;
    const implementationId = `implementation.${randomUUID()}`;
    const sourceDigest = hash("8");
    const candidate = {
      id: candidateId,
      version: "schema-1",
      runtimeRef: { id: "runtime.test", version: "1" },
      discoveredAt: "2026-08-26T00:00:00.000Z",
      sourceDigest,
      nodeIdentifier: "TestVideoNode",
      normalizedInputs: [{ name: "prompt", type: "STRING", required: true }],
      normalizedOutputs: [{ index: 0, type: "VIDEO" }],
      dynamicGroups: [],
      rawSchemaRef: `raw-schema.${sourceDigest}`,
      status: "DISCOVERED" as const,
    };
    const discovery = new CapabilityDiscoveryService(client);
    await discovery.persistCandidate(candidate);
    await discovery.persistCandidate(candidate);
    await expect(
      client.capabilityDiscoveryCandidate.count({ where: { candidateKey: candidateId } }),
    ).resolves.toBe(1);
    const implementationCount = await client.capabilityGenerationImplementation.count();

    await client.capabilityGenerationImplementation.create({
      data: {
        id: randomUUID(),
        implementationKey: implementationId,
        version: "1",
        runtimeKey: "runtime.test",
        runtimeVersion: "1",
        providerKey: "provider.test",
        providerVersion: "1",
        modelKey: "model.test",
        modelVersion: "1",
        adapterKey: "adapter.test",
        adapterVersion: "1",
        compilerKey: "compiler.test",
        compilerVersion: "1",
        capabilityJson: ["TEXT_TO_VIDEO"],
        costPolicyJson: { kind: "LOCAL_COMPUTE" },
        compositionHash: hash("9"),
        lifecycle: "DISCOVERED",
        evidencePolicy: "EXACT_VERSION_REAL_RESULT",
        testOnly: false,
      },
    });
    expect(await client.capabilityGenerationImplementation.count()).toBe(implementationCount + 1);
    const publication = {
      id: `publication.${randomUUID()}`,
      version: "1",
      candidateRef: { id: candidateId, version: "schema-1" },
      sourceDigest,
      providerRef: { id: "provider.test", version: "1" },
      modelRef: { id: "model.test", version: "1" },
      adapterRef: { id: "adapter.test", version: "1" },
      compilerRef: { id: "compiler.test", version: "1" },
      implementationRef: { id: implementationId, version: "1" },
      costPolicy: { kind: "LOCAL_COMPUTE" as const },
      reviewerRef: "operator.test",
      reviewedAt: "2026-08-26T00:01:00.000Z",
    };
    const publicationService = new RegistryPublicationService(client);
    await publicationService.persistPublication(publication);
    await expect(
      client.capabilityGenerationImplementation.findUniqueOrThrow({
        where: {
          implementationKey_version: { implementationKey: implementationId, version: "1" },
        },
      }),
    ).resolves.toMatchObject({ lifecycle: "TRIAL" });

    const evidenceService = new ImplementationEvidenceService(client);
    const append = (
      kind: "CONTRACT" | "RUNTIME_READINESS" | "AUTHORIZED_REAL_EXECUTION",
      outcome: "PASS" | "FAIL" = "PASS",
    ) =>
      evidenceService.append({
        id: `evidence.${randomUUID()}`,
        version: "1",
        implementationRef: { id: implementationId, version: "1" },
        compilerRef: { id: "compiler.test", version: "1" },
        kind,
        outcome,
        callCount: kind === "AUTHORIZED_REAL_EXECUTION" ? 1 : 0,
        costDigest: null,
        artifactRefs: [],
        reviewerRef: "operator.test",
        recordedAt: new Date().toISOString(),
      });
    await append("CONTRACT", "FAIL");
    await append("RUNTIME_READINESS");
    await expect(
      evidenceService.promoteReady({ id: implementationId, version: "1" }),
    ).rejects.toThrow("CONTRACT_EVIDENCE_REQUIRED");
    await append("CONTRACT");
    await append("AUTHORIZED_REAL_EXECUTION");
    await expect(
      evidenceService.promoteReady({ id: implementationId, version: "1" }),
    ).resolves.toMatchObject({
      lifecycle: "READY",
      lifecycleReasonCode: "EXACT_VERSION_EVIDENCE_ACCEPTED",
    });
    await expect(
      client.capabilityImplementationEvidence.count({
        where: { implementationKey: implementationId },
      }),
    ).resolves.toBe(4);
  });
});
