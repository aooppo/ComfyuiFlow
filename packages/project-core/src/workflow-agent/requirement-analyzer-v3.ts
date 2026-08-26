import {
  ShotRequirementSpecV3Schema,
  type RequirementPurposeV3Schema,
  type VersionRefV2,
} from "@comfyuiflow/contracts";
import type { z } from "zod";
import { canonicalSha256 } from "../canonical-json.js";

type RequirementPurpose = z.infer<typeof RequirementPurposeV3Schema>;

export interface NormalizedShotSemanticsV3 {
  personPresent: boolean;
  explicitCharacterIdentityRequired: boolean;
  appearanceContinuityRequired: boolean;
  productIdentityRequired: boolean;
  environmentIdentityRequired: boolean;
  styleReferenceDesired: boolean;
  previousFinalFrameRequired: boolean;
  motionReferenceRequired: boolean;
  audioReferenceRequired: boolean;
}

export interface AnalyzeShotRequirementsV3Input {
  specId: string;
  version: string;
  shotId: string;
  storyboardRevisionRef: VersionRefV2;
  semantics: NormalizedShotSemanticsV3;
  selectedEvidencePurposes: RequirementPurpose[];
}

interface PurposeRule {
  purpose: RequirementPurpose;
  required: boolean;
  optional: boolean;
  requiredReason: string;
  optionalReason?: string;
  omittedReason?: string;
  constraints: string[];
}

export function analyzeShotRequirementsV3(input: AnalyzeShotRequirementsV3Input) {
  const selected = new Set(input.selectedEvidencePurposes);
  const semantics = input.semantics;
  const characterRequired =
    semantics.explicitCharacterIdentityRequired || semantics.appearanceContinuityRequired;
  const rules: PurposeRule[] = [
    {
      purpose: "CHARACTER",
      required: characterRequired,
      optional: semantics.personPresent || selected.has("CHARACTER"),
      requiredReason: semantics.appearanceContinuityRequired
        ? "CHARACTER_APPEARANCE_CONTINUITY_REQUIRED"
        : "EXPLICIT_CHARACTER_IDENTITY_REQUIRED",
      optionalReason: selected.has("CHARACTER")
        ? "OWNER_SELECTED_OPTIONAL_EVIDENCE"
        : "PERSON_PRESENT_WITHOUT_IDENTITY_LOCK",
      omittedReason: "NO_EXPLICIT_CHARACTER_NEED",
      constraints: [
        ...(semantics.explicitCharacterIdentityRequired ? ["IDENTITY_STABILITY"] : []),
        ...(semantics.appearanceContinuityRequired ? ["APPEARANCE_CONTINUITY"] : []),
      ],
    },
    {
      purpose: "PRODUCT",
      required: semantics.productIdentityRequired,
      optional: selected.has("PRODUCT"),
      requiredReason: "PRODUCT_IDENTITY_REQUIRED",
      constraints: semantics.productIdentityRequired ? ["PRODUCT_STRUCTURE_STABILITY"] : [],
    },
    {
      purpose: "ENVIRONMENT",
      required: semantics.environmentIdentityRequired,
      optional: selected.has("ENVIRONMENT"),
      requiredReason: "ENVIRONMENT_IDENTITY_REQUIRED",
      constraints: semantics.environmentIdentityRequired ? ["ENVIRONMENT_STABILITY"] : [],
    },
    {
      purpose: "STYLE",
      required: false,
      optional: semantics.styleReferenceDesired || selected.has("STYLE"),
      requiredReason: "STYLE_REFERENCE_REQUIRED",
      optionalReason: semantics.styleReferenceDesired
        ? "STYLE_REFERENCE_DESIRED"
        : "OWNER_SELECTED_OPTIONAL_EVIDENCE",
      constraints: [],
    },
    {
      purpose: "CONTINUITY",
      required: semantics.previousFinalFrameRequired,
      optional: selected.has("CONTINUITY"),
      requiredReason: "PREVIOUS_FINAL_FRAME_REQUIRED",
      constraints: semantics.previousFinalFrameRequired ? ["EXACT_UPSTREAM_FINAL_FRAME"] : [],
    },
    {
      purpose: "MOTION",
      required: semantics.motionReferenceRequired,
      optional: selected.has("MOTION"),
      requiredReason: "MOTION_REFERENCE_REQUIRED",
      constraints: semantics.motionReferenceRequired ? ["MOTION_REFERENCE"] : [],
    },
    {
      purpose: "AUDIO",
      required: semantics.audioReferenceRequired,
      optional: selected.has("AUDIO"),
      requiredReason: "AUDIO_REFERENCE_REQUIRED",
      constraints: semantics.audioReferenceRequired ? ["AUDIO_REFERENCE"] : [],
    },
    {
      purpose: "OTHER",
      required: false,
      optional: selected.has("OTHER"),
      requiredReason: "OTHER_INPUT_REQUIRED",
      constraints: [],
    },
  ];
  const purposes = rules
    .map((rule) => {
      const necessity = rule.required ? "REQUIRED" : rule.optional ? "OPTIONAL" : "OMITTED";
      const reasonCode = rule.required
        ? rule.requiredReason
        : rule.optional
          ? (rule.optionalReason ?? "OWNER_SELECTED_OPTIONAL_EVIDENCE")
          : (rule.omittedReason ?? "PURPOSE_NOT_NEEDED_FOR_SHOT");
      return {
        purpose: rule.purpose,
        necessity,
        reasonCode,
        constraints: [...rule.constraints].sort(),
      } as const;
    })
    .sort((left, right) => left.purpose.localeCompare(right.purpose));
  const withoutHash = {
    id: input.specId,
    version: input.version,
    shotId: input.shotId,
    storyboardRevisionRef: input.storyboardRevisionRef,
    purposes,
  };
  return ShotRequirementSpecV3Schema.parse({
    ...withoutHash,
    requirementHash: canonicalSha256(withoutHash),
  });
}
