import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectPrisma } from "@comfyuiflow/project-core";

const enabled = process.env.RUN_PROJECT_DB_TESTS === "1";

describe.runIf(enabled)("Workflow Agent PostgreSQL foundation", () => {
  let client: ProjectPrisma;

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    if (!databaseUrl.pathname.endsWith("_test")) {
      throw new Error("Workflow Agent PostgreSQL tests require an isolated *_test database");
    }
    client = (await import("@comfyuiflow/project-core")).prisma;
    await client.$executeRawUnsafe(
      'TRUNCATE TABLE "GenerationImplementationEvidence", "ShotExecutionPlan", "Project", "GenerationImplementation" CASCADE',
    );
  });

  afterAll(async () => client.$disconnect());

  it("installs additive plan/evidence tables and preserves V1 nullable compatibility", async () => {
    const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
         ('GenerationImplementation', 'GenerationImplementationEvidence', 'ShotExecutionPlan')
       ORDER BY table_name`,
    );
    expect(tables.map((row) => row.name)).toEqual([
      "GenerationImplementation",
      "GenerationImplementationEvidence",
      "ShotExecutionPlan",
    ]);
    const legacyColumns = await client.$queryRawUnsafe<Array<{ name: string; nullable: string }>>(
      `SELECT column_name AS name, is_nullable AS nullable
       FROM information_schema.columns
       WHERE table_name = 'GenerationSpec'
         AND column_name IN ('positivePrompt', 'capabilityRequirements')
       ORDER BY column_name`,
    );
    expect(legacyColumns).toEqual([
      { name: "capabilityRequirements", nullable: "YES" },
      { name: "positivePrompt", nullable: "YES" },
    ]);
    const blockedPlanColumns = await client.$queryRawUnsafe<
      Array<{ name: string; nullable: string }>
    >(
      `SELECT column_name AS name, is_nullable AS nullable
       FROM information_schema.columns
       WHERE table_name = 'ShotExecutionPlan'
         AND column_name IN ('implementationId', 'executorType', 'adapterId', 'adapterVersion')
       ORDER BY column_name`,
    );
    expect(blockedPlanColumns).toEqual([
      { name: "adapterId", nullable: "YES" },
      { name: "adapterVersion", nullable: "YES" },
      { name: "executorType", nullable: "YES" },
      { name: "implementationId", nullable: "YES" },
    ]);
  });

  it("allows lifecycle updates but rejects Implementation identity mutation", async () => {
    const implementation = await client.generationImplementation.create({
      data: {
        id: randomUUID(),
        implementationKey: `test-${randomUUID()}`,
        version: "1.0.0",
        providerProfileId: "test-provider",
        modelProfileId: "test-model",
        executorType: "COMFYUI_GRAPH",
        adapterId: "test-adapter",
        adapterVersion: "1.0.0",
        registrySha256: "1".repeat(64),
        capabilitySnapshotHash: "2".repeat(64),
        constraintsSnapshotHash: "3".repeat(64),
        patternSnapshotHash: "4".repeat(64),
        runtimeSnapshotHash: "5".repeat(64),
        compilerSnapshotHash: "6".repeat(64),
        status: "DISCOVERED",
      },
    });
    await expect(
      client.generationImplementation.update({
        where: { id: implementation.id },
        data: { status: "TRIAL", statusReasonCode: "STATIC_READY" },
      }),
    ).resolves.toMatchObject({ status: "TRIAL" });
    await expect(
      client.generationImplementation.update({
        where: { id: implementation.id },
        data: { adapterId: "mutated-adapter" },
      }),
    ).rejects.toThrow(/immutable/);
  });

  it("keeps Implementation evidence append-only", async () => {
    const implementation = await client.generationImplementation.create({
      data: {
        id: randomUUID(),
        implementationKey: `evidence-${randomUUID()}`,
        version: "1.0.0",
        providerProfileId: "test-provider",
        modelProfileId: "test-model",
        executorType: "COMFYUI_GRAPH",
        adapterId: "test-adapter",
        adapterVersion: "1.0.0",
        registrySha256: "1".repeat(64),
        capabilitySnapshotHash: "2".repeat(64),
        constraintsSnapshotHash: "3".repeat(64),
        patternSnapshotHash: "4".repeat(64),
        runtimeSnapshotHash: "5".repeat(64),
        compilerSnapshotHash: "6".repeat(64),
        status: "DISCOVERED",
      },
    });
    const evidence = await client.generationImplementationEvidence.create({
      data: {
        implementationId: implementation.id,
        sourceType: "STATIC_VALIDATION",
        sourceId: randomUUID(),
        runtimeSnapshotHash: "7".repeat(64),
        catalogSnapshotHash: "8".repeat(64),
        technicalResult: "TECHNICALLY_VALID",
        providerCallCount: 0,
      },
    });
    await expect(
      client.generationImplementationEvidence.update({
        where: { id: evidence.id },
        data: { technicalResult: "TECHNICAL_FAILED" },
      }),
    ).rejects.toThrow(/append-only/);
  });

  it("syncs Registry identity and evidence idempotently", async () => {
    const { ExecutionPlanService, GenerationRegistryLoader } =
      await import("@comfyuiflow/project-core");
    const registry = await new GenerationRegistryLoader().load();
    const service = new ExecutionPlanService(client);
    const first = await service.syncRegistry(registry);
    const second = await service.syncRegistry(registry);
    expect([...first].map(([key, value]) => [key, value?.id])).toEqual(
      [...second].map(([key, value]) => [key, value?.id]),
    );
    const implementation = first.values().next().value;
    expect(implementation).toBeTruthy();
    const sourceId = randomUUID();
    const evidenceInput = {
      implementationDatabaseId: implementation!.id,
      sourceType: "STATIC_VALIDATION" as const,
      sourceId,
      runtimeSnapshotHash: "9".repeat(64),
      catalogSnapshotHash: "a".repeat(64),
      technicalResult: "TECHNICALLY_VALID" as const,
      providerCallCount: 0,
    };
    const evidenceFirst = await service.appendEvidence(evidenceInput);
    const evidenceSecond = await service.appendEvidence(evidenceInput);
    expect(evidenceSecond.id).toBe(evidenceFirst.id);
  });

  it("atomically freezes one mixed-implementation Batch or writes nothing", async () => {
    const module = await import("@comfyuiflow/project-core");
    const storyboards = new module.StoryboardService(client, { phase2BindingsEnabled: true });
    const plans = new module.GenerationPlanService(client);
    const execution = new module.GenerationExecutionService(
      client,
      undefined,
      {},
      {
        allowTestFixtures: true,
      },
    );
    const project = await client.project.create({
      data: {
        name: "Workflow mixed batch",
        targetAspectRatio: "PORTRAIT_9_16",
        maximumGenerationCostMicros: 1_000n,
        generationCostCurrency: "USD",
      },
    });
    const storyboard = await storyboards.create(project.id, {
      title: "Mixed batch",
      creativeBrief: "Two deterministic Shots",
    });
    const generated = await storyboards.generate(storyboard.id, 0);
    const sourceVersion = await storyboards.getVersion(generated.headVersionId!);
    const source = sourceVersion.shots[0]!;
    const saved = await storyboards.save(storyboard.id, generated.rowVersion, {
      parentVersionId: generated.headVersionId,
      creativeBrief: generated.creativeBrief,
      shots: [1, 2].map((ordinal) => ({
        schemaVersion: "shot-draft-v1" as const,
        shotKey: randomUUID(),
        ordinal,
        title: `Shot ${ordinal}`,
        creativeDescription: source.creativeDescription,
        startState: source.startState,
        action: `${source.action} ${ordinal}`,
        endState: source.endState,
        camera: source.camera,
        composition: source.composition,
        continuityRequirements: source.continuityRequirements as string[],
        durationSeconds: 4,
        assetRequirements: [],
      })),
    });
    const assetPreview = await storyboards.previewAssets(saved.headVersionId!);
    await storyboards.resolveAssets(saved.headVersionId!, {
      candidateResultHash: assetPreview.resultHash,
      selections: [],
    });
    await storyboards.decide(saved.headVersionId!, saved.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
    const createdPlan = await plans.create(saved.headVersionId!, randomUUID());
    await plans.decide(createdPlan.headVersionId!, createdPlan.rowVersion, randomUUID(), {
      decision: "APPROVED",
    });
    const approved = await plans.get(createdPlan.id);
    const specs = approved.headVersion!.specs;
    const dependencyPolicyHash = "d".repeat(64);
    const pricingExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const executionPlans: Array<{ id: string; planTemplateSha256: string }> = [];
    const implementationRecords: Array<{
      id: string;
      implementationKey: string;
      version: string;
      executorType: "COMFYUI_GRAPH" | "DIRECT_PROVIDER_API";
      adapterId: string;
      adapterVersion: string;
    }> = [];
    for (const [index, spec] of specs.entries()) {
      const implementation = await client.generationImplementation.create({
        data: {
          id: randomUUID(),
          implementationKey: `mixed-${randomUUID()}`,
          version: "1.0.0",
          providerProfileId: `provider-${index}`,
          modelProfileId: `model-${index}`,
          executorType: index === 0 ? "COMFYUI_GRAPH" : "DIRECT_PROVIDER_API",
          adapterId: `adapter-${index}`,
          adapterVersion: "1.0.0",
          registrySha256: "1".repeat(64),
          capabilitySnapshotHash: "2".repeat(64),
          constraintsSnapshotHash: "3".repeat(64),
          patternSnapshotHash: "4".repeat(64),
          runtimeSnapshotHash: "5".repeat(64),
          compilerSnapshotHash: "6".repeat(64),
          status: index === 0 ? "TRIAL" : "READY",
        },
      });
      implementationRecords.push(implementation);
      const payload = {
        schemaVersion: "shot-execution-plan-draft-v1",
        dependencyPolicyHash,
        implementationId: implementation.implementationKey,
        implementationVersion: implementation.version,
        executorType: implementation.executorType,
        adapterId: implementation.adapterId,
        adapterVersion: implementation.adapterVersion,
        inputBindings:
          index === 0
            ? []
            : [
                {
                  type: "PREVIOUS_SHOT_FINAL_FRAME",
                  sourceShotKey: specs[0]!.shotKey,
                  sourceShotExecutionPlanSha256: executionPlans[0]!.planTemplateSha256,
                  extractorVersion: "dependency-final-frame-v1",
                  inputSlot: "first_frame",
                },
              ],
        pricing: {
          currency: "USD",
          estimatedCostMicros: 100,
          qaEstimatedCostMicros: 5,
          qaMaximumCostMicros: 10,
          expiresAt: pricingExpiresAt,
        },
      };
      executionPlans.push(
        await client.shotExecutionPlan.create({
          data: {
            id: randomUUID(),
            projectId: project.id,
            generationPlanVersionId: approved.headVersionId!,
            generationSpecId: spec.id,
            implementationId: implementation.id,
            executorType: implementation.executorType,
            adapterId: implementation.adapterId,
            adapterVersion: implementation.adapterVersion,
            planningInputHash: String(index + 1).repeat(64),
            requirementsHash: "7".repeat(64),
            capabilitySnapshotHash: "8".repeat(64),
            payloadJson: payload,
            planTemplateSha256: module.canonicalSha256(payload),
            estimatedCostMicros: 100,
            maximumCostMicros: 100,
            currency: "USD",
            estimatedGenerationCalls: 1,
            estimatedQaCalls: 1,
            planningOutcome: "READY",
          },
        }),
      );
    }
    const targets = executionPlans.map((plan) => ({
      shotExecutionPlanId: plan.id,
      planTemplateSha256: plan.planTemplateSha256,
      executionDisposition: "EXECUTE" as const,
    }));
    const costCore = {
      schemaVersion: "batch-cost-snapshot-v1" as const,
      currency: "USD",
      estimatedCostMicros: 210,
      maximumCostMicros: 220,
      generationCalls: 2,
      qaCalls: 2,
      pricingExpiresAt,
      retryPolicy: "NO_RETRY_NO_FALLBACK" as const,
    };
    const costSnapshot = { ...costCore, snapshotHash: module.canonicalSha256(costCore) };
    const policyCore = {
      schemaVersion: "qa-continuation-policy-v1" as const,
      mode: "AUTO_CONTINUE_AFTER_QA_PASS" as const,
      hardCriteria: [
        "IDENTITY" as const,
        "PRODUCT_STRUCTURE" as const,
        "VISUAL_DAMAGE" as const,
        "UNEXPECTED_OBJECTS" as const,
        "CROSS_FRAME_CONTINUITY" as const,
      ],
      hardFailConfidence: "HIGH" as const,
    };
    const continuationPolicy = { ...policyCore, policyHash: module.canonicalSha256(policyCore) };
    const confirmationCore = {
      engineVersion: "WORKFLOW_AGENT_V1" as const,
      generationPlanVersionId: approved.headVersionId!,
      dependencyPolicyHash,
      targets,
      costSnapshot,
      continuationPolicy,
    };
    const input = {
      ...confirmationCore,
      previewHash: module.canonicalSha256(confirmationCore),
      confirmed: true as const,
      expiresInSeconds: 300,
    };
    const before = await client.generationBatch.count({ where: { projectId: project.id } });
    await expect(
      execution.createBatch(
        {
          ...input,
          targets: [{ ...targets[0]!, planTemplateSha256: "f".repeat(64) }, targets[1]!],
        },
        randomUUID(),
        approved.rowVersion,
      ),
    ).rejects.toMatchObject({ code: "EXECUTION_PLAN_SHA_MISMATCH" });
    expect(await client.generationBatch.count({ where: { projectId: project.id } })).toBe(before);
    expect(
      await client.shotExecutionPlan.count({
        where: { id: { in: executionPlans.map((plan) => plan.id) }, lifecycleStatus: "DRAFT" },
      }),
    ).toBe(2);
    const idempotencyKey = randomUUID();
    const batch = await execution.createBatch(input, idempotencyKey, approved.rowVersion);
    expect(batch).toMatchObject({ engineVersion: "WORKFLOW_AGENT_V1", maximumCostMicros: 220 });
    expect(
      await client.generationBatchTarget.count({ where: { generationBatchId: batch.id } }),
    ).toBe(2);
    expect(await client.generationJob.count({ where: { generationBatchId: batch.id } })).toBe(2);
    expect(
      await client.shotExecutionPlan.count({
        where: { id: { in: executionPlans.map((plan) => plan.id) }, lifecycleStatus: "FROZEN" },
      }),
    ).toBe(2);
    const generatedRoot = await mkdtemp(join(tmpdir(), "workflow-agent-worker-"));
    let reusableArtifactId = "";
    let downstreamTargetId = "";
    try {
      const { FakeVideoQaProvider } = await import("@comfyuiflow/ai-providers");
      const provider = new module.FakeGenerationProvider();
      let submissions = 0;
      const adapter = (
        adapterId: string,
        executorType: "COMFYUI_GRAPH" | "DIRECT_PROVIDER_API",
      ) => ({
        adapterId,
        adapterVersion: "1.0.0",
        executorType,
        async getCapabilities() {
          return {};
        },
        async checkReadiness() {
          return { ready: true, blockers: [] };
        },
        async estimateCost() {
          return { currency: "USD", estimatedCostMicros: 100, maximumCostMicros: 100 };
        },
        async compileExecutionPlan(value: unknown) {
          return value as any;
        },
        async submit(value: any) {
          submissions += 1;
          return provider.submit({
            jobId: value.jobId,
            promptId: value.providerIdempotencyKey,
            workflowId: "fake-project-shot-4s-v1",
            compiledPrompt: "fixture",
            slots: [],
          });
        },
        getStatus() {
          return provider.status();
        },
        retainArtifacts(taskId: string) {
          return provider.retainArtifacts(taskId);
        },
        cancel() {
          return provider.cancel();
        },
      });
      const adapterRegistry = new module.GenerationAdapterRegistry([
        adapter("adapter-0", "COMFYUI_GRAPH"),
        adapter("adapter-1", "DIRECT_PROVIDER_API"),
      ] as any);
      const worker = new module.GenerationWorker(
        provider,
        new FakeVideoQaProvider(),
        client,
        new module.LocalContentStorage({
          root: join(generatedRoot, "source"),
          maxBytes: 20 * 1024 * 1024,
        }),
        new module.LocalContentStorage({
          root: join(generatedRoot, "generated"),
          maxBytes: 20 * 1024 * 1024,
        }),
        adapterRegistry,
      );
      await worker.runOnce("workflow-agent-test");
      expect(submissions).toBe(1);
      expect(
        await client.generationImplementation.findUniqueOrThrow({
          where: { id: implementationRecords[0]!.id },
        }),
      ).toMatchObject({ status: "READY", statusReasonCode: "REAL_TECHNICAL_EVIDENCE" });
      expect(
        await client.generationImplementationEvidence.findFirstOrThrow({
          where: { implementationId: implementationRecords[0]!.id },
        }),
      ).toMatchObject({
        sourceType: "REAL_GENERATION_JOB",
        technicalResult: "TECHNICALLY_VALID",
        providerCallCount: 1,
      });
      const upstreamQa = await client.aiQaResult.findFirstOrThrow({
        where: {
          aiQaRun: { generatedArtifact: { generationJob: { generationBatchId: batch.id } } },
        },
      });
      expect(upstreamQa).toMatchObject({
        continuationDecision: "CONTINUE",
        continuationPolicyVersion: "qa-continuation-policy-v1",
        continuationPolicyHash: continuationPolicy.policyHash,
      });
      expect(
        await client.authorizationConsumption.findFirstOrThrow({
          where: { generationJob: { generationBatchId: batch.id }, operation: "AI_QA_REVIEW" },
        }),
      ).toMatchObject({ reservedCostMicros: 10n });
      const orderedTargets = await client.generationBatchTarget.findMany({
        where: { generationBatchId: batch.id },
        orderBy: { ordinal: "asc" },
      });
      downstreamTargetId = orderedTargets[1]!.id;
      expect(orderedTargets[1]!.materializedExecutionSha256).toBeNull();
      const upstreamArtifact = await client.generatedArtifact.findFirstOrThrow({
        where: { generationJob: { generationBatchTargetId: orderedTargets[0]!.id } },
        include: { reviewFrames: true },
      });
      reusableArtifactId = upstreamArtifact.id;
      const exactFrame = upstreamArtifact.reviewFrames.find(
        (frame) => frame.extractorVersion === "dependency-final-frame-v1",
      );
      expect(exactFrame).toMatchObject({ role: "FINAL" });
      expect(exactFrame?.frameIndex).not.toBeNull();
      await worker.runOnce("workflow-agent-test");
      expect(submissions).toBe(2);
      const materialized = await client.generationBatchTarget.findUniqueOrThrow({
        where: { id: orderedTargets[1]!.id },
      });
      expect(materialized.materializedExecutionSha256).toHaveLength(64);
      expect((materialized.executionInputSnapshotJson as any).bindings[0]).toMatchObject({
        sourceArtifactSha256: upstreamArtifact.sha256,
        frameSha256: exactFrame!.sha256,
        extractorVersion: "dependency-final-frame-v1",
      });
      const review = await execution.getBatch(batch.id);
      expect(review.finalOwnerReview).toMatchObject({
        schemaVersion: "final-owner-review-v1",
        ready: true,
        ownerDecisionRequired: true,
      });
      expect(review.finalOwnerReview.items).toHaveLength(2);
      expect(review.finalOwnerReview.items.every((item: any) => item.ownerDecisionRequired)).toBe(
        true,
      );
      expect(await client.humanQaDecision.count({ where: { projectId: project.id } })).toBe(0);
    } finally {
      await rm(generatedRoot, { recursive: true, force: true });
    }
    const sourcePlan = await client.shotExecutionPlan.findUniqueOrThrow({
      where: { id: executionPlans[0]!.id },
    });
    const reusePlan = await client.shotExecutionPlan.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        generationPlanVersionId: approved.headVersionId!,
        generationSpecId: specs[0]!.id,
        implementationId: sourcePlan.implementationId,
        executorType: sourcePlan.executorType,
        adapterId: sourcePlan.adapterId,
        adapterVersion: sourcePlan.adapterVersion,
        planningInputHash: module.canonicalSha256({ reuse: true, nonce: randomUUID() }),
        requirementsHash: sourcePlan.requirementsHash,
        capabilitySnapshotHash: sourcePlan.capabilitySnapshotHash,
        payloadJson: sourcePlan.payloadJson as any,
        planTemplateSha256: sourcePlan.planTemplateSha256,
        estimatedCostMicros: sourcePlan.estimatedCostMicros,
        maximumCostMicros: sourcePlan.maximumCostMicros,
        currency: sourcePlan.currency,
        estimatedGenerationCalls: 1,
        estimatedQaCalls: 1,
        planningOutcome: "READY",
      },
    });
    const reuseTarget = {
      shotExecutionPlanId: reusePlan.id,
      planTemplateSha256: reusePlan.planTemplateSha256,
      executionDisposition: "REUSE_ARTIFACT" as const,
      sourceArtifactId: reusableArtifactId,
    };
    const reuseCostCore = {
      ...costCore,
      estimatedCostMicros: 0,
      maximumCostMicros: 0,
      generationCalls: 0,
      qaCalls: 0,
    };
    const reuseCostSnapshot = {
      ...reuseCostCore,
      snapshotHash: module.canonicalSha256(reuseCostCore),
    };
    const reuseCore = {
      engineVersion: "WORKFLOW_AGENT_V1" as const,
      generationPlanVersionId: approved.headVersionId!,
      dependencyPolicyHash,
      targets: [reuseTarget],
      costSnapshot: reuseCostSnapshot,
      continuationPolicy,
    };
    const reuseBatch = await execution.createBatch(
      {
        ...reuseCore,
        previewHash: module.canonicalSha256(reuseCore),
        confirmed: true,
        expiresInSeconds: 300,
      },
      randomUUID(),
      approved.rowVersion,
    );
    expect(await client.generationJob.count({ where: { generationBatchId: reuseBatch.id } })).toBe(
      0,
    );
    expect(
      await client.generationBatchTarget.findFirstOrThrow({
        where: { generationBatchId: reuseBatch.id },
      }),
    ).toMatchObject({
      executionDisposition: "REUSE_ARTIFACT",
      sourceArtifactId: reusableArtifactId,
    });
    const failurePlans: Array<{ id: string; planTemplateSha256: string }> = [];
    for (const [index, spec] of specs.entries()) {
      const implementation = implementationRecords[index]!;
      const payload = {
        schemaVersion: "shot-execution-plan-draft-v1",
        dependencyPolicyHash,
        implementationId: implementation.implementationKey,
        implementationVersion: implementation.version,
        executorType: implementation.executorType,
        adapterId: implementation.adapterId,
        adapterVersion: implementation.adapterVersion,
        inputBindings:
          index === 0
            ? []
            : [
                {
                  type: "PREVIOUS_SHOT_FINAL_FRAME",
                  sourceShotKey: specs[0]!.shotKey,
                  sourceShotExecutionPlanSha256: failurePlans[0]!.planTemplateSha256,
                  extractorVersion: "dependency-final-frame-v1",
                  inputSlot: "first_frame",
                },
              ],
        pricing: {
          currency: "USD",
          estimatedCostMicros: 100,
          qaEstimatedCostMicros: 5,
          qaMaximumCostMicros: 10,
          expiresAt: pricingExpiresAt,
        },
      };
      failurePlans.push(
        await client.shotExecutionPlan.create({
          data: {
            id: randomUUID(),
            projectId: project.id,
            generationPlanVersionId: approved.headVersionId!,
            generationSpecId: spec.id,
            implementationId: implementation.id,
            executorType: implementation.executorType,
            adapterId: implementation.adapterId,
            adapterVersion: implementation.adapterVersion,
            planningInputHash: module.canonicalSha256({
              failure: true,
              index,
              nonce: randomUUID(),
            }),
            requirementsHash: "7".repeat(64),
            capabilitySnapshotHash: "8".repeat(64),
            payloadJson: payload,
            planTemplateSha256: module.canonicalSha256(payload),
            estimatedCostMicros: 100,
            maximumCostMicros: 100,
            currency: "USD",
            estimatedGenerationCalls: 1,
            estimatedQaCalls: 1,
            planningOutcome: "READY",
          },
        }),
      );
    }
    const failureTargets = failurePlans.map((plan) => ({
      shotExecutionPlanId: plan.id,
      planTemplateSha256: plan.planTemplateSha256,
      executionDisposition: "EXECUTE" as const,
    }));
    const failureCore = { ...confirmationCore, targets: failureTargets };
    const failureBatch = await execution.createBatch(
      {
        ...failureCore,
        previewHash: module.canonicalSha256(failureCore),
        confirmed: true,
        expiresInSeconds: 300,
      },
      randomUUID(),
      approved.rowVersion,
    );
    let failureSubmissions = 0;
    const rejectingAdapter = (adapterId: string, reject: boolean) => ({
      adapterId,
      adapterVersion: "1.0.0",
      executorType:
        adapterId === "adapter-0" ? ("COMFYUI_GRAPH" as const) : ("DIRECT_PROVIDER_API" as const),
      async getCapabilities() {
        return {};
      },
      async checkReadiness() {
        return { ready: true, blockers: [] };
      },
      async estimateCost() {
        return { currency: "USD", estimatedCostMicros: 100, maximumCostMicros: 100 };
      },
      async compileExecutionPlan(value: unknown) {
        return value as any;
      },
      async submit() {
        failureSubmissions += 1;
        if (reject)
          throw new module.GenerationAdapterError("PROVIDER_REJECTED", "fixture rejection");
        return { taskId: randomUUID() };
      },
      async getStatus() {
        return "COMPLETED" as const;
      },
      async retainArtifacts() {
        return [];
      },
      async cancel() {
        return { cancelled: true, remoteTerminationConfirmed: true };
      },
    });
    const failureWorker = new module.GenerationWorker(
      new module.FakeGenerationProvider(),
      new (await import("@comfyuiflow/ai-providers")).FakeVideoQaProvider(),
      client,
      undefined,
      undefined,
      new module.GenerationAdapterRegistry([
        rejectingAdapter("adapter-0", true),
        rejectingAdapter("adapter-1", false),
      ]),
    );
    await failureWorker.runOnce("workflow-agent-failure-test");
    expect(failureSubmissions).toBe(1);
    expect(
      await client.generationBatch.findUniqueOrThrow({ where: { id: failureBatch.id } }),
    ).toMatchObject({ status: "PAUSED" });
    expect(await failureWorker.runOnce("workflow-agent-failure-test")).toBeNull();
    expect(
      await client.generationImplementation.findUniqueOrThrow({
        where: { id: implementationRecords[0]!.id },
      }),
    ).toMatchObject({ status: "BLOCKED", statusReasonCode: "TECHNICAL_FAILED" });
    expect(
      await client.generationImplementationEvidence.count({
        where: { implementationId: implementationRecords[0]!.id },
      }),
    ).toBe(2);
    const downstreamFailureJob = await client.generationJob.findFirstOrThrow({
      where: { generationBatchId: failureBatch.id, generationBatchTarget: { ordinal: 2 } },
    });
    expect(downstreamFailureJob).toMatchObject({ status: "QUEUED", providerCallCount: 0 });
    await client.generatedArtifact.update({
      where: { id: reusableArtifactId },
      data: { sha256: "e".repeat(64) },
    });
    await expect(
      new module.ExecutionPlanService(client).materializeTargetInputs(downstreamTargetId),
    ).rejects.toThrow("MATERIALIZED_INPUT_SHA_MISMATCH");
    expect(
      await client.shotExecutionPlan.findUniqueOrThrow({ where: { id: executionPlans[1]!.id } }),
    ).toMatchObject({
      lifecycleStatus: "INVALIDATED",
      invalidationCode: "MATERIALIZED_INPUT_SHA_MISMATCH",
    });
    expect(
      await client.shotExecutionPlan.findUniqueOrThrow({ where: { id: executionPlans[0]!.id } }),
    ).toMatchObject({ lifecycleStatus: "FROZEN" });
    const repeated = await execution.createBatch(input, idempotencyKey, approved.rowVersion);
    expect(repeated.id).toBe(batch.id);
  });
});
