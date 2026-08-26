import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  createRepairDirectorRunSchema,
  repairDirectorPreviewInputSchema,
} from "@comfyuiflow/project-core";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);

describe("Workflow Agent repair API", () => {
  it("keeps Director repair preview and confirmation strict and separately authorized", () => {
    const preview = repairDirectorPreviewInputSchema.parse({
      proposalHash: hash,
      impactHash: otherHash,
      action: "REWRITE_SHOT",
      profileId: "fake-storyboard-v2",
    });
    expect(preview.action).toBe("REWRITE_SHOT");
    expect(() =>
      repairDirectorPreviewInputSchema.parse({ ...preview, rawPrompt: "unsafe" }),
    ).toThrow();
    expect(() =>
      createRepairDirectorRunSchema.parse({
        ...preview,
        previewHash: hash,
        idempotencyKey: "repair-01",
        videoAuthorizationId: "not-accepted",
      }),
    ).toThrow();
  });

  it("exposes thin zero-call preview/local-adopt routes and a one-attempt Director route", async () => {
    const [previewRoute, runRoute, adoptRoute, repairService, directorService, worker] =
      await Promise.all([
        readFile(
          "apps/project-web/app/api/shot-execution-plans/[planId]/repair-preview/route.ts",
          "utf8",
        ),
        readFile(
          "apps/project-web/app/api/shot-execution-plans/[planId]/repair-runs/route.ts",
          "utf8",
        ),
        readFile(
          "apps/project-web/app/api/workflow-repair-proposals/[proposalId]/adopt/route.ts",
          "utf8",
        ),
        readFile("packages/project-core/src/workflow-agent/workflow-repair-service.ts", "utf8"),
        readFile("packages/project-core/src/storyboard-director-service.ts", "utf8"),
        readFile("packages/project-core/src/storyboard-director-worker.ts", "utf8"),
      ]);
    expect(previewRoute).toContain('"Cache-Control": "no-store"');
    expect(runRoute).toContain("requiredStoryboardRowVersion(request)");
    expect(adoptRoute).toContain("requiredGenerationPlanRowVersion(request)");
    expect(adoptRoute).toContain("requiredStoryboardRowVersion(request)");
    expect(repairService).toContain("externalCalls: 0 as const");
    expect(repairService).not.toContain("generateStoryboardV2");
    expect(directorService).toContain("maxCalls: 1");
    expect(directorService).toContain('runKind: "SHOT_REPAIR"');
    expect(worker).toContain("DIRECTOR_REPAIR_SHOT_COUNT_INVALID");
    expect(worker).not.toMatch(/for\s*\([^)]*retry/i);
  });
});
