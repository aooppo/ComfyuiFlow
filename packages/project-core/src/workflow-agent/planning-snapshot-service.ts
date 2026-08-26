import {
  PlanningInputSnapshotV3Schema,
  type PlanningInputBindingV3Schema,
  type VersionRefV2,
} from "@comfyuiflow/contracts";
import type { z } from "zod";
import { canonicalSha256 } from "../canonical-json.js";

type PlanningInputBinding = Omit<z.infer<typeof PlanningInputBindingV3Schema>, "order">;

const modalityRank = { IMAGE: 0, VIDEO: 1, AUDIO: 2 } as const;

export function createPlanningInputSnapshotV3(input: {
  snapshotId: string;
  version: string;
  requirementSpecRef: VersionRefV2;
  implementationRef: VersionRefV2;
  compilerRef: VersionRefV2;
  bindings: PlanningInputBinding[];
  omittedRequirementCodes: string[];
  unresolvedRequirementCodes: string[];
}) {
  const counters = new Map<PlanningInputBinding["modality"], number>();
  const bindings = [...input.bindings]
    .sort((left, right) => {
      const modality = modalityRank[left.modality] - modalityRank[right.modality];
      if (modality !== 0) return modality;
      const necessity =
        Number(left.necessity === "OPTIONAL") - Number(right.necessity === "OPTIONAL");
      if (necessity !== 0) return necessity;
      const leftKey = `${left.sourceRef.id}@${left.sourceRef.version}:${left.sha256}:${left.id}`;
      const rightKey = `${right.sourceRef.id}@${right.sourceRef.version}:${right.sha256}:${right.id}`;
      return leftKey.localeCompare(rightKey);
    })
    .map((binding) => {
      const order = counters.get(binding.modality) ?? 0;
      counters.set(binding.modality, order + 1);
      return { ...binding, order };
    });
  const omittedRequirementCodes = [...new Set(input.omittedRequirementCodes)].sort();
  const unresolvedRequirementCodes = [...new Set(input.unresolvedRequirementCodes)].sort();
  const sourceDigest = canonicalSha256(
    bindings.map((binding) => ({
      sourceKind: binding.sourceKind,
      sourceRef: binding.sourceRef,
      sha256: binding.sha256,
      modality: binding.modality,
      order: binding.order,
    })),
  );
  const capabilityDigest = canonicalSha256({
    implementationRef: input.implementationRef,
    compilerRef: input.compilerRef,
  });
  const withoutHash = {
    id: input.snapshotId,
    version: input.version,
    requirementSpecRef: input.requirementSpecRef,
    implementationRef: input.implementationRef,
    compilerRef: input.compilerRef,
    bindings,
    omittedRequirementCodes,
    unresolvedRequirementCodes,
    sourceDigest,
    capabilityDigest,
  };
  return PlanningInputSnapshotV3Schema.parse({
    ...withoutHash,
    snapshotHash: canonicalSha256(withoutHash),
  });
}
