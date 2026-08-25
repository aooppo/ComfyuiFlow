import { describe, expect, it } from "vitest";
import { directorProfile } from "@comfyuiflow/project-core";

describe("Storyboard Director profiles", () => {
  it("keeps Fake available with zero cost and Terra LIVE disabled by default", () => {
    expect(directorProfile("fake-storyboard-v2", {})).toMatchObject({
      modelId: "fake-storyboard-v2",
      maxCostUsd: 0,
      external: false,
    });
    expect(() => directorProfile("openai-terra", {})).toThrow("DIRECTOR_LIVE_DISABLED");
  });
  it("fails closed for expired prices and returns exact Terra model for current facts", () => {
    const base = {
      PROJECT_STORYBOARD_DIRECTOR_LIVE_ENABLED: "true",
      STORYBOARD_DIRECTOR_OPENAI_BILLING_CHANNEL: "OpenAI API",
      STORYBOARD_DIRECTOR_OPENAI_MAX_COST_USD: "1",
      STORYBOARD_DIRECTOR_OPENAI_PRICE_EFFECTIVE_AT: "2026-08-01T00:00:00Z",
    };
    expect(() =>
      directorProfile(
        "openai-terra",
        { ...base, STORYBOARD_DIRECTOR_OPENAI_PRICE_EXPIRES_AT: "2026-08-20T00:00:00Z" },
        new Date("2026-08-25T00:00:00Z"),
      ),
    ).toThrow("DIRECTOR_PRICE_UNAVAILABLE");
    expect(
      directorProfile(
        "openai-terra",
        { ...base, STORYBOARD_DIRECTOR_OPENAI_PRICE_EXPIRES_AT: "2026-09-20T00:00:00Z" },
        new Date("2026-08-25T00:00:00Z"),
      ),
    ).toMatchObject({ providerId: "openai", modelId: "gpt-5.6-terra", maxCostUsd: 1 });
  });
});
