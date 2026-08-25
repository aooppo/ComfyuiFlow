import type { AssetRoleValue } from "./contracts.js";

export type LegacyAssetRoleReviewStatus = "SUGGESTED" | "NEEDS_REVIEW";

export interface LegacyAssetRoleSuggestion {
  legacyRole: AssetRoleValue;
  referenceUsages: Array<
    "IDENTITY" | "FACE" | "FULL_BODY" | "OUTFIT_DETAIL" | "PROP_DETAIL" | "SCENE_STYLE"
  >;
  viewpoint: "FRONT" | "REAR_THREE_QUARTER" | "UNSPECIFIED";
  reviewStatus: LegacyAssetRoleReviewStatus;
  reasonCode: string;
}

const suggestions: Record<AssetRoleValue, Omit<LegacyAssetRoleSuggestion, "legacyRole">> = {
  CHARACTER_FACE: {
    referenceUsages: ["IDENTITY", "FACE"],
    viewpoint: "FRONT",
    reviewStatus: "SUGGESTED",
    reasonCode: "LEGACY_CHARACTER_FACE",
  },
  CHARACTER_FULL_BODY: {
    referenceUsages: ["IDENTITY", "FULL_BODY"],
    viewpoint: "FRONT",
    reviewStatus: "SUGGESTED",
    reasonCode: "LEGACY_CHARACTER_FULL_BODY",
  },
  CHARACTER_REAR_SIDE: {
    referenceUsages: ["IDENTITY", "FULL_BODY"],
    viewpoint: "REAR_THREE_QUARTER",
    reviewStatus: "SUGGESTED",
    reasonCode: "LEGACY_CHARACTER_REAR_SIDE",
  },
  PRODUCT: {
    referenceUsages: ["PROP_DETAIL"],
    viewpoint: "UNSPECIFIED",
    reviewStatus: "SUGGESTED",
    reasonCode: "LEGACY_PRODUCT_DETAIL",
  },
  PROP: {
    referenceUsages: ["PROP_DETAIL"],
    viewpoint: "UNSPECIFIED",
    reviewStatus: "SUGGESTED",
    reasonCode: "LEGACY_PROP_DETAIL",
  },
  SCENE: {
    referenceUsages: ["SCENE_STYLE"],
    viewpoint: "UNSPECIFIED",
    reviewStatus: "SUGGESTED",
    reasonCode: "LEGACY_SCENE_STYLE",
  },
  AUDIO: {
    referenceUsages: [],
    viewpoint: "UNSPECIFIED",
    reviewStatus: "NEEDS_REVIEW",
    reasonCode: "LEGACY_AUDIO_AMBIGUOUS",
  },
  OTHER: {
    referenceUsages: [],
    viewpoint: "UNSPECIFIED",
    reviewStatus: "NEEDS_REVIEW",
    reasonCode: "LEGACY_OTHER_AMBIGUOUS",
  },
};

/**
 * Returns an owner-reviewable suggestion only. It does not create a semantic asset,
 * bind a file, update the legacy role, or persist any inferred fact.
 */
export function suggestLegacyAssetRole(role: AssetRoleValue): LegacyAssetRoleSuggestion {
  const suggestion = suggestions[role];
  return {
    legacyRole: role,
    referenceUsages: [...suggestion.referenceUsages],
    viewpoint: suggestion.viewpoint,
    reviewStatus: suggestion.reviewStatus,
    reasonCode: suggestion.reasonCode,
  };
}

export function suggestLegacyAssetRoles(
  roles: readonly AssetRoleValue[],
): LegacyAssetRoleSuggestion[] {
  return roles.map(suggestLegacyAssetRole);
}
