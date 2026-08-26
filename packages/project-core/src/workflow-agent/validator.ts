import {
  GenerationSpecV3Schema,
  type GenerationImplementation,
  type GenerationSpecV3,
} from "@comfyuiflow/contracts";
import type { GenerationAdapterRegistry } from "../generation-adapter.js";
import type { PatternResolution } from "./pattern-resolver.js";

export interface PlanningValidationResult {
  planningOutcome: "READY" | "TRIAL" | "BLOCKED";
  blockerCodes: string[];
}

export function validatePlanningCandidate(input: {
  implementation: GenerationImplementation;
  pattern: PatternResolution;
  adapterRegistry: GenerationAdapterRegistry;
  now?: Date;
}): PlanningValidationResult {
  const blockers = new Set(input.pattern.blockerCodes);
  try {
    const adapter = input.adapterRegistry.resolveIdentity(
      input.implementation.adapterId,
      input.implementation.adapterVersion,
    );
    if (adapter.executorType !== input.implementation.executorType)
      blockers.add("ADAPTER_EXECUTOR_MISMATCH");
  } catch {
    blockers.add("ADAPTER_NOT_IMPLEMENTED");
  }
  const pricing = input.implementation.pricing;
  const now = (input.now ?? new Date()).getTime();
  if (!pricing || Date.parse(pricing.effectiveAt) > now || Date.parse(pricing.expiresAt) <= now)
    blockers.add("COST_UNAVAILABLE");
  if (input.implementation.executorType === "COMFYUI_GRAPH" && !input.pattern.sourceId)
    blockers.add("STATIC_GRAPH_INVALID");
  const blockerCodes = [...blockers].sort();
  return {
    planningOutcome:
      blockerCodes.length > 0
        ? "BLOCKED"
        : input.pattern.outcome === "FIRST_REAL_TRIAL"
          ? "TRIAL"
          : "READY",
    blockerCodes,
  };
}

/** Validates the immutable Shot Planner handoff; approval rows are intentionally not inputs. */
export function validateGenerationSpecV3Handoff(raw: unknown): GenerationSpecV3 {
  const spec = GenerationSpecV3Schema.parse(raw);
  const references = [
    spec.storyboardRevisionRef,
    spec.requirementSpecRef,
    spec.planningInputSnapshotRef,
    spec.implementationRef,
    spec.runtimeRef,
    spec.providerRef,
    spec.modelRef,
    spec.adapterRef,
    spec.compilerRef,
  ];
  if (references.some((reference) => !reference.id || !reference.version))
    throw new Error("GENERATION_SPEC_LINEAGE_INCOMPLETE");
  return spec;
}
