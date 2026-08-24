export interface AnalysisConfig {
  liveEnabled: boolean;
  maxImageBytes: number;
  maxBatchBytes: number;
  manifestTtlMs: number;
  leaseMs: number;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function analysisConfig(): AnalysisConfig {
  return {
    liveEnabled: process.env.ASSET_UNDERSTANDING_LIVE_ENABLED === "true",
    maxImageBytes: positiveInteger(
      process.env.ASSET_UNDERSTANDING_MAX_IMAGE_BYTES,
      10 * 1024 * 1024,
    ),
    maxBatchBytes: positiveInteger(
      process.env.ASSET_UNDERSTANDING_MAX_BATCH_BYTES,
      40 * 1024 * 1024,
    ),
    manifestTtlMs: positiveInteger(process.env.ASSET_UNDERSTANDING_MANIFEST_TTL_MS, 5 * 60 * 1_000),
    leaseMs: positiveInteger(process.env.ASSET_UNDERSTANDING_LEASE_MS, 60 * 1_000),
  };
}
