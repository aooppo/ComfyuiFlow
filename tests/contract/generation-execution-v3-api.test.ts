import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  GenerationExecutionPreviewV3Schema,
  type GenerationExecutionPreviewV3,
} from "@comfyuiflow/contracts";
import {
  createCapabilityGenerationBatchSchema,
  generationExecutionPreviewV3InputSchema,
} from "@comfyuiflow/project-core";

const uuid = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const sha = (value: string) => value.repeat(64).slice(0, 64);

describe("Generation execution V3 API", () => {
  it("accepts only an exact selected Shot subset and bounded one-confirmation scope", () => {
    expect(
      generationExecutionPreviewV3InputSchema.parse({
        schemaVersion: "capability-generation-execution-preview-request-v3",
        shotIds: [uuid(1), uuid(2)],
      }),
    ).toMatchObject({ shotIds: [uuid(1), uuid(2)] });
    expect(() =>
      generationExecutionPreviewV3InputSchema.parse({
        schemaVersion: "capability-generation-execution-preview-request-v3",
        shotIds: [uuid(1), uuid(1)],
      }),
    ).toThrow();
    expect(
      createCapabilityGenerationBatchSchema.parse({
        engineVersion: "CAPABILITY_V3",
        generationPlanId: uuid(3),
        shotIds: [uuid(1)],
        planDigest: sha("a"),
        previewHash: sha("b"),
        costPolicyDigest: sha("c"),
        maximumCalls: 1,
        maximumAiQaCalls: 1,
        maximumCostMicros: 280_000,
        confirmed: true,
        noRetry: true,
        noFallback: true,
      }),
    ).toMatchObject({ engineVersion: "CAPABILITY_V3", maximumCalls: 1 });
    expect(() =>
      createCapabilityGenerationBatchSchema.parse({
        engineVersion: "CAPABILITY_V3",
        generationPlanId: uuid(3),
        shotIds: [uuid(1)],
        planDigest: sha("a"),
        previewHash: sha("b"),
        costPolicyDigest: sha("c"),
        maximumCalls: 2,
        maximumAiQaCalls: 1,
        maximumCostMicros: 280_000,
        confirmed: true,
        noRetry: false,
        noFallback: true,
      }),
    ).toThrow();
  });

  it("returns exact immutable identities, digests, cost and QA ceilings without authority", () => {
    const ref = (id: string) => ({ id, version: "1.0.0" });
    const core = {
      schemaVersion: "capability-generation-execution-preview-v3" as const,
      projectId: uuid(10),
      generationPlanId: uuid(11),
      planDigest: sha("a"),
      selectedShotIds: [uuid(1)],
      targets: [
        {
          shotId: uuid(1),
          ordinal: 1,
          generationSpecRef: ref("generation.spec"),
          implementationRef: ref("implementation.ready"),
          runtimeRef: ref("runtime.comfyui"),
          providerRef: ref("provider.partner"),
          modelRef: ref("model.hailuo"),
          adapterRef: ref("adapter.comfyui-mcp-v2"),
          compilerRef: ref("compiler.hailuo03-reference"),
          lifecycle: "READY" as const,
          compiledRequestDigest: sha("b"),
          inputHash: sha("c"),
          dependencyHash: sha("d"),
          outputHash: sha("e"),
          targetDigest: sha("f"),
          costPolicy: {
            kind: "MONETARY" as const,
            currency: "USD",
            pricingVersion: "2026-08-26",
            estimatedCostMicros: 280_000,
            maximumCostMicros: 280_000,
            effectiveAt: "2026-08-26T00:00:00.000Z",
            expiresAt: "2026-09-01T00:00:00.000Z",
          },
          blockers: [],
        },
      ],
      ready: true,
      submissionBlockers: ["LIVE_DISABLED"],
      expectedCalls: 1,
      maximumCalls: 1,
      maximumAiQaCalls: 1,
      costPolicyDigest: sha("1"),
      maximumCostMicros: 280_000,
      maximumAiQaCostMicros: null,
      maximumTotalCostMicros: null,
      aiQa: null,
      currency: "USD",
      localComputeResources: [],
      pricingExpiresAt: "2026-09-01T00:00:00.000Z",
      noRetry: true as const,
      noFallback: true as const,
      externalCalls: 0 as const,
      generationAuthorized: false as const,
      previewHash: sha("2"),
    } satisfies GenerationExecutionPreviewV3;
    expect(GenerationExecutionPreviewV3Schema.parse(core)).toEqual(core);
  });

  it("keeps V1/V2 routes additive and excludes caller graphs, endpoints and credentials", async () => {
    const [previewRoute, batchRoute, retryPreviewRoute, retryAuthorizeRoute, service, review] =
      await Promise.all([
        readFile(
          "apps/project-web/app/api/generation-plan-versions/[versionId]/execution-preview/route.ts",
          "utf8",
        ),
        readFile("apps/project-web/app/api/generation-batches/route.ts", "utf8"),
        readFile(
          "apps/project-web/app/api/capability-v3-artifacts/[artifactId]/retry-preview/route.ts",
          "utf8",
        ),
        readFile(
          "apps/project-web/app/api/capability-v3-retry-previews/[previewId]/authorize/route.ts",
          "utf8",
        ),
        readFile("packages/project-core/src/generation-execution-service.ts", "utf8"),
        readFile("packages/project-core/src/capability-review-service-v3.ts", "utf8"),
      ]);
    expect(previewRoute).toContain("service.previewV3");
    expect(previewRoute).toContain("service.preview(");
    expect(batchRoute).toContain("service.createBatch");
    expect(service).toContain("generationBatchV3Record");
    expect(service).toContain('isolationLevel: "Serializable"');
    expect(service).toContain('PROJECT_GENERATION_LIVE_ENABLED !== "true"');
    expect(`${previewRoute}\n${batchRoute}`).toContain("CodexManagerLocalVideoQaProvider");
    expect(`${previewRoute}\n${batchRoute}`).toContain("v3QaReadiness");
    expect(`${retryPreviewRoute}\n${retryAuthorizeRoute}`).toContain(
      "CodexManagerLocalVideoQaProvider",
    );
    expect(`${retryPreviewRoute}\n${retryAuthorizeRoute}`).toContain("v3QaReadiness");
    expect(service).toContain("V3 QA health check is unavailable");
    expect(review).toContain("V3 QA health check is unavailable");
    expect(`${previewRoute}\n${batchRoute}`).not.toMatch(
      /workflowJson|rawGraph|credential|apiKey|endpoint|filesystemPath/,
    );
  });
});
