import { describe, expect, it } from "vitest";
import { continuationPolicy, decideContinuation } from "@comfyuiflow/project-core";

const criterionNames = [
  "IDENTITY",
  "WARDROBE_STATE",
  "PRODUCT_STRUCTURE",
  "BODY_PROPORTION_SCALE",
  "SCENE",
  "COMPOSITION",
  "CROSS_FRAME_CONTINUITY",
  "VISUAL_DAMAGE",
  "UNEXPECTED_OBJECTS",
] as const;

function result(
  overallStatus: "PASS" | "WARN" | "FAIL" | "NOT_ASSESSABLE",
  overrides: Record<
    string,
    { status: "PASS" | "WARN" | "FAIL" | "NOT_ASSESSABLE"; confidence: "LOW" | "MEDIUM" | "HIGH" }
  > = {},
) {
  return {
    schemaVersion: "ai-qa-result-v1" as const,
    providerId: "fake",
    requestedModelId: "fake-video-qa-v1",
    resolvedModelId: "fake-video-qa-v1",
    responseId: "fixture",
    overallStatus,
    summary: "fixture",
    limitations: ["Frames only", "Advisory only"],
    criteria: criterionNames.map((criterion) => ({
      criterion,
      status: overrides[criterion]?.status ?? "PASS",
      confidence: overrides[criterion]?.confidence ?? "HIGH",
      evidence: "fixture",
      frameRoles: ["FIRST" as const],
    })),
    providerMetadata: undefined,
  } as any;
}

describe("generation continuation policy", () => {
  it.each(["PASS", "WARN", "NOT_ASSESSABLE"] as const)(
    "continues after %s when no high-confidence hard criterion fails",
    (status) => {
      expect(
        decideContinuation(result(status), continuationPolicy("AUTO_CONTINUE_AFTER_QA_PASS")),
      ).toMatchObject({ decision: "CONTINUE" });
    },
  );

  it("pauses on overall FAIL, high-confidence hard FAIL, and explicit owner pause mode", () => {
    const automatic = continuationPolicy("AUTO_CONTINUE_AFTER_QA_PASS");
    expect(decideContinuation(result("FAIL"), automatic).decision).toBe("PAUSE_QA_FAIL");
    expect(
      decideContinuation(
        result("WARN", { IDENTITY: { status: "FAIL", confidence: "HIGH" } }),
        automatic,
      ),
    ).toMatchObject({
      decision: "PAUSE_HARD_CRITERION_FAIL",
      hardFailures: ["IDENTITY"],
    });
    expect(
      decideContinuation(
        result("WARN", { IDENTITY: { status: "FAIL", confidence: "MEDIUM" } }),
        automatic,
      ).decision,
    ).toBe("CONTINUE");
    expect(
      decideContinuation(result("PASS"), continuationPolicy("PAUSE_AFTER_EACH_SHOT")).decision,
    ).toBe("PAUSE_OWNER_POLICY");
  });
});
