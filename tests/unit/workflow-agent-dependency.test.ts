import { describe, expect, it } from "vitest";
import {
  DependencyGraphError,
  affectedShotClosure,
  propagateWaitingShots,
  validateDependencyGraph,
} from "../../packages/project-core/src/workflow-agent/dependency-graph.js";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const c = "00000000-0000-4000-8000-000000000003";
const edge = (sourceShotKey: string, targetShotKey: string) => ({
  sourceShotKey,
  targetShotKey,
  type: "PREVIOUS_SHOT_FINAL_FRAME" as const,
  importance: "HARD" as const,
  requiredInputSlot: "first_frame",
});

describe("Workflow Agent dependency graph", () => {
  it("uses stable shot order for topology and exact downstream closure", () => {
    const graph = validateDependencyGraph({
      shotKeys: [c, a, b],
      dependencies: [edge(a, c), edge(b, c)],
    });
    expect(graph.topologicalShotKeys).toEqual([a, b, c]);
    expect(affectedShotClosure(graph, [a])).toEqual([a, c]);
    expect(propagateWaitingShots(graph, new Set([a]))).toEqual(new Set([c]));
  });

  it("rejects missing shots and cycles with stable codes", () => {
    expect(() =>
      validateDependencyGraph({ shotKeys: [a, b], dependencies: [edge(a, c)] }),
    ).toThrowError(expect.objectContaining({ code: "DEPENDENCY_SHOT_NOT_FOUND" }));
    expect(() =>
      validateDependencyGraph({ shotKeys: [a, b], dependencies: [edge(a, b), edge(b, a)] }),
    ).toThrowError(DependencyGraphError);
    try {
      validateDependencyGraph({ shotKeys: [a, b], dependencies: [edge(a, b), edge(b, a)] });
    } catch (error) {
      expect((error as DependencyGraphError).code).toBe("DEPENDENCY_CYCLE");
    }
  });
});
