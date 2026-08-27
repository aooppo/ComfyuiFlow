import { describe, expect, it } from "vitest";
import { CapabilityV3QaService } from "@comfyuiflow/project-core";
import type { ProjectAssetError } from "@comfyuiflow/project-core";

describe("CapabilityV3QaService", () => {
  it("does not read lineage, consume authority, or call the provider when QA health is unavailable", async () => {
    let reviewed = false;
    let readAttempt = false;
    const provider = {
      providerId: "codexmanager-local" as const,
      modelId: "gpt-5.4" as const,
      externalCallCount: 0,
      validateConfiguration: async () => ({ configured: false, reason: "gateway unavailable" }),
      reviewVideoFrames: async () => {
        reviewed = true;
        throw new Error("must not be called");
      },
    };
    const client = {
      aiQaRunV3Record: {
        findUnique: async () => {
          readAttempt = true;
          return null;
        },
      },
    };
    const service = new CapabilityV3QaService(provider, client as any);

    await expect(service.reviewAttempt("attempt-1")).rejects.toMatchObject({
      code: "QA_PROVIDER_NOT_READY",
      status: 409,
    } satisfies Partial<ProjectAssetError>);
    expect(readAttempt).toBe(false);
    expect(reviewed).toBe(false);
  });
});
