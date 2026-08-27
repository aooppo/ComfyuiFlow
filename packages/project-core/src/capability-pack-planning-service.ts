import type { ParsedCapabilityPack } from "./capability-pack.js";
import type { CapabilityRef, CapabilityRegistry } from "./capability-registry.js";
import { freezeGenerationSpec, materializeGraph } from "./generation-planning-service.js";
import type {
  FrozenGenerationSpec,
  MaterializedGraphSnapshot,
} from "./generation-planning-service.js";
import type {
  CompiledGraph,
  GraphCompilationContext,
  GraphIntentCompiler,
} from "./graph-intent.js";

export interface CapabilityPackPlanningResult {
  readonly generationSpec: FrozenGenerationSpec;
  readonly compiledGraph: CompiledGraph;
  readonly graphSnapshot: MaterializedGraphSnapshot;
  readonly executionAuthorization:
    "TRIAL_SCOPE_OWNER_AUTHORIZATION_REQUIRED" | "ACTION_TIME_OWNER_AUTHORIZATION_REQUIRED";
  readonly externalCalls: 0;
  readonly generationAuthorized: false;
}

/**
 * Server-side zero-call planning boundary. It creates the exact GenerationSpec
 * and graph identity that Feature 018 preflight consumes later, but deliberately
 * creates neither an authorization nor a GenerationAttempt.
 */
export function planCapabilityPackGraph(input: {
  registry: CapabilityRegistry;
  pack: ParsedCapabilityPack;
  implementationRef: CapabilityRef;
  intent: unknown;
  compiler: GraphIntentCompiler;
  compilationContext?: GraphCompilationContext;
}): CapabilityPackPlanningResult {
  const implementation = input.registry.resolveImplementation(input.implementationRef);
  const runtime = input.registry.resolveRuntime(implementation.runtimeRef);
  if (
    implementation.modelRef.id !== input.pack.model.id ||
    implementation.modelRef.version !== input.pack.model.version
  )
    throw new Error("CAPABILITY_PACK_MODEL_IMPLEMENTATION_MISMATCH");
  if (implementation.compilerRef.id !== `compiler.${input.pack.compilerProfile}`)
    throw new Error("CAPABILITY_PACK_COMPILER_IMPLEMENTATION_MISMATCH");
  if (!sameValues(runtime.nodeClasses, input.pack.requiredNodes))
    throw new Error("CAPABILITY_PACK_RUNTIME_CONTRACT_MISMATCH");

  const compiledGraph = input.compiler.compile(input.pack, input.intent, input.compilationContext);
  const generationSpec = freezeGenerationSpec(input.registry, input.implementationRef, {
    capabilityPackManifestSha256: input.pack.manifestSha256,
    graphIntentDigest: compiledGraph.intentDigest,
  });
  const graphSnapshot = materializeGraph(generationSpec, compiledGraph.graph);
  return Object.freeze({
    generationSpec,
    compiledGraph,
    graphSnapshot,
    executionAuthorization:
      implementation.lifecycle === "TRIAL"
        ? "TRIAL_SCOPE_OWNER_AUTHORIZATION_REQUIRED"
        : "ACTION_TIME_OWNER_AUTHORIZATION_REQUIRED",
    externalCalls: 0,
    generationAuthorized: false,
  });
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
