import { createHash } from "node:crypto";
import { z } from "zod";
import {
  productionAssetTypeSchema,
  referenceUsageSchema,
  shotScaleSchema,
  viewpointSchema,
} from "./production-asset-contracts.js";

export const assetCandidateRequirementSchema = z
  .object({
    contractVersion: z.literal("asset-candidate-v1"),
    projectId: z.string().uuid(),
    requirementId: z.string().trim().min(1).max(120),
    assetType: productionAssetTypeSchema,
    productionAssetId: z.string().uuid().optional(),
    productionAssetVersionId: z.string().uuid().optional(),
    characterProfileId: z.string().uuid().optional(),
    characterVersionId: z.string().uuid().optional(),
    characterStateVersionId: z.string().uuid().optional(),
    referenceUsages: z.array(referenceUsageSchema).min(1).max(9),
    viewpoints: z.array(viewpointSchema).max(9).default([]),
    shotScales: z.array(shotScaleSchema).max(9).default([]),
    mediaCapability: z
      .object({
        mediaType: z.literal("IMAGE").default("IMAGE"),
        acceptedMimeTypes: z.array(z.string().startsWith("image/")).max(12).default([]),
        minimumWidth: z.number().int().positive().max(16_384).optional(),
        minimumHeight: z.number().int().positive().max(16_384).optional(),
      })
      .default({ mediaType: "IMAGE", acceptedMimeTypes: [] }),
    policy: z
      .object({
        allowUnspecifiedViewpoint: z.boolean().default(false),
        allowUnspecifiedShotScale: z.boolean().default(false),
      })
      .default({ allowUnspecifiedViewpoint: false, allowUnspecifiedShotScale: false }),
  })
  .superRefine((value, context) => {
    if (!value.productionAssetId && !value.characterProfileId && !value.productionAssetVersionId) {
      context.addIssue({
        code: "custom",
        message: "A stable production or character identity is required",
      });
    }
  });

export const candidateReasonCodes = [
  "CROSS_PROJECT",
  "WRONG_IDENTITY",
  "WRONG_VERSION",
  "WRONG_CHARACTER_STATE",
  "INACTIVE_ASSET",
  "FILE_NOT_READY",
  "UNAPPROVED_BINDING",
  "REFERENCE_USAGE_MISSING",
  "VIEWPOINT_MISMATCH",
  "SHOT_SCALE_MISMATCH",
  "MEDIA_CAPABILITY_MISMATCH",
  "NO_ELIGIBLE_CANDIDATE",
] as const;

export function canonicalCandidateRequirementHash(
  value: z.infer<typeof assetCandidateRequirementSchema>,
) {
  const normalized = JSON.stringify(value, Object.keys(value).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

export type AssetCandidateRequirement = z.infer<typeof assetCandidateRequirementSchema>;
