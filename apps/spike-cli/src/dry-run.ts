import { createDryRun, type DryRunDependencies } from "@comfyuiflow/spike-core";

export async function buildDryRun(request: unknown, dependencies: DryRunDependencies) {
  return createDryRun(request, dependencies);
}
