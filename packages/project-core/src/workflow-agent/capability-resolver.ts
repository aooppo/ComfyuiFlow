import type {
  GenerationImplementation,
  GenerationRequirements,
  ShotRequirementSpecV2,
} from "@comfyuiflow/contracts";
import type { LoadedGenerationRegistry } from "./registry.js";
import type {
  SelectableImplementationCandidate,
  ShotCandidateSet,
  TechnicalEvidenceSummary,
} from "./implementation-selector.js";

export interface ImplementationRuntimeFacts {
  lifecycleStatus?: "DISCOVERED" | "TRIAL" | "READY" | "BLOCKED" | "RETIRED";
  providerConfigured?: boolean;
  readinessPassed?: boolean;
  adapterImplemented?: boolean;
  evidence?: TechnicalEvidenceSummary;
  latencyMs?: number | null;
}

export interface CandidateRejection {
  implementationId: string;
  version: string;
  blockerCodes: string[];
}

export interface CapabilityResolution {
  candidateSet: ShotCandidateSet;
  rejected: CandidateRejection[];
  blockerCodes: string[];
}

function identity(implementation: GenerationImplementation): string {
  return `${implementation.implementationId}@${implementation.version}`;
}

export function resolveImplementationCandidates(input: {
  spec: ShotRequirementSpecV2;
  requirements: GenerationRequirements;
  registry: LoadedGenerationRegistry;
  runtimeFacts?: ReadonlyMap<string, ImplementationRuntimeFacts>;
  now?: Date;
}): CapabilityResolution {
  const now = input.now ?? new Date();
  const candidates: SelectableImplementationCandidate[] = [];
  const rejected: CandidateRejection[] = [];
  const modelFamilyByProfile = new Map(
    input.registry.document.models.map((model) => [model.modelProfileId, model.modelFamily]),
  );

  for (const implementation of input.registry.document.implementations) {
    const facts = input.runtimeFacts?.get(identity(implementation)) ?? {};
    const lifecycle = facts.lifecycleStatus ?? implementation.defaultStatus;
    const blockers = new Set<string>();
    const capabilities = new Set(implementation.capabilities);
    const slots = new Set(implementation.referenceSlots.map((slot) => slot.toLowerCase()));

    const importanceWeight = { HARD: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
    let requirementScore = 0;
    for (const requirement of input.requirements.requiredCapabilities) {
      if (capabilities.has(requirement.capability))
        requirementScore += importanceWeight[requirement.importance];
      else if (requirement.importance === "HARD") blockers.add("REQUIRED_CAPABILITY_UNAVAILABLE");
    }
    for (const requirement of input.requirements.optionalCapabilities)
      if (capabilities.has(requirement.capability))
        requirementScore += importanceWeight[requirement.importance];
    for (const slot of input.requirements.requiredInputSlots) {
      if (!slots.has(slot.toLowerCase())) blockers.add("REQUIRED_INPUT_SLOT_UNAVAILABLE");
    }
    if (
      input.spec.durationSeconds < implementation.constraints.durationSeconds.min ||
      input.spec.durationSeconds > implementation.constraints.durationSeconds.max
    )
      blockers.add("DURATION_UNSUPPORTED");
    if (!implementation.constraints.aspectRatios.includes(input.spec.aspectRatio))
      blockers.add("ASPECT_RATIO_UNSUPPORTED");
    if (
      input.spec.modelSelection.mode === "LOCKED" &&
      (implementation.providerId !== input.spec.modelSelection.providerId ||
        implementation.modelProfileId !== input.spec.modelSelection.modelProfileId)
    )
      blockers.add("LOCKED_MODEL_INCOMPATIBLE");
    if (!implementation.selectable) blockers.add(implementation.availabilityCode);
    if (lifecycle === "DISCOVERED") blockers.add("REAL_TECHNICAL_EVIDENCE_REQUIRED");
    if (lifecycle === "BLOCKED" || lifecycle === "RETIRED")
      blockers.add(implementation.availabilityCode);
    if (facts.providerConfigured === false) blockers.add("PROVIDER_NOT_CONFIGURED");
    if (facts.readinessPassed === false) blockers.add("PROVIDER_NOT_READY");
    if (facts.adapterImplemented === false) blockers.add("ADAPTER_NOT_IMPLEMENTED");
    const pricing = implementation.pricing;
    if (
      !pricing ||
      Date.parse(pricing.effectiveAt) > now.getTime() ||
      Date.parse(pricing.expiresAt) <= now.getTime()
    )
      blockers.add("COST_UNAVAILABLE");

    const blockerCodes = [...blockers].sort();
    if (blockerCodes.length === 0 && (lifecycle === "READY" || lifecycle === "TRIAL")) {
      candidates.push({
        implementation,
        lifecycleStatus: lifecycle,
        ...(facts.evidence ? { evidence: facts.evidence } : {}),
        ...(facts.latencyMs !== undefined ? { latencyMs: facts.latencyMs } : {}),
        requirementScore,
      });
    } else {
      rejected.push({
        implementationId: implementation.implementationId,
        version: implementation.version,
        blockerCodes,
      });
    }
  }

  candidates.sort((left, right) =>
    identity(left.implementation).localeCompare(identity(right.implementation)),
  );
  rejected.sort((left, right) =>
    `${left.implementationId}@${left.version}`.localeCompare(
      `${right.implementationId}@${right.version}`,
    ),
  );
  const directBlockers = input.requirements.blockers;
  const blockerCodes =
    candidates.length === 0
      ? [...new Set([...directBlockers, ...rejected.flatMap((item) => item.blockerCodes)])].sort()
      : [...directBlockers].sort();
  return {
    candidateSet: {
      shotKey: input.spec.shotKey,
      ordinal: input.spec.ordinal,
      selection: input.spec.modelSelection,
      candidates: directBlockers.length === 0 ? candidates : [],
      modelFamilyByProfile,
    },
    rejected,
    blockerCodes,
  };
}
