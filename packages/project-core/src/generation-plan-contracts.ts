import { z } from "zod";
import { GenerationPlanVersionInputV1Schema } from "@comfyuiflow/contracts";

export const appendGenerationPlanVersionSchema = GenerationPlanVersionInputV1Schema;
export const generationPlanDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REVOKED"]),
    notes: z.string().trim().max(8_000).optional(),
  })
  .strict();

export const generationPlanErrorCodes = [
  "GENERATION_PLAN_NOT_FOUND",
  "GENERATION_PLAN_VERSION_NOT_FOUND",
  "STORYBOARD_NOT_APPROVED",
  "MANIFEST_MISSING",
  "MANIFEST_STALE",
  "REFERENCE_NOT_READY",
  "REFERENCE_UNAPPROVED",
  "INPUT_HASH_MISMATCH",
  "CROSS_PROJECT",
  "PROJECT_ARCHIVED",
  "DECISION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "PLAN_VERSION_CONFLICT",
  "GENERATION_SPEC_INVALID",
  "PRECONDITION_REQUIRED",
] as const;

export function generationPlanEtag(rowVersion: number) {
  return `"generation-plan-${rowVersion}"`;
}

export function parseGenerationPlanEtag(value: string | null) {
  if (!value) return null;
  const match = /^"generation-plan-(\d+)"$/.exec(value.trim());
  return match?.[1] === undefined ? null : Number(match[1]);
}

export type AppendGenerationPlanVersionInput = z.infer<typeof appendGenerationPlanVersionSchema>;
export type GenerationPlanDecisionInput = z.infer<typeof generationPlanDecisionSchema>;
