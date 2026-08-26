import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Workflow Agent owner UI", () => {
  it("uses business states and keeps technical evidence collapsed", async () => {
    const [planning, progress, review] = await Promise.all([
      readFile("apps/project-web/components/storyboards/workflow-planning-panel.tsx", "utf8"),
      readFile("apps/project-web/components/storyboards/generation-batch-panel.tsx", "utf8"),
      readFile("apps/project-web/components/storyboards/final-owner-review-panel.tsx", "utf8"),
    ]);
    expect(planning).toContain("AUTO");
    expect(planning).toContain("PREFERRED");
    expect(planning).toContain("LOCKED");
    expect(planning).toContain("repair-preview");
    expect(planning).toContain("confirmBatch");
    expect(planning).toContain("I confirm this exact scope and cost ceiling");
    expect(planning).toContain('engineVersion: "WORKFLOW_AGENT_V1"');
    expect(progress).toContain("Dependency-aware execution");
    expect(progress).toContain("<details>");
    expect(review).toContain("Owner PASS");
    expect(review).toContain("Owner FAIL");
    expect(review).toContain("never fabricates Owner PASS");
    expect(review).toContain("<details>");
    expect(`${planning}\n${progress}\n${review}`).not.toMatch(/\bFake\b/);
  });

  it("integrates engine-specific panels without removing legacy history", async () => {
    const editor = await readFile(
      "apps/project-web/components/storyboards/shot-plan-editor.tsx",
      "utf8",
    );
    expect(editor).toContain('batch?.engineVersion === "WORKFLOW_AGENT_V1"');
    expect(editor).toContain("<WorkflowPlanningPanel");
    expect(editor).toContain("<GenerationBatchPanel");
    expect(editor).toContain("<FinalOwnerReviewPanel");
    expect(editor).toContain("Generation history");
    expect(editor).toContain('engineMode === "legacy-v1"');
    expect(editor).toContain("Fake is not offered in the new flow");
  });
});
