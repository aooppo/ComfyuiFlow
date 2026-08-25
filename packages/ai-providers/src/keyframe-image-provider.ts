import { createHash } from "node:crypto";
import type { KeyframeCapabilityV1, KeyframeProviderProfileId } from "@comfyuiflow/contracts";
import { KeyframeCapabilityV1Schema } from "@comfyuiflow/contracts";

export interface KeyframeReferenceImage {
  sha256: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  filename: string;
  bytes: Uint8Array;
}

export interface KeyframeGenerationInput {
  requestHash: string;
  prompt: string;
  references: KeyframeReferenceImage[];
  width: 768;
  height: 1344;
  quality: "low";
}

export interface KeyframeGenerationResult {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  reportedWidth?: number;
  reportedHeight?: number;
  responseId?: string;
  usage?: Record<string, number>;
  costFacts?: Record<string, unknown>;
}

export interface KeyframeImageProvider {
  readonly profileId: KeyframeProviderProfileId;
  readonly external: boolean;
  preview(): KeyframeCapabilityV1;
  generateOnce(input: KeyframeGenerationInput): Promise<KeyframeGenerationResult>;
}

const FAKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEklEQVR4nGNkYPjLwMDAwgAGAAsXAQPfmWhAAAAAAElFTkSuQmCC",
  "base64",
);

export class FakeKeyframeImageProvider implements KeyframeImageProvider {
  readonly profileId = "fake-keyframe-v1" as const;
  readonly external = false;
  readonly calls = { generate: 0 };

  preview(): KeyframeCapabilityV1 {
    return KeyframeCapabilityV1Schema.parse({
      schemaVersion: "keyframe-capability-v1",
      profileId: this.profileId,
      providerId: "fake",
      modelId: "fake-keyframe-v1",
      modelSnapshot: "fake-keyframe-v1",
      generation: true,
      editing: true,
      multipleReferenceImages: true,
      highFidelityInput: true,
      maximumReferenceImages: 20,
      providerRequestSize: "1024x1536",
      width: 768,
      height: 1344,
      quality: "low",
      priceAvailable: true,
      estimatedCostUsdPerImage: 0,
      priceAsOf: null,
      priceExpiresAt: null,
      liveReady: true,
      blockers: [],
    });
  }

  async generateOnce(input: KeyframeGenerationInput): Promise<KeyframeGenerationResult> {
    this.calls.generate += 1;
    const marker = createHash("sha256").update(input.requestHash).digest().subarray(0, 8);
    return {
      bytes: Buffer.concat([FAKE_PNG, marker]),
      mimeType: "image/png",
      reportedWidth: 1,
      reportedHeight: 1,
      responseId: `fake:${input.requestHash.slice(0, 16)}`,
      usage: { externalCalls: 0 },
      costFacts: { estimatedCostUsd: 0 },
    };
  }
}
