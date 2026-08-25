import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { storyboardErrorCodes } from "@comfyuiflow/project-core";

describe("Storyboard HTTP contract", () => {
  it("documents all implemented API routes and concurrency rules", async () => {
    const contract = await readFile(
      "specs/008-storyboard-workspace/contracts/storyboard-api.md",
      "utf8",
    );
    for (const route of [
      "/api/projects/{projectId}/storyboards",
      "/api/storyboards/{storyboardId}/generate",
      "/api/storyboards/{storyboardId}/versions",
      "/api/storyboard-versions/{versionId}/asset-candidates/preview",
      "/api/storyboard-versions/{versionId}/asset-resolution-manifests",
      "/api/storyboard-versions/{versionId}/decisions",
    ]) {
      expect(contract).toContain(route);
    }
    expect(contract).toContain("HTTP 428 `PRECONDITION_REQUIRED`");
    expect(contract).toContain(
      "Approval responses explicitly include `generationAuthorized: false`",
    );
  });

  it("keeps stable error codes and physical route handlers in sync", async () => {
    expect(storyboardErrorCodes).toContain("VERSION_CONFLICT");
    expect(storyboardErrorCodes).toContain("PHASE2_GATE_CLOSED");
    for (const path of [
      "apps/project-web/app/api/projects/[projectId]/storyboards/route.ts",
      "apps/project-web/app/api/storyboards/[storyboardId]/generate/route.ts",
      "apps/project-web/app/api/storyboards/[storyboardId]/versions/route.ts",
      "apps/project-web/app/api/storyboard-versions/[versionId]/asset-candidates/preview/route.ts",
      "apps/project-web/app/api/storyboard-versions/[versionId]/asset-resolution-manifests/route.ts",
      "apps/project-web/app/api/storyboard-versions/[versionId]/decisions/route.ts",
    ]) {
      await expect(access(path)).resolves.toBeUndefined();
    }
  });
});
