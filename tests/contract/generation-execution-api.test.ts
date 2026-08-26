import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  canonicalSha256,
  createGenerationBatchInputSchema,
  generationExecutionErrorCodes,
} from "@comfyuiflow/project-core";

describe("Generation execution HTTP contract", () => {
  const routes = [
    "/api/generation-plan-versions/{versionId}/execution-preview",
    "/api/generation-batches",
    "/api/generation-batches/{batchId}",
    "/api/generation-jobs/{jobId}/reconcile",
    "/api/generation-jobs/{jobId}/cancel",
    "/api/generated-artifacts/{artifactId}",
    "/api/generated-artifacts/{artifactId}/content",
    "/api/generated-artifacts/{artifactId}/review-frames/{role}",
    "/api/generated-artifacts/{artifactId}/human-qa-decisions",
  ];

  it("documents every public endpoint, idempotency, and no-retry boundary", async () => {
    const contract = await readFile(
      "specs/011-generation-execution-qa/contracts/execution-api.md",
      "utf8",
    );
    for (const route of routes) expect(contract).toContain(route);
    expect(contract).toContain("Idempotency-Key");
    expect(contract).toContain("retryOfJobId");
    expect(contract).toContain("retryRequirements");
    expect(contract).not.toContain("POST /api/generation-jobs/{id}/retry");
  });

  it("keeps stable errors and physical handlers in sync", async () => {
    for (const code of [
      "GENERATION_PLAN_NOT_APPROVED",
      "GENERATION_PLAN_STALE",
      "GENERATION_PROFILE_INCOMPATIBLE",
      "REFERENCE_SLOT_MISSING",
      "REFERENCE_SLOT_AMBIGUOUS",
      "REFERENCE_HASH_MISMATCH",
      "WORKFLOW_NOT_READY",
      "LIVE_DISABLED",
      "AUTHORIZATION_EXPIRED",
      "AUTHORIZATION_SCOPE_MISMATCH",
      "AUTHORIZATION_CONSUMED",
      "JOB_AMBIGUOUS",
      "ARTIFACT_INVALID",
      "QA_NOT_READY",
      "PROJECT_ARCHIVED",
      "IDEMPOTENCY_CONFLICT",
    ])
      expect(generationExecutionErrorCodes).toContain(code);
    for (const path of [
      "apps/project-web/app/api/generation-plan-versions/[versionId]/execution-preview/route.ts",
      "apps/project-web/app/api/generation-batches/route.ts",
      "apps/project-web/app/api/generation-batches/[batchId]/route.ts",
      "apps/project-web/app/api/generation-jobs/[jobId]/reconcile/route.ts",
      "apps/project-web/app/api/generation-jobs/[jobId]/cancel/route.ts",
      "apps/project-web/app/api/generated-artifacts/[artifactId]/route.ts",
      "apps/project-web/app/api/generated-artifacts/[artifactId]/content/route.ts",
      "apps/project-web/app/api/generated-artifacts/[artifactId]/review-frames/[role]/route.ts",
      "apps/project-web/app/api/generated-artifacts/[artifactId]/human-qa-decisions/route.ts",
    ])
      await expect(access(path)).resolves.toBeUndefined();
  });

  it("never exposes secrets, raw workflow JSON, or generated storage paths in route source", async () => {
    const sources = await Promise.all(
      [
        "apps/project-web/app/api/generation-batches/route.ts",
        "apps/project-web/app/api/generation-batches/[batchId]/route.ts",
        "apps/project-web/app/api/generated-artifacts/[artifactId]/route.ts",
      ].map((path) => readFile(path, "utf8")),
    );
    const combined = sources.join("\n");
    expect(combined).not.toContain("CODEX_MANAGER_API_KEY");
    expect(combined).not.toContain("COMFYUI_API_KEY");
    expect(combined).not.toContain("workflowJson");
    expect(combined).not.toContain("absolutePath");
  });

  it("accepts strict mixed Workflow Agent targets while preserving the V1 request", () => {
    const costCore = {
      schemaVersion: "batch-cost-snapshot-v1" as const,
      currency: "USD",
      estimatedCostMicros: 100,
      maximumCostMicros: 100,
      generationCalls: 1,
      qaCalls: 1,
      pricingExpiresAt: "2026-09-01T00:00:00.000Z",
      retryPolicy: "NO_RETRY_NO_FALLBACK" as const,
    };
    const policyCore = {
      schemaVersion: "qa-continuation-policy-v1" as const,
      mode: "AUTO_CONTINUE_AFTER_QA_PASS" as const,
      hardCriteria: ["IDENTITY" as const],
      hardFailConfidence: "HIGH" as const,
    };
    expect(
      createGenerationBatchInputSchema.parse({
        engineVersion: "WORKFLOW_AGENT_V1",
        generationPlanVersionId: "00000000-0000-4000-8000-000000000001",
        previewHash: "a".repeat(64),
        dependencyPolicyHash: "b".repeat(64),
        targets: [
          {
            shotExecutionPlanId: "00000000-0000-4000-8000-000000000002",
            planTemplateSha256: "c".repeat(64),
            executionDisposition: "EXECUTE",
          },
        ],
        costSnapshot: { ...costCore, snapshotHash: canonicalSha256(costCore) },
        continuationPolicy: { ...policyCore, policyHash: canonicalSha256(policyCore) },
        confirmed: true,
      }),
    ).toMatchObject({ engineVersion: "WORKFLOW_AGENT_V1" });
    expect(
      createGenerationBatchInputSchema.parse({
        generationPlanVersionId: "00000000-0000-4000-8000-000000000001",
        providerProfileId: "fake-video-v1",
        generationSpecIds: ["00000000-0000-4000-8000-000000000002"],
        previewHash: "d".repeat(64),
        confirmed: true,
      }),
    ).not.toHaveProperty("engineVersion");
    expect(() =>
      createGenerationBatchInputSchema.parse({
        engineVersion: "WORKFLOW_AGENT_V1",
        unsafeEndpoint: "https://private",
      }),
    ).toThrow();
  });
});
