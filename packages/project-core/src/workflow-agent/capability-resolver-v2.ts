import type {
  GenerationImplementationV2,
  PlanningInputBindingV3Schema,
} from "@comfyuiflow/contracts";
import type { z } from "zod";
import type { LoadedCapabilityRegistry } from "./capability-registry.js";

type Binding = z.infer<typeof PlanningInputBindingV3Schema>;

export type CapabilityRejectionCodeV2 =
  | "TEST_ONLY_IMPLEMENTATION"
  | "IMPLEMENTATION_LIFECYCLE_NOT_SELECTABLE"
  | "TRIAL_SCOPE_REQUIRED"
  | "CAPABILITY_MISMATCH"
  | "INPUT_COUNT_MISMATCH"
  | "INPUT_INVARIANT_FAILED"
  | "MONETARY_PRICE_MISSING_OR_EXPIRED";

export interface CapabilityResolutionInputV2 {
  bindings: Binding[];
  requiredCapability?:
    | "TEXT_TO_VIDEO"
    | "ORDERED_REFERENCE_TO_VIDEO"
    | "FIRST_FRAME_TO_VIDEO"
    | "FIRST_LAST_FRAME_TO_VIDEO"
    | "PREVIOUS_FINAL_FRAME_TO_VIDEO";
  production?: boolean;
  allowedTrialRefs?: ReadonlySet<string>;
  now?: Date;
}

const refKey = (value: { id: string; version: string }) => `${value.id}@${value.version}`;

export function inferRequiredCapabilityV2(
  bindings: Binding[],
): NonNullable<CapabilityResolutionInputV2["requiredCapability"]> {
  if (bindings.some((binding) => binding.sourceKind === "UPSTREAM_FINAL_FRAME"))
    return "PREVIOUS_FINAL_FRAME_TO_VIDEO";
  const frameRoles = new Set(bindings.map((binding) => binding.roleLabel.toLowerCase()));
  if (frameRoles.has("first-frame") && frameRoles.has("last-frame"))
    return "FIRST_LAST_FRAME_TO_VIDEO";
  if (frameRoles.has("first-frame")) return "FIRST_FRAME_TO_VIDEO";
  if (bindings.length > 0) return "ORDERED_REFERENCE_TO_VIDEO";
  return "TEXT_TO_VIDEO";
}

export function monetaryPolicyIsCurrent(
  policy: GenerationImplementationV2["costPolicy"],
  now = new Date(),
) {
  if (policy.kind === "LOCAL_COMPUTE") return true;
  if (policy.kind === "TEST_ZERO_CALL") return false;
  return (
    Date.parse(policy.effectiveAt) <= now.getTime() && now.getTime() < Date.parse(policy.expiresAt)
  );
}

export function resolveCapabilityCandidatesV2(
  registry: LoadedCapabilityRegistry,
  input: CapabilityResolutionInputV2,
) {
  const requiredCapability = input.requiredCapability ?? inferRequiredCapabilityV2(input.bindings);
  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  for (const binding of input.bindings) counts[binding.modality] += 1;
  const production = input.production ?? true;
  const allowedTrials = input.allowedTrialRefs ?? new Set<string>();
  const compatible: GenerationImplementationV2[] = [];
  const rejected: Array<{
    implementationRef: { id: string; version: string };
    reasonCodes: CapabilityRejectionCodeV2[];
  }> = [];

  for (const implementation of registry.document.implementations) {
    const reasons = new Set<CapabilityRejectionCodeV2>();
    if (
      production &&
      (implementation.testOnly || implementation.costPolicy.kind === "TEST_ZERO_CALL")
    )
      reasons.add("TEST_ONLY_IMPLEMENTATION");
    if (["DISCOVERED", "DEPRECATED", "DISABLED"].includes(implementation.lifecycle))
      reasons.add("IMPLEMENTATION_LIFECYCLE_NOT_SELECTABLE");
    if (implementation.lifecycle === "TRIAL" && !allowedTrials.has(refKey(implementation)))
      reasons.add("TRIAL_SCOPE_REQUIRED");
    if (!implementation.capabilityCodes.includes(requiredCapability))
      reasons.add("CAPABILITY_MISMATCH");
    if (!monetaryPolicyIsCurrent(implementation.costPolicy, input.now))
      reasons.add("MONETARY_PRICE_MISSING_OR_EXPIRED");
    const compiler = registry.compilersByRef.get(refKey(implementation.compilerRef));
    if (!compiler) reasons.add("CAPABILITY_MISMATCH");
    else {
      const modalities = compiler.inputContract.modalities;
      if (
        counts.IMAGE < modalities.image.min ||
        counts.IMAGE > modalities.image.max ||
        counts.VIDEO < modalities.video.min ||
        counts.VIDEO > modalities.video.max ||
        counts.AUDIO < modalities.audio.min ||
        counts.AUDIO > modalities.audio.max
      )
        reasons.add("INPUT_COUNT_MISMATCH");
      if (
        compiler.inputContract.crossFieldInvariants.includes("IMAGE_OR_VIDEO_REQUIRED") &&
        counts.IMAGE + counts.VIDEO === 0
      )
        reasons.add("INPUT_INVARIANT_FAILED");
      if (
        compiler.inputContract.crossFieldInvariants.includes("AUDIO_REQUIRES_IMAGE_OR_VIDEO") &&
        counts.AUDIO > 0 &&
        counts.IMAGE + counts.VIDEO === 0
      )
        reasons.add("INPUT_INVARIANT_FAILED");
    }
    if (reasons.size === 0) compatible.push(implementation);
    else
      rejected.push({
        implementationRef: { id: implementation.id, version: implementation.version },
        reasonCodes: [...reasons].sort(),
      });
  }
  return {
    requiredCapability,
    compatible: compatible.sort((left, right) => refKey(left).localeCompare(refKey(right))),
    rejected: rejected.sort((left, right) =>
      refKey(left.implementationRef).localeCompare(refKey(right.implementationRef)),
    ),
  };
}
