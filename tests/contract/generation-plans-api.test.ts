import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { generationPlanErrorCodes } from "@comfyuiflow/project-core";

describe("Generation Plan HTTP contract", () => {
  it("documents all public endpoints and stable boundaries", async () => {
    const contract = await readFile(
      "specs/009-shot-planner-generation-spec/contracts/generation-plan-api.md",
      "utf8",
    );
    for (const route of [
      "/api/storyboard-versions/{versionId}/generation-plans",
      "/api/storyboards/{storyboardId}/generation-plans",
      "/api/generation-plans/{planId}",
      "/api/generation-plans/{planId}/versions",
      "/api/generation-plan-versions/{versionId}/preflight",
      "/api/generation-plan-versions/{versionId}/decisions",
    ])
      expect(contract).toContain(route);
    expect(contract).toContain("generationAuthorized: false");
  });

  it("keeps stable errors and physical handlers in sync", async () => {
    for (const code of [
      "STORYBOARD_NOT_APPROVED",
      "MANIFEST_MISSING",
      "MANIFEST_STALE",
      "REFERENCE_NOT_READY",
      "INPUT_HASH_MISMATCH",
      "PLAN_VERSION_CONFLICT",
      "GENERATION_SPEC_INVALID",
    ])
      expect(generationPlanErrorCodes).toContain(code);
    for (const path of [
      "apps/project-web/app/api/storyboard-versions/[versionId]/generation-plans/route.ts",
      "apps/project-web/app/api/storyboards/[storyboardId]/generation-plans/route.ts",
      "apps/project-web/app/api/generation-plans/[planId]/route.ts",
      "apps/project-web/app/api/generation-plans/[planId]/versions/route.ts",
      "apps/project-web/app/api/generation-plan-versions/[versionId]/preflight/route.ts",
      "apps/project-web/app/api/generation-plan-versions/[versionId]/decisions/route.ts",
    ])
      await expect(access(path)).resolves.toBeUndefined();
  });

  it("keeps existing Shot Plans reachable as read-only history without a legacy creation entry", async () => {
    const editor = await readFile(
      "apps/project-web/components/storyboards/storyboard-editor.tsx",
      "utf8",
    );
    expect(editor).toContain("/api/storyboards/${storyboardId}/generation-plans");
    expect(editor).toContain("历史 Shot Plan");
    expect(editor).toContain("旧计划、批次、素材清单和审批记录继续保留");
    expect(editor).not.toContain("打开最新 Shot Plan");
    expect(editor).not.toContain("新建 Shot Plan");
  });
});
