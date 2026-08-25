import type {
  AssetCandidateMatchedRule,
  AssetCandidateReasonCode,
  AssetCandidateRequirement,
  AssetCandidateScoreFacts,
} from "./asset-candidate-contracts.js";

export const ASSET_CANDIDATE_POLICY_VERSION = "deterministic-assets-v1" as const;

export interface AssetCandidatePolicyBinding {
  id: string;
  projectId: string;
  productionAssetVersionId: string;
  assetType: string;
  productionAssetStatus: string;
  productionAssetVersionStatus: string;
  bindingStatus: string;
  projectAssetStatus: string;
  approvalStatus: string;
  referenceUsage: string;
  viewpoint: string;
  shotScale: string;
  mediaType: string;
  detectedMimeType: string;
  width: number | null;
  height: number | null;
  isPreferred: boolean;
}

export interface AssetCandidatePolicyContext {
  expectedVersionId: string;
  characterStateMatches?: boolean;
}

export interface AssetCandidatePolicyDecision {
  matchedRules: AssetCandidateMatchedRule[];
  reasonCodes: AssetCandidateReasonCode[];
  scoreFacts: AssetCandidateScoreFacts;
}

export function evaluateAssetCandidate(
  input: AssetCandidateRequirement,
  binding: AssetCandidatePolicyBinding,
  context: AssetCandidatePolicyContext,
): AssetCandidatePolicyDecision {
  const matchedRules: AssetCandidateMatchedRule[] = [];
  const reasonCodes: AssetCandidateReasonCode[] = [];

  if (binding.projectId === input.projectId) matchedRules.push("PROJECT_MATCH");
  else reasonCodes.push("CROSS_PROJECT");

  if (binding.assetType === input.assetType) matchedRules.push("IDENTITY_MATCH");
  else reasonCodes.push("WRONG_IDENTITY");

  if (binding.productionAssetVersionId === context.expectedVersionId) {
    matchedRules.push("VERSION_MATCH");
  } else {
    reasonCodes.push("WRONG_VERSION");
  }

  if (!input.characterStateVersionId || context.characterStateMatches !== false) {
    matchedRules.push("STATE_MATCH");
  } else {
    reasonCodes.push("WRONG_CHARACTER_STATE");
  }

  if (
    binding.productionAssetStatus === "ACTIVE" &&
    binding.productionAssetVersionStatus === "ACTIVE" &&
    binding.bindingStatus === "ACTIVE"
  ) {
    matchedRules.push("LIFECYCLE_ELIGIBLE");
  } else {
    reasonCodes.push("INACTIVE_ASSET");
  }

  if (binding.projectAssetStatus !== "READY") reasonCodes.push("FILE_NOT_READY");

  if (binding.approvalStatus === "ACCEPTED") matchedRules.push("OWNER_APPROVED");
  else reasonCodes.push("UNAPPROVED_BINDING");

  if (input.referenceUsages.includes(binding.referenceUsage as never)) {
    matchedRules.push("REFERENCE_USAGE_MATCH");
  } else {
    reasonCodes.push("REFERENCE_USAGE_MISSING");
  }

  const viewpointMatches =
    input.viewpoints.length === 0 ||
    input.viewpoints.includes(binding.viewpoint as never) ||
    (input.policy.allowUnspecifiedViewpoint && binding.viewpoint === "UNSPECIFIED");
  if (!viewpointMatches) reasonCodes.push("VIEWPOINT_MISMATCH");

  const shotScaleMatches =
    input.shotScales.length === 0 ||
    input.shotScales.includes(binding.shotScale as never) ||
    (input.policy.allowUnspecifiedShotScale && binding.shotScale === "UNSPECIFIED");
  if (!shotScaleMatches) reasonCodes.push("SHOT_SCALE_MISMATCH");
  if (viewpointMatches && shotScaleMatches) matchedRules.push("VIEWPOINT_AND_SCALE_MATCH");

  const capability = input.mediaCapability;
  const mediaMatches =
    binding.mediaType === capability.mediaType &&
    (capability.acceptedMimeTypes.length === 0 ||
      capability.acceptedMimeTypes.includes(binding.detectedMimeType)) &&
    (capability.minimumWidth === undefined || (binding.width ?? 0) >= capability.minimumWidth) &&
    (capability.minimumHeight === undefined || (binding.height ?? 0) >= capability.minimumHeight);
  if (mediaMatches) matchedRules.push("MEDIA_CAPABILITY_MATCH");
  else reasonCodes.push("MEDIA_CAPABILITY_MISMATCH");

  return {
    matchedRules,
    reasonCodes,
    scoreFacts: {
      preferred: binding.isPreferred ? 1 : 0,
      usageExact: input.referenceUsages.includes(binding.referenceUsage as never) ? 1 : 0,
      viewpointExact:
        input.viewpoints.length === 0 || input.viewpoints.includes(binding.viewpoint as never)
          ? 1
          : 0,
      shotScaleExact:
        input.shotScales.length === 0 || input.shotScales.includes(binding.shotScale as never)
          ? 1
          : 0,
      probeComplete: (binding.width ?? 0) > 0 && (binding.height ?? 0) > 0 ? 1 : 0,
      effectivePixels: Math.max(binding.width ?? 0, 0) * Math.max(binding.height ?? 0, 0),
    },
  };
}

export function compareAssetCandidateRank(
  left: { bindingId: string; createdAt: Date; scoreFacts: AssetCandidateScoreFacts },
  right: { bindingId: string; createdAt: Date; scoreFacts: AssetCandidateScoreFacts },
) {
  for (const key of [
    "preferred",
    "usageExact",
    "viewpointExact",
    "shotScaleExact",
    "probeComplete",
    "effectivePixels",
  ] as const) {
    if (left.scoreFacts[key] !== right.scoreFacts[key]) {
      return right.scoreFacts[key] - left.scoreFacts[key];
    }
  }
  const createdOrder = left.createdAt.getTime() - right.createdAt.getTime();
  return createdOrder || left.bindingId.localeCompare(right.bindingId);
}
