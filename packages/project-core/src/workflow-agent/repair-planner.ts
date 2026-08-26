import { StoryboardRepairProposalSchema, type RepairProposal } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";
import { affectedShotClosure, type ValidatedDependencyGraph } from "./dependency-graph.js";

const actionOrder = [
  "CHANGE_IMPLEMENTATION",
  "RELAX_REQUIREMENT",
  "REPLACE_ASSET",
  "REWRITE_SHOT",
  "SPLIT_SHOT",
] as const;

const actionCopy: Record<
  (typeof actionOrder)[number],
  { reason: string; creativeImpact: string; requiresAiDirector: boolean }
> = {
  CHANGE_IMPLEMENTATION: {
    reason: "Choose another compatible registered implementation.",
    creativeImpact: "No creative Shot facts change.",
    requiresAiDirector: false,
  },
  RELAX_REQUIREMENT: {
    reason: "Relax one explicitly accepted non-essential requirement.",
    creativeImpact: "The accepted requirement is weakened and remains auditable.",
    requiresAiDirector: false,
  },
  REPLACE_ASSET: {
    reason: "Replace the missing or incompatible approved reference.",
    creativeImpact: "The Shot stays unchanged; one bound asset changes after approval.",
    requiresAiDirector: false,
  },
  REWRITE_SHOT: {
    reason: "Ask the AI Director for one bounded replacement Shot.",
    creativeImpact: "The blocked Shot may change while neighboring state remains constrained.",
    requiresAiDirector: true,
  },
  SPLIT_SHOT: {
    reason: "Ask the AI Director to split the blocked action into contiguous Shots.",
    creativeImpact: "One Shot becomes two or more contiguous Shots within the same story state.",
    requiresAiDirector: true,
  },
};

export function planBlockedShotRepairs(input: {
  sourceStoryboardVersionId: string;
  blockedShotKey: string;
  blockerCodes: readonly string[];
  graph: ValidatedDependencyGraph;
  estimatedDirectorCostMicros?: number | null;
}) {
  const closure = affectedShotClosure(input.graph, [input.blockedShotKey]);
  const transitiveInvalidationShotKeys = closure.filter(
    (shotKey) => shotKey !== input.blockedShotKey,
  );
  const blockerCodes = [...new Set(input.blockerCodes)].sort();
  const impactCore = {
    schemaVersion: "repair-impact-v1",
    sourceStoryboardVersionId: input.sourceStoryboardVersionId,
    blockedShotKey: input.blockedShotKey,
    blockerCodes,
    affectedShotKeys: [input.blockedShotKey],
    transitiveInvalidationShotKeys,
  };
  const impactHash = canonicalSha256(impactCore);
  const proposals = actionOrder.map((action): RepairProposal => {
    const copy = actionCopy[action];
    const core = {
      schemaVersion: "repair-proposal-v1" as const,
      action,
      blockerCode: blockerCodes[0] ?? "UNSUPPORTED_REQUIREMENTS",
      reason: copy.reason,
      affectedShotKeys: [input.blockedShotKey],
      transitiveInvalidationShotKeys,
      creativeImpact: copy.creativeImpact,
      estimatedNewCapabilities: [],
      estimatedCalls: copy.requiresAiDirector ? 1 : 0,
      estimatedCostMicros: copy.requiresAiDirector
        ? (input.estimatedDirectorCostMicros ?? null)
        : 0,
      requiresAiDirector: copy.requiresAiDirector,
    };
    return { ...core, proposalHash: canonicalSha256({ ...core, impactHash }) };
  });
  return StoryboardRepairProposalSchema.parse({
    schemaVersion: "storyboard-repair-proposal-v1",
    sourceStoryboardVersionId: input.sourceStoryboardVersionId,
    blockedShotKey: input.blockedShotKey,
    proposals,
    impactHash,
  });
}

export function assertCurrentRepairProposal(
  expectedProposalHash: string,
  expectedImpactHash: string,
  current: ReturnType<typeof planBlockedShotRepairs>,
) {
  if (
    current.impactHash !== expectedImpactHash ||
    !current.proposals.some((proposal) => proposal.proposalHash === expectedProposalHash)
  )
    throw new Error("REPAIR_PROPOSAL_STALE");
}
