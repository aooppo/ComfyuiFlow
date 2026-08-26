import { describe, expect, it } from "vitest";
import {
  assertCurrentRepairProposal,
  planBlockedShotRepairs,
  validateDependencyGraph,
} from "@comfyuiflow/project-core";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const c = "00000000-0000-4000-8000-000000000003";
const dependency = (sourceShotKey: string, targetShotKey: string) => ({
  sourceShotKey,
  targetShotKey,
  type: "PREVIOUS_SHOT_FINAL_FRAME" as const,
  importance: "HARD" as const,
  requiredInputSlot: "first_frame",
});

describe("blocked Shot repair planner", () => {
  it("returns five stable actions and the exact transitive closure", () => {
    const graph = validateDependencyGraph({
      shotKeys: [a, b, c],
      dependencies: [dependency(a, b), dependency(b, c)],
    });
    const first = planBlockedShotRepairs({
      sourceStoryboardVersionId: "10000000-0000-4000-8000-000000000001",
      blockedShotKey: a,
      blockerCodes: ["COST_UNAVAILABLE", "ADAPTER_NOT_IMPLEMENTED"],
      graph,
      estimatedDirectorCostMicros: 2_000,
    });
    const second = planBlockedShotRepairs({
      sourceStoryboardVersionId: "10000000-0000-4000-8000-000000000001",
      blockedShotKey: a,
      blockerCodes: ["ADAPTER_NOT_IMPLEMENTED", "COST_UNAVAILABLE"],
      graph,
      estimatedDirectorCostMicros: 2_000,
    });
    expect(first).toEqual(second);
    expect(first.proposals.map((proposal) => proposal.action)).toEqual([
      "CHANGE_IMPLEMENTATION",
      "RELAX_REQUIREMENT",
      "REPLACE_ASSET",
      "REWRITE_SHOT",
      "SPLIT_SHOT",
    ]);
    expect(
      first.proposals.every(
        (proposal) => proposal.transitiveInvalidationShotKeys.join() === [b, c].join(),
      ),
    ).toBe(true);
    expect(
      first.proposals
        .filter((proposal) => proposal.requiresAiDirector)
        .map((proposal) => proposal.estimatedCalls),
    ).toEqual([1, 1]);
    expect(
      first.proposals
        .filter((proposal) => !proposal.requiresAiDirector)
        .every((proposal) => proposal.estimatedCalls === 0),
    ).toBe(true);
  });

  it("rejects a proposal when the impact closure changes", () => {
    const original = planBlockedShotRepairs({
      sourceStoryboardVersionId: "10000000-0000-4000-8000-000000000001",
      blockedShotKey: a,
      blockerCodes: ["COST_UNAVAILABLE"],
      graph: validateDependencyGraph({ shotKeys: [a, b], dependencies: [dependency(a, b)] }),
    });
    const changed = planBlockedShotRepairs({
      sourceStoryboardVersionId: "10000000-0000-4000-8000-000000000001",
      blockedShotKey: a,
      blockerCodes: ["COST_UNAVAILABLE"],
      graph: validateDependencyGraph({
        shotKeys: [a, b, c],
        dependencies: [dependency(a, b), dependency(b, c)],
      }),
    });
    expect(() =>
      assertCurrentRepairProposal(
        original.proposals[0]!.proposalHash,
        original.impactHash,
        changed,
      ),
    ).toThrow("REPAIR_PROPOSAL_STALE");
  });
});
