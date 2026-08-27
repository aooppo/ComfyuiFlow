import { canonicalSha256 } from "./canonical-json.js";
import type { CapabilityRef, CapabilityRegistry } from "./capability-registry.js";

export interface FrozenGenerationSpec {
  implementationRef: CapabilityRef;
  runtimeRef: CapabilityRef;
  providerRef: CapabilityRef;
  modelRef: CapabilityRef;
  adapterRef: CapabilityRef;
  compilerRef: CapabilityRef;
  validatorRef: CapabilityRef;
  runtimeContractDigest: string;
  planningInputDigest: string;
}

export interface MaterializedGraphSnapshot {
  schemaVersion: 1;
  generationSpecDigest: string;
  graph: Readonly<Record<string, unknown>>;
  graphSha256: string;
}

export function freezeGenerationSpec(
  registry: CapabilityRegistry,
  implementationRef: CapabilityRef,
  planningInput: unknown,
): FrozenGenerationSpec {
  const implementation = registry.resolveImplementation(implementationRef);
  const runtime = registry.resolveRuntime(implementation.runtimeRef);
  return Object.freeze({
    implementationRef: implementation.ref,
    runtimeRef: implementation.runtimeRef,
    providerRef: implementation.providerRef,
    modelRef: implementation.modelRef,
    adapterRef: implementation.adapterRef,
    compilerRef: implementation.compilerRef,
    validatorRef: implementation.validatorRef,
    runtimeContractDigest: runtime.digest,
    planningInputDigest: canonicalSha256(planningInput),
  });
}

export function materializeGraph(
  spec: FrozenGenerationSpec,
  graph: Readonly<Record<string, unknown>>,
): MaterializedGraphSnapshot {
  const generationSpecDigest = canonicalSha256(spec);
  return Object.freeze({
    schemaVersion: 1,
    generationSpecDigest,
    graph,
    graphSha256: canonicalSha256(graph),
  });
}
