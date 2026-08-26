import {
  GenerationRequirementsSchema,
  ShotRequirementSpecV2Schema,
  type GenerationRequirements,
  type ShotRequirementSpecV2,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";

type UnhashedRequirementSpec = Omit<ShotRequirementSpecV2, "requirementHash"> & {
  requirementHash?: string;
};

export function computeShotRequirementHash(spec: UnhashedRequirementSpec): string {
  const { requirementHash: _ignored, ...payload } = spec;
  void _ignored;
  return canonicalSha256(payload);
}

export function analyzeShotRequirements(rawSpec: ShotRequirementSpecV2): GenerationRequirements {
  const spec = ShotRequirementSpecV2Schema.parse(rawSpec);
  const requiredCapabilities = new Map<string, "HARD" | "HIGH" | "MEDIUM" | "LOW">();
  const requiredInputSlots = new Set<string>();
  const blockers = new Set<string>();

  for (const reference of spec.references) requiredInputSlots.add(reference.semanticRole);
  if (spec.references.length > 0) {
    requiredCapabilities.set(
      spec.references.length > 1 ? "MULTI_REFERENCE_VIDEO" : "REFERENCE_TO_VIDEO",
      "HARD",
    );
  }

  for (const dependency of spec.dependencies) {
    requiredInputSlots.add(dependency.requiredInputSlot);
    if (dependency.targetShotKey !== spec.shotKey) blockers.add("DEPENDENCY_TARGET_MISMATCH");
    if (dependency.type === "PREVIOUS_SHOT_FINAL_FRAME") {
      requiredCapabilities.set("PREVIOUS_FINAL_FRAME_TO_VIDEO", dependency.importance);
      requiredCapabilities.set("FIRST_FRAME_TO_VIDEO", dependency.importance);
    }
  }

  const withoutHash = {
    schemaVersion: "generation-requirements-v1" as const,
    shotKey: spec.shotKey,
    requiredCapabilities: [...requiredCapabilities.entries()]
      .map(([capability, importance]) => ({ capability, importance }))
      .sort((left, right) => left.capability.localeCompare(right.capability)),
    optionalCapabilities: [],
    requiredInputSlots: [...requiredInputSlots].sort(),
    blockers: [...blockers].sort(),
  };
  return GenerationRequirementsSchema.parse({
    ...withoutHash,
    requirementsHash: canonicalSha256(withoutHash),
  });
}
