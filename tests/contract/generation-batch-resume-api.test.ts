import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("generation batch progress recovery", () => {
  it("exposes full batch history while restoring the latest batch for active polling", async () => {
    const [route, service, editor] = await Promise.all([
      readFile("apps/project-web/app/api/generation-batches/route.ts", "utf8"),
      readFile("packages/project-core/src/generation-execution-service.ts", "utf8"),
      readFile("apps/project-web/components/storyboards/shot-plan-editor.tsx", "utf8"),
    ]);
    await expect(
      access("apps/project-web/app/api/generation-batches/route.ts"),
    ).resolves.toBeUndefined();
    expect(route).toContain("generationPlanVersionId");
    expect(route).toContain("batches[0] ?? null");
    expect(service).toContain("listBatchesForPlanVersion");
    expect(editor).toContain("activeBatchStatuses");
    expect(editor).toContain("batchBlocksNewConfirmation");
    expect(editor).toContain("历史生成批次");
    expect(editor).toContain("generationBatchTarget.ordinal");
    expect(editor).toContain("window.setInterval");
  });
});
