import type { RequirementPurposeV3Schema, VersionRefV2 } from "@comfyuiflow/contracts";
import type { z } from "zod";

type RequirementPurpose = z.infer<typeof RequirementPurposeV3Schema>;

export interface PlanningInputCandidateV3 {
  id: string;
  semanticIdentityRef: VersionRefV2;
  purpose: RequirementPurpose;
  sourceKind:
    "PROJECT_FILE" | "SEMANTIC_ASSET_VERSION" | "CHARACTER_STATE_VERSION" | "UPSTREAM_FINAL_FRAME";
  sourceRef: VersionRefV2;
  sha256: string;
  modality: "IMAGE" | "VIDEO" | "AUDIO";
  displayFilename?: string;
  approved: boolean;
  ready: boolean;
  hashVerified: boolean;
}

export function gatherPlanningInputCandidates(input: {
  requiredPurposes: RequirementPurpose[];
  candidates: PlanningInputCandidateV3[];
}) {
  const required = new Set(input.requiredPurposes);
  return input.candidates
    .filter(
      (candidate) =>
        required.has(candidate.purpose) &&
        candidate.approved &&
        candidate.ready &&
        candidate.hashVerified,
    )
    .sort((left, right) => {
      const leftKey = `${left.purpose}:${left.semanticIdentityRef.id}@${left.semanticIdentityRef.version}:${left.sha256}:${left.id}`;
      const rightKey = `${right.purpose}:${right.semanticIdentityRef.id}@${right.semanticIdentityRef.version}:${right.sha256}:${right.id}`;
      return leftKey.localeCompare(rightKey);
    });
}
