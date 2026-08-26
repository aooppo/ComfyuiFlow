import type { SelectableImplementationCandidate } from "./implementation-selector.js";

export interface CompilationReadinessFacts {
  catalogReady: boolean;
  staticValidationPassed: boolean;
  preprocessingReady: boolean;
}

export interface PatternResolution {
  outcome: "READY" | "FIRST_REAL_TRIAL" | "BLOCKED";
  sourceType: "REFERENCE_WORKFLOW" | "PATTERN" | "DIRECT_REQUEST" | null;
  sourceId: string | null;
  blockerCodes: string[];
}

export function resolveExecutionPattern(
  candidate: SelectableImplementationCandidate,
  facts: CompilationReadinessFacts,
): PatternResolution {
  const implementation = candidate.implementation;
  const blockers = new Set<string>();
  let sourceType: PatternResolution["sourceType"] = null;
  let sourceId: string | null = null;

  if (implementation.executorType === "DIRECT_PROVIDER_API") {
    sourceType = "DIRECT_REQUEST";
    sourceId = implementation.adapterId;
  } else if (implementation.referenceWorkflowIds.length > 0) {
    sourceType = "REFERENCE_WORKFLOW";
    sourceId = [...implementation.referenceWorkflowIds].sort()[0] ?? null;
  } else if (implementation.patternIds.length > 0) {
    sourceType = "PATTERN";
    sourceId = [...implementation.patternIds].sort()[0] ?? null;
  } else {
    blockers.add("STATIC_GRAPH_INVALID");
  }

  if (!facts.catalogReady && implementation.executorType === "COMFYUI_GRAPH")
    blockers.add("CATALOG_STALE");
  if (!facts.staticValidationPassed) blockers.add("STATIC_GRAPH_INVALID");
  if (!facts.preprocessingReady) blockers.add("PREPROCESSING_NOT_READY");
  if (candidate.lifecycleStatus === "TRIAL" && sourceType !== "PATTERN")
    blockers.add("TRIAL_PATTERN_REQUIRED");

  const blockerCodes = [...blockers].sort();
  return {
    outcome:
      blockerCodes.length > 0
        ? "BLOCKED"
        : candidate.lifecycleStatus === "TRIAL"
          ? "FIRST_REAL_TRIAL"
          : "READY",
    sourceType,
    sourceId,
    blockerCodes,
  };
}
