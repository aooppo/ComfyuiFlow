import type { AiQaResultV1 } from "@comfyuiflow/contracts";
import { QaContinuationPolicySchema, type QaContinuationPolicy } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";

export type ContinuationDecision =
  "CONTINUE" | "PAUSE_OWNER_POLICY" | "PAUSE_QA_FAIL" | "PAUSE_HARD_CRITERION_FAIL";

export function continuationPolicy(mode: "AUTO_CONTINUE_AFTER_QA_PASS" | "PAUSE_AFTER_EACH_SHOT") {
  const core = {
    schemaVersion: "qa-continuation-policy-v1" as const,
    mode,
    hardCriteria: [
      "IDENTITY",
      "PRODUCT_STRUCTURE",
      "VISUAL_DAMAGE",
      "UNEXPECTED_OBJECTS",
      "CROSS_FRAME_CONTINUITY",
    ] as const,
    hardFailConfidence: "HIGH" as const,
  };
  return QaContinuationPolicySchema.parse({ ...core, policyHash: canonicalSha256(core) });
}

export function decideContinuation(
  result: AiQaResultV1,
  policy: QaContinuationPolicy,
): { decision: ContinuationDecision; reasonCode: string; hardFailures: string[] } {
  const hardCriteria = new Set(policy.hardCriteria);
  const hardFailures = result.criteria
    .filter(
      (criterion) =>
        hardCriteria.has(criterion.criterion as any) &&
        criterion.status === "FAIL" &&
        criterion.confidence === policy.hardFailConfidence,
    )
    .map((criterion) => criterion.criterion)
    .sort();
  if (policy.mode === "PAUSE_AFTER_EACH_SHOT")
    return {
      decision: "PAUSE_OWNER_POLICY",
      reasonCode: "OWNER_PAUSE_AFTER_EACH_SHOT",
      hardFailures,
    };
  if (hardFailures.length > 0)
    return {
      decision: "PAUSE_HARD_CRITERION_FAIL",
      reasonCode: "AI_QA_HIGH_CONFIDENCE_HARD_FAIL",
      hardFailures,
    };
  if (result.overallStatus === "FAIL")
    return { decision: "PAUSE_QA_FAIL", reasonCode: "AI_QA_FAIL", hardFailures: [] };
  return {
    decision: "CONTINUE",
    reasonCode: `AI_QA_${result.overallStatus}_CONTINUE`,
    hardFailures: [],
  };
}
