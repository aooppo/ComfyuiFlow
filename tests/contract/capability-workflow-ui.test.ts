import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Capability workflow owner UI", () => {
  it("offers save to zero-call preview to one exact confirmation with partial Shot selection", async () => {
    const source = await readFile(
      "apps/project-web/components/storyboards/workflow-planning-panel.tsx",
      "utf8",
    );
    expect(source).toContain("selectedForExecution");
    expect(source).toContain("capability-generation-execution-preview-request-v3");
    expect(source).toContain('engineVersion: "CAPABILITY_V3"');
    expect(source).toContain("Confirm one bounded video batch");
    expect(source).toContain("AI QA ceiling");
    expect(source).toContain("First real trial");
    expect(source).toContain("no-retry rule");
    expect(source).toContain("if (!executionPreview?.ready || !confirmed) return;");
    expect(source).toContain("!confirmed ||");
  });

  it("keeps technical, AI QA, and explicit PASS/FAIL/RISK_ACCEPTED owner decisions separate", async () => {
    const [batch, review] = await Promise.all([
      readFile("apps/project-web/components/storyboards/generation-batch-panel.tsx", "utf8"),
      readFile("apps/project-web/components/storyboards/final-owner-review-panel.tsx", "utf8"),
    ]);
    expect(batch).toContain("Technical evidence");
    expect(batch).toContain("AI QA calls");
    expect(review).toContain("Owner PASS");
    expect(review).toContain("Owner FAIL");
    expect(review).toContain("Owner RISK_ACCEPTED");
    expect(review).toContain("AI advisory");
    expect(review).toContain("never auto-filled");
  });

  it("restores the persisted V3 batch and polls only while it remains active", async () => {
    const [planning, review, route] = await Promise.all([
      readFile("apps/project-web/components/storyboards/workflow-planning-panel.tsx", "utf8"),
      readFile("apps/project-web/components/storyboards/capability-v3-batch-review.tsx", "utf8"),
      readFile(
        "apps/project-web/app/api/storyboard-versions/[versionId]/workflow-plans/route.ts",
        "utf8",
      ),
    ]);
    expect(planning).toContain("workflow-plans");
    expect(planning).toContain("value?.batch && setBatch");
    expect(route).toContain("latestCapabilityBatchForStoryboardVersion");
    expect(review).toContain('["QUEUED", "RUNNING", "SUBMITTED", "RECONCILING"]');
    expect(review).toContain("terminalRefresh.current !== activeBatchId");
    expect(review).toContain("setActiveBatchId(authorized.batchId)");
  });

  it("removes owner-callable Fake controls while retaining explicit historical read labeling", async () => {
    const [editor, director, shotPlan] = await Promise.all([
      readFile("apps/project-web/components/storyboards/storyboard-editor.tsx", "utf8"),
      readFile("apps/project-web/components/storyboards/storyboard-director-panel.tsx", "utf8"),
      readFile("apps/project-web/components/storyboards/shot-plan-editor.tsx", "utf8"),
    ]);
    expect(editor).not.toMatch(/New Fake proposal|Generate three shots/);
    expect(editor).not.toMatch(
      /Freeze asset manifest|Approve storyboard|Preview asset candidates|新建 Shot Plan/,
    );
    expect(director).not.toContain("<select");
    expect(director).toContain("Adopt as new version");
    expect(director).toContain("Reject proposal");
    expect(director).toContain("Historical Fake records (read-only");
    expect(director).not.toContain("fake-storyboard-v2");
    expect(shotPlan).not.toContain('<option value="fake-video-v1"');
    expect(shotPlan).toContain("Historical test batch (read-only)");
  });
});
