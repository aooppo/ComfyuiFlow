import type { GenerationImplementation, ShotRequirementSpecV2 } from "@comfyuiflow/contracts";

type ModelSelection = ShotRequirementSpecV2["modelSelection"];

export interface TechnicalEvidenceSummary {
  passes: number;
  attempts: number;
}

export interface SelectableImplementationCandidate {
  implementation: GenerationImplementation;
  lifecycleStatus: "TRIAL" | "READY";
  evidence?: TechnicalEvidenceSummary;
  latencyMs?: number | null;
  requirementScore?: number;
}

export interface ShotCandidateSet {
  shotKey: string;
  ordinal: number;
  selection: ModelSelection;
  candidates: SelectableImplementationCandidate[];
  modelFamilyByProfile?: ReadonlyMap<string, string>;
}

export interface SelectionReason {
  preferenceRank: number;
  preferenceSatisfied: boolean;
  fallbackReason: string | null;
  requirementScore: number;
  lifecycleScore: number;
  evidenceWilsonLowerBound: number;
  switchPenalty: number;
  estimatedCostMicros: number | null;
  latencyMs: number | null;
  stableTieBreaker: string;
}

export interface SelectedShotImplementation extends SelectableImplementationCandidate {
  shotKey: string;
  ordinal: number;
  selectionReason: SelectionReason;
}

interface State {
  total: number;
  pathKey: string;
  choices: SelectedShotImplementation[];
}

export function wilsonLowerBound(passes: number, attempts: number): number {
  if (
    !Number.isInteger(passes) ||
    !Number.isInteger(attempts) ||
    passes < 0 ||
    attempts <= 0 ||
    passes > attempts
  )
    return 0;
  const z = 1.959963984540054;
  const probability = passes / attempts;
  const denominator = 1 + (z * z) / attempts;
  const centre = probability + (z * z) / (2 * attempts);
  const margin =
    z * Math.sqrt((probability * (1 - probability) + (z * z) / (4 * attempts)) / attempts);
  return (centre - margin) / denominator;
}

function preferenceRank(
  shot: ShotCandidateSet,
  candidate: SelectableImplementationCandidate,
): number {
  if (shot.selection.mode !== "PREFERRED") return 0;
  const family = shot.modelFamilyByProfile?.get(candidate.implementation.modelProfileId);
  const index = family ? shot.selection.preferredModelFamilies.indexOf(family) : -1;
  return index < 0 ? 0 : shot.selection.preferredModelFamilies.length - index;
}

function candidatesFor(shot: ShotCandidateSet): SelectableImplementationCandidate[] {
  const selection = shot.selection;
  const filtered =
    selection.mode === "LOCKED"
      ? shot.candidates.filter(
          ({ implementation }) =>
            implementation.providerId === selection.providerId &&
            implementation.modelProfileId === selection.modelProfileId,
        )
      : shot.candidates;
  if (filtered.length === 0)
    throw new Error(
      shot.selection.mode === "LOCKED"
        ? "LOCKED_MODEL_INCOMPATIBLE"
        : `NO_COMPATIBLE_IMPLEMENTATION:${shot.shotKey}`,
    );
  return [...filtered].sort((left, right) => {
    const preference = preferenceRank(shot, right) - preferenceRank(shot, left);
    if (preference !== 0) return preference;
    return `${left.implementation.implementationId}@${left.implementation.version}`.localeCompare(
      `${right.implementation.implementationId}@${right.implementation.version}`,
    );
  });
}

function candidateScore(
  shot: ShotCandidateSet,
  candidate: SelectableImplementationCandidate,
): number {
  const lifecycle = candidate.lifecycleStatus === "READY" ? 1_000 : 500;
  const evidence =
    wilsonLowerBound(candidate.evidence?.passes ?? 0, candidate.evidence?.attempts ?? 0) * 100;
  const preference = preferenceRank(shot, candidate) * 10_000;
  const cost = candidate.implementation.pricing?.estimatedCostMicros ?? Number.MAX_SAFE_INTEGER;
  const costTie = Number.isSafeInteger(cost) ? -Math.min(cost, 1_000_000_000) / 1_000_000_000 : -1;
  const latencyTie =
    candidate.latencyMs === null || candidate.latencyMs === undefined
      ? -1
      : -Math.min(candidate.latencyMs, 1_000_000) / 1_000_000_000_000;
  return (
    lifecycle +
    evidence +
    preference +
    (candidate.requirementScore ?? 0) * 10 +
    costTie +
    latencyTie
  );
}

function switchPenalty(
  previous: GenerationImplementation | undefined,
  current: GenerationImplementation,
): number {
  if (!previous) return 0;
  return (
    (previous.providerId === current.providerId ? 0 : 30) +
    (previous.modelProfileId === current.modelProfileId ? 0 : 15) +
    (previous.implementationId === current.implementationId && previous.version === current.version
      ? 0
      : 5)
  );
}

export function selectStoryboardImplementations(
  shots: readonly ShotCandidateSet[],
): SelectedShotImplementation[] {
  let states: State[] = [{ total: 0, pathKey: "", choices: [] }];
  for (const shot of shots) {
    const next: State[] = [];
    for (const previousState of states) {
      const previous = previousState.choices.at(-1)?.implementation;
      for (const candidate of candidatesFor(shot)) {
        const penalty = switchPenalty(previous, candidate.implementation);
        const identity = `${candidate.implementation.implementationId}@${candidate.implementation.version}`;
        const evidenceWilsonLowerBound = wilsonLowerBound(
          candidate.evidence?.passes ?? 0,
          candidate.evidence?.attempts ?? 0,
        );
        next.push({
          total: previousState.total + candidateScore(shot, candidate) - penalty,
          pathKey: previousState.pathKey ? `${previousState.pathKey}|${identity}` : identity,
          choices: [
            ...previousState.choices,
            {
              ...candidate,
              shotKey: shot.shotKey,
              ordinal: shot.ordinal,
              selectionReason: {
                preferenceRank: preferenceRank(shot, candidate),
                preferenceSatisfied:
                  shot.selection.mode !== "PREFERRED" || preferenceRank(shot, candidate) > 0,
                fallbackReason:
                  shot.selection.mode === "PREFERRED" && preferenceRank(shot, candidate) === 0
                    ? "PREFERRED_MODEL_FAMILY_UNAVAILABLE"
                    : null,
                requirementScore: candidate.requirementScore ?? 0,
                lifecycleScore: candidate.lifecycleStatus === "READY" ? 1_000 : 500,
                evidenceWilsonLowerBound,
                switchPenalty: penalty,
                estimatedCostMicros: candidate.implementation.pricing?.estimatedCostMicros ?? null,
                latencyMs: candidate.latencyMs ?? null,
                stableTieBreaker: identity,
              },
            },
          ],
        });
      }
    }
    const bestByLast = new Map<string, State>();
    for (const state of next) {
      const last = state.choices.at(-1);
      if (!last) continue;
      const key = `${last.implementation.implementationId}@${last.implementation.version}`;
      const current = bestByLast.get(key);
      if (
        !current ||
        state.total > current.total ||
        (state.total === current.total && state.pathKey < current.pathKey)
      )
        bestByLast.set(key, state);
    }
    states = [...bestByLast.values()];
  }
  return (
    [...states].sort(
      (left, right) => right.total - left.total || left.pathKey.localeCompare(right.pathKey),
    )[0]?.choices ?? []
  );
}
