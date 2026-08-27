import { canonicalSha256 } from "./canonical-json.js";
import type {
  FrozenGenerationSpec,
  MaterializedGraphSnapshot,
} from "./generation-planning-service.js";

/** Immutable identity of the approved Test A SCENE source in the original checkout. The file is
 * copied only after reset, then its bytes must be rehashed to this exact value. */
export const LIVE_TEST_A_SCENE_SHA256 =
  "8edca81a57d2b1deaf2a79581557c8314baccf64c663485d627390272d5280a1";

export interface LiveTestAFacts {
  workerStopped: boolean;
  noActiveBatch: boolean;
  sourceSha256: string;
  mcpHealthy: boolean;
  runtimeHealthy: boolean;
  providerHealthy: boolean;
  aiQaHealthy: boolean;
  generationPriceMicros: number | null;
  aiQaPriceMicros: number | null;
  pricesExpireAt: string | null;
}

export interface LiveTestAPreview {
  shotOrdinal: 1;
  durationSeconds: 4;
  aspectRatio: "16:9";
  resolution: "2K";
  seed: 887034974;
  watermark: false;
  planDigest: string;
  graphSha256: string;
  sourceSha256: string;
  implementationRef: FrozenGenerationSpec["implementationRef"];
  runtimeRef: FrozenGenerationSpec["runtimeRef"];
  providerRef: FrozenGenerationSpec["providerRef"];
  modelRef: FrozenGenerationSpec["modelRef"];
  adapterRef: FrozenGenerationSpec["adapterRef"];
  compilerRef: FrozenGenerationSpec["compilerRef"];
  validatorRef: FrozenGenerationSpec["validatorRef"];
  runtimeContractDigest: string;
  generationCallLimit: 1;
  aiQaCallLimit: 1;
  generationMaximumCostMicros: number;
  aiQaMaximumCostMicros: number;
  pricesExpireAt: string;
  retryAllowed: false;
  fallbackAllowed: false;
  totalMaximumCostMicros: number;
  confirmationRequired: true;
}

export function createLiveTestAPreview(input: {
  facts: LiveTestAFacts;
  spec: FrozenGenerationSpec;
  graph: MaterializedGraphSnapshot;
  now?: Date;
}): LiveTestAPreview {
  const now = input.now ?? new Date();
  const missing = [
    !input.facts.workerStopped && "WORKER_RUNNING",
    !input.facts.noActiveBatch && "ACTIVE_BATCH_PRESENT",
    !/^[a-f0-9]{64}$/.test(input.facts.sourceSha256) && "SOURCE_HASH_INVALID",
    !input.facts.mcpHealthy && "MCP_UNHEALTHY",
    !input.facts.runtimeHealthy && "RUNTIME_UNHEALTHY",
    !input.facts.providerHealthy && "PROVIDER_UNHEALTHY",
    !input.facts.aiQaHealthy && "AI_QA_UNHEALTHY",
    input.facts.generationPriceMicros === null && "GENERATION_PRICE_MISSING",
    input.facts.aiQaPriceMicros === null && "AI_QA_PRICE_MISSING",
    (!input.facts.pricesExpireAt || Date.parse(input.facts.pricesExpireAt) <= now.getTime()) &&
      "PRICE_EXPIRED",
  ].filter(Boolean);
  if (missing.length) throw new Error(`LIVE_TEST_A_BLOCKED:${missing.join(",")}`);
  if (input.facts.sourceSha256 !== LIVE_TEST_A_SCENE_SHA256)
    throw new Error("LIVE_TEST_A_BLOCKED:SOURCE_HASH_MISMATCH");
  if (input.graph.generationSpecDigest !== canonicalSha256(input.spec))
    throw new Error("LIVE_TEST_A_BLOCKED:GENERATION_SPEC_DIGEST_MISMATCH");
  return Object.freeze({
    shotOrdinal: 1,
    durationSeconds: 4,
    aspectRatio: "16:9",
    resolution: "2K",
    seed: 887034974,
    watermark: false,
    planDigest: input.graph.generationSpecDigest,
    graphSha256: input.graph.graphSha256,
    sourceSha256: input.facts.sourceSha256,
    implementationRef: input.spec.implementationRef,
    runtimeRef: input.spec.runtimeRef,
    providerRef: input.spec.providerRef,
    modelRef: input.spec.modelRef,
    adapterRef: input.spec.adapterRef,
    compilerRef: input.spec.compilerRef,
    validatorRef: input.spec.validatorRef,
    runtimeContractDigest: input.spec.runtimeContractDigest,
    generationCallLimit: 1,
    aiQaCallLimit: 1,
    generationMaximumCostMicros: input.facts.generationPriceMicros!,
    aiQaMaximumCostMicros: input.facts.aiQaPriceMicros!,
    pricesExpireAt: input.facts.pricesExpireAt!,
    retryAllowed: false,
    fallbackAllowed: false,
    totalMaximumCostMicros: input.facts.generationPriceMicros! + input.facts.aiQaPriceMicros!,
    confirmationRequired: true,
  });
}
