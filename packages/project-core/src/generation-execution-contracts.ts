import { z } from "zod";
import {
  BatchCostSnapshotSchema,
  CreateGenerationBatchV1Schema,
  CreateGenerationExecutionPreviewV1Schema,
  HumanQaDecisionV1Schema,
  GenerationExecutionPreviewRequestV3Schema,
  QaContinuationPolicySchema,
} from "@comfyuiflow/contracts";

export const generationExecutionPreviewInputSchema = CreateGenerationExecutionPreviewV1Schema;
export const generationExecutionPreviewV3InputSchema = GenerationExecutionPreviewRequestV3Schema;
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const createWorkflowAgentGenerationBatchSchema = z
  .object({
    engineVersion: z.literal("WORKFLOW_AGENT_V1"),
    generationPlanVersionId: z.string().uuid(),
    previewHash: Sha256Schema,
    dependencyPolicyHash: Sha256Schema,
    targets: z
      .array(
        z.discriminatedUnion("executionDisposition", [
          z
            .object({
              shotExecutionPlanId: z.string().uuid(),
              planTemplateSha256: Sha256Schema,
              executionDisposition: z.literal("EXECUTE"),
            })
            .strict(),
          z
            .object({
              shotExecutionPlanId: z.string().uuid(),
              planTemplateSha256: Sha256Schema,
              executionDisposition: z.literal("REUSE_ARTIFACT"),
              sourceArtifactId: z.string().uuid(),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(20),
    costSnapshot: BatchCostSnapshotSchema,
    continuationPolicy: QaContinuationPolicySchema,
    confirmed: z.literal(true),
    expiresInSeconds: z.number().int().min(30).max(900).default(300),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.targets.map((target) => target.shotExecutionPlanId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "Shot execution plan IDs must be unique",
      });
  });

export const createCapabilityGenerationBatchSchema = z
  .object({
    engineVersion: z.literal("CAPABILITY_V3"),
    generationPlanId: z.string().uuid(),
    shotIds: z.array(z.string().uuid()).min(1).max(20),
    planDigest: Sha256Schema,
    previewHash: Sha256Schema,
    costPolicyDigest: Sha256Schema,
    maximumCalls: z.number().int().positive().max(20),
    maximumAiQaCalls: z.number().int().nonnegative().max(20),
    maximumCostMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    confirmed: z.literal(true),
    noRetry: z.literal(true),
    noFallback: z.literal(true),
    expiresInSeconds: z.number().int().min(30).max(900).default(300),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.shotIds).size !== value.shotIds.length)
      context.addIssue({ code: "custom", path: ["shotIds"], message: "shotIds must be unique" });
  });

export const createGenerationBatchInputSchema = z.union([
  createCapabilityGenerationBatchSchema,
  createWorkflowAgentGenerationBatchSchema,
  CreateGenerationBatchV1Schema,
]);
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
  "ADAPTER_NOT_IMPLEMENTED",
  "COST_UNAVAILABLE",
  "EXECUTION_PLAN_SHA_MISMATCH",
  "MATERIALIZED_INPUT_SHA_MISMATCH",
  "PRE_DISPATCH_BLOCKED",
  "PROVIDER_REJECTED",
  "SUBMISSION_AMBIGUOUS",
  "UPSTREAM_ARTIFACT_NOT_READY",
  "BATCH_COST_LIMIT_EXCEEDED",
] as const;

export const cancelGenerationJobInputSchema = z.object({ expectedRowVersion: z.number().int() });

export type GenerationExecutionPreviewInput = z.infer<typeof generationExecutionPreviewInputSchema>;
export type GenerationExecutionPreviewV3Input = z.infer<
  typeof generationExecutionPreviewV3InputSchema
>;
export type CreateGenerationBatchInput = z.infer<typeof createGenerationBatchInputSchema>;
