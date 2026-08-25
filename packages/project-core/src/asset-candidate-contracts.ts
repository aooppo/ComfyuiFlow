import { z } from "zod";
import { canonicalSha256 } from "./canonical-json.js";
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
  .strict()
  .superRefine((value, context) => {
    if (!value.productionAssetId && !value.characterProfileId && !value.productionAssetVersionId) {
      context.addIssue({
        code: "custom",
        message: "A stable production or character identity is required",
      });
    }
    for (const [field, values] of [
      ["referenceUsages", value.referenceUsages],
      ["viewpoints", value.viewpoints],
      ["shotScales", value.shotScales],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} must not contain duplicates`,
        });
      }
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

export const candidateReasonCodeSchema = z.enum(candidateReasonCodes);
export const candidateMatchedRuleSchema = z.enum([
  "PROJECT_MATCH",
  "IDENTITY_MATCH",
  "VERSION_MATCH",
  "STATE_MATCH",
  "LIFECYCLE_ELIGIBLE",
  "OWNER_APPROVED",
  "REFERENCE_USAGE_MATCH",
  "VIEWPOINT_AND_SCALE_MATCH",
  "MEDIA_CAPABILITY_MATCH",
]);

export const assetCandidateScoreFactsSchema = z
  .object({
    preferred: z.number().int().min(0).max(1),
    usageExact: z.number().int().min(0).max(1),
    viewpointExact: z.number().int().min(0).max(1),
    shotScaleExact: z.number().int().min(0).max(1),
    probeComplete: z.number().int().min(0).max(1),
    effectivePixels: z.number().int().nonnegative(),
  })
  .strict();

const assetCandidateIdentitySchema = z
  .object({
    productionAssetVersionId: z.string().uuid(),
    characterStateVersionId: z.string().uuid().nullable(),
    versionId: z.string().uuid(),
  })
  .strict();

const assetCandidateReferenceSchema = z
  .object({
    projectAssetId: z.string().uuid(),
    productionAssetVersionId: z.string().uuid(),
    bindingId: z.string().uuid(),
  })
  .strict();

export const eligibleAssetCandidateSchema = assetCandidateReferenceSchema.extend({
  matchedRules: z.array(candidateMatchedRuleSchema),
  scoreFacts: assetCandidateScoreFactsSchema,
});

export const rejectedAssetCandidateSchema = assetCandidateReferenceSchema.extend({
  matchedRules: z.array(candidateMatchedRuleSchema),
  reasonCodes: z.array(candidateReasonCodeSchema).min(1),
});

export const assetCandidateResultSchema = z
  .object({
    policyVersion: z.literal("deterministic-assets-v1"),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    resolvedIdentity: assetCandidateIdentitySchema,
    eligible: z.array(eligibleAssetCandidateSchema),
    rejected: z.array(rejectedAssetCandidateSchema),
    gaps: z.array(z.union([referenceUsageSchema, candidateReasonCodeSchema])),
    formalSelectionCreated: z.literal(false),
  })
  .strict();

export function canonicalCandidateRequirementHash(
  value: z.infer<typeof assetCandidateRequirementSchema>,
) {
  return canonicalSha256(omitUndefinedObjectFields(value));
}

function omitUndefinedObjectFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitUndefinedObjectFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, omitUndefinedObjectFields(child)]),
    );
  }
  return value;
}

export type AssetCandidateRequirement = z.infer<typeof assetCandidateRequirementSchema>;
export type AssetCandidateResult = z.infer<typeof assetCandidateResultSchema>;
export type AssetCandidateReasonCode = z.infer<typeof candidateReasonCodeSchema>;
export type AssetCandidateMatchedRule = z.infer<typeof candidateMatchedRuleSchema>;
export type AssetCandidateScoreFacts = z.infer<typeof assetCandidateScoreFactsSchema>;
