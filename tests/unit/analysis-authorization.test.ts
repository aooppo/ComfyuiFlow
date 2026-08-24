import { describe, expect, it } from "vitest";
import { analysisConfirmSchema, analysisPreviewSchema } from "@comfyuiflow/project-core";

describe("asset-understanding authorization contract", () => {
  it("makes preview call-free and requires explicit acknowledgment plus a bounded idempotency key", () => {
    expect(
      analysisPreviewSchema.parse({ assetIds: ["11111111-1111-4111-8111-111111111111"] }),
    ).toMatchObject({ providerId: "fake" });
    expect(() =>
      analysisConfirmSchema.parse({
        manifestHash: "a".repeat(64),
        acknowledgeExternalImageUpload: false,
        idempotencyKey: "x".repeat(16),
      }),
    ).toThrow();
    expect(
      analysisConfirmSchema.parse({
        manifestHash: "a".repeat(64),
        acknowledgeExternalImageUpload: true,
        idempotencyKey: "x".repeat(16),
      }),
    ).toMatchObject({ acknowledgeExternalImageUpload: true });
  });
});
