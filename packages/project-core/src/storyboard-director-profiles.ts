import { canonicalSha256 } from "./canonical-json.js";
import type { z } from "zod";
import type { directorProfileIdSchema } from "./storyboard-director-contracts.js";

export type DirectorProfileId = z.infer<typeof directorProfileIdSchema>;

export interface DirectorProfile {
  id: DirectorProfileId;
  providerId: "fake" | "codexmanager-local" | "openai";
  modelId: string;
  external: boolean;
  billingChannel: string;
  maxCostUsd: number;
  priceEffectiveAt: Date;
  priceExpiresAt: Date;
  priceSnapshotHash: string;
}

export function directorProfile(
  profileId: DirectorProfileId,
  environment = process.env,
  now = new Date(),
): DirectorProfile {
  if (profileId === "fake-storyboard-v2") {
    return finalize({
      id: profileId,
      providerId: "fake",
      modelId: "fake-storyboard-v2",
      external: false,
      billingChannel: "ZERO_CALL_FAKE",
      maxCostUsd: 0,
      priceEffectiveAt: new Date("2026-08-25T00:00:00.000Z"),
      priceExpiresAt: new Date("2099-12-31T23:59:59.000Z"),
    });
  }
  if (environment.PROJECT_STORYBOARD_DIRECTOR_LIVE_ENABLED !== "true") {
    throw new Error("DIRECTOR_LIVE_DISABLED");
  }
  const prefix = profileId === "codexmanager-terra" ? "CODEXMANAGER" : "OPENAI";
  const billingChannel = environment[`STORYBOARD_DIRECTOR_${prefix}_BILLING_CHANNEL`];
  const maxCostUsd = Number(environment[`STORYBOARD_DIRECTOR_${prefix}_MAX_COST_USD`]);
  const effective = new Date(environment[`STORYBOARD_DIRECTOR_${prefix}_PRICE_EFFECTIVE_AT`] ?? "");
  const expires = new Date(environment[`STORYBOARD_DIRECTOR_${prefix}_PRICE_EXPIRES_AT`] ?? "");
  if (
    !billingChannel ||
    !Number.isFinite(maxCostUsd) ||
    maxCostUsd <= 0 ||
    Number.isNaN(effective.valueOf()) ||
    Number.isNaN(expires.valueOf()) ||
    expires <= now
  ) {
    throw new Error("DIRECTOR_PRICE_UNAVAILABLE");
  }
  return finalize({
    id: profileId,
    providerId: profileId === "codexmanager-terra" ? "codexmanager-local" : "openai",
    modelId: "gpt-5.6-terra",
    external: true,
    billingChannel,
    maxCostUsd,
    priceEffectiveAt: effective,
    priceExpiresAt: expires,
  });
}

function finalize(value: Omit<DirectorProfile, "priceSnapshotHash">): DirectorProfile {
  return {
    ...value,
    priceSnapshotHash: canonicalSha256({
      billingChannel: value.billingChannel,
      maxCostUsd: value.maxCostUsd,
      priceEffectiveAt: value.priceEffectiveAt.toISOString(),
      priceExpiresAt: value.priceExpiresAt.toISOString(),
      modelId: value.modelId,
      providerId: value.providerId,
    }),
  };
}
