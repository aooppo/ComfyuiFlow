import { z } from "zod";
import {
  CreateGenerationBatchV1Schema,
  CreateGenerationExecutionPreviewV1Schema,
  HumanQaDecisionV1Schema,
} from "@comfyuiflow/contracts";

export const generationExecutionPreviewInputSchema = CreateGenerationExecutionPreviewV1Schema;
export const createGenerationBatchInputSchema = CreateGenerationBatchV1Schema;
export const humanQaDecisionInputSchema = HumanQaDecisionV1Schema;

export const generationExecutionErrorCodes = [
  "GENERATION_PLAN_NOT_APPROVED",
  "GENERATION_PLAN_STALE",
  "GENERATION_PROFILE_INCOMPATIBLE",
  "GENERATION_TARGET_INVALID",
  "REFERENCE_SLOT_MISSING",
  "REFERENCE_SLOT_AMBIGUOUS",
  "REFERENCE_CHARACTER_MISMATCH",
  "REFERENCE_NOT_READY",
  "REFERENCE_HASH_MISMATCH",
  "WORKFLOW_NOT_READY",
  "LIVE_DISABLED",
  "PREVIEW_STALE",
  "AUTHORIZATION_EXPIRED",
  "AUTHORIZATION_SCOPE_MISMATCH",
  "AUTHORIZATION_CONSUMED",
  "JOB_NOT_RECONCILABLE",
  "JOB_AMBIGUOUS",
  "ARTIFACT_INVALID",
  "QA_NOT_READY",
  "PROJECT_ARCHIVED",
  "STORYBOARD_ARCHIVED",
  "IDEMPOTENCY_CONFLICT",
  "PRECONDITION_REQUIRED",
  "GENERATION_BATCH_CONFLICT",
] as const;

export const cancelGenerationJobInputSchema = z.object({ expectedRowVersion: z.number().int() });

export type GenerationExecutionPreviewInput = z.infer<typeof generationExecutionPreviewInputSchema>;
export type CreateGenerationBatchInput = z.infer<typeof createGenerationBatchInputSchema>;
