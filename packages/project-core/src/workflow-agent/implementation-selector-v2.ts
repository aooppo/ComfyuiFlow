import type { GenerationImplementationV2 } from "@comfyuiflow/contracts";

export function selectCapabilityImplementationV2(
  candidates: GenerationImplementationV2[],
  options: { preferredCostKind?: "MONETARY" | "LOCAL_COMPUTE" } = {},
) {
  return (
    [...candidates].sort((left, right) => {
      const lifecycle = Number(right.lifecycle === "READY") - Number(left.lifecycle === "READY");
      if (lifecycle !== 0) return lifecycle;
      if (options.preferredCostKind) {
        const cost =
          Number(right.costPolicy.kind === options.preferredCostKind) -
          Number(left.costPolicy.kind === options.preferredCostKind);
        if (cost !== 0) return cost;
      }
      return `${left.id}@${left.version}`.localeCompare(`${right.id}@${right.version}`);
    })[0] ?? null
  );
}
