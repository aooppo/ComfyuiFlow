import { ShotDependencyGraphSchema, type ShotRequirementSpecV2 } from "@comfyuiflow/contracts";

type ShotDependency = ShotRequirementSpecV2["dependencies"][number];

export class DependencyGraphError extends Error {
  constructor(
    readonly code: "DEPENDENCY_SHOT_NOT_FOUND" | "DEPENDENCY_DUPLICATE_SHOT" | "DEPENDENCY_CYCLE",
    message: string,
  ) {
    super(message);
    this.name = "DependencyGraphError";
  }
}

export interface ValidatedDependencyGraph {
  shotKeys: readonly string[];
  dependencies: readonly ShotDependency[];
  topologicalShotKeys: readonly string[];
  upstreamByShot: ReadonlyMap<string, readonly string[]>;
  downstreamByShot: ReadonlyMap<string, readonly string[]>;
}

export function validateDependencyGraph(rawGraph: unknown): ValidatedDependencyGraph {
  const graph = ShotDependencyGraphSchema.parse(rawGraph);
  if (new Set(graph.shotKeys).size !== graph.shotKeys.length) {
    throw new DependencyGraphError("DEPENDENCY_DUPLICATE_SHOT", "Shot keys must be unique");
  }
  const known = new Set(graph.shotKeys);
  const upstream = new Map(graph.shotKeys.map((key) => [key, new Set<string>()]));
  const downstream = new Map(graph.shotKeys.map((key) => [key, new Set<string>()]));
  for (const dependency of graph.dependencies) {
    if (!known.has(dependency.sourceShotKey) || !known.has(dependency.targetShotKey)) {
      throw new DependencyGraphError(
        "DEPENDENCY_SHOT_NOT_FOUND",
        "Dependency references an unknown Shot",
      );
    }
    upstream.get(dependency.targetShotKey)?.add(dependency.sourceShotKey);
    downstream.get(dependency.sourceShotKey)?.add(dependency.targetShotKey);
  }

  const indegree = new Map([...upstream].map(([key, value]) => [key, value.size]));
  const ready = graph.shotKeys.filter((key) => indegree.get(key) === 0).sort();
  const ordered: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) break;
    ordered.push(current);
    for (const target of [...(downstream.get(current) ?? [])].sort()) {
      const remaining = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) {
        ready.push(target);
        ready.sort();
      }
    }
  }
  if (ordered.length !== graph.shotKeys.length) {
    throw new DependencyGraphError("DEPENDENCY_CYCLE", "Shot dependency graph contains a cycle");
  }

  const freezeMap = (source: Map<string, Set<string>>) =>
    new Map([...source].map(([key, value]) => [key, Object.freeze([...value].sort())]));
  return {
    shotKeys: Object.freeze([...graph.shotKeys]),
    dependencies: Object.freeze([...graph.dependencies]),
    topologicalShotKeys: Object.freeze(ordered),
    upstreamByShot: freezeMap(upstream),
    downstreamByShot: freezeMap(downstream),
  };
}

export function affectedShotClosure(
  graph: ValidatedDependencyGraph,
  changedShotKeys: Iterable<string>,
): string[] {
  const affected = new Set<string>();
  const queue = [...changedShotKeys].sort();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || affected.has(current)) continue;
    affected.add(current);
    for (const next of graph.downstreamByShot.get(current) ?? []) queue.push(next);
    queue.sort();
  }
  return graph.topologicalShotKeys.filter((key) => affected.has(key));
}

export function propagateWaitingShots(
  graph: ValidatedDependencyGraph,
  blockedShotKeys: ReadonlySet<string>,
): Set<string> {
  const affected = new Set(affectedShotClosure(graph, blockedShotKeys));
  for (const blocked of blockedShotKeys) affected.delete(blocked);
  return affected;
}
