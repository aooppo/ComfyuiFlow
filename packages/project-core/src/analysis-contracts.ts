import { z } from "zod";
import { AssetUnderstandingFactsSchema } from "@comfyuiflow/contracts";

export const analysisPreviewSchema = z
  .object({
    assetIds: z
      .array(z.string().uuid())
      .min(1)
      .max(9)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Asset ids must be unique",
      }),
    providerId: z.string().trim().min(1).max(80).default("fake"),
    modelId: z.string().trim().min(1).max(160).default("asset-understanding-fake-v1"),
  })
  .strict();
export const analysisConfirmSchema = z
  .object({
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    acknowledgeExternalImageUpload: z.literal(true),
    idempotencyKey: z.string().trim().min(16).max(120),
  })
  .strict();
export const understandingReviewSchema = z
  .object({
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    notes: z.string().trim().max(2_000).optional(),
    idempotencyKey: z.string().trim().min(16).max(120),
  })
  .strict();
export const understandingCorrectionSchema = z
  .object({
    facts: AssetUnderstandingFactsSchema,
    acceptCorrection: z.literal(true),
    idempotencyKey: z.string().trim().min(16).max(120),
  })
  .strict();
export const understandingApplicationSchema = z
  .object({
    targetType: z.enum(["PRODUCTION_ASSET_DRAFT", "ASSET_VERSION_FILE_DRAFT"]),
    targetId: z.string().uuid(),
    fieldMappings: z
      .array(
        z.object({ sourceField: z.string().max(120), targetField: z.string().max(120) }).strict(),
      )
      .min(1)
      .max(20),
    idempotencyKey: z.string().trim().min(16).max(120),
  })
  .strict();
