import { createHash } from "node:crypto";
import type { AnalysisPreview } from "./analysis-service.js";

export const ASSET_UNDERSTANDING_VERSION = "asset-understanding-v1";

export function manifestHash(input: {
  projectId: string;
  providerId: string;
  modelId: string;
  items: Array<{ assetId: string; sha256: string; byteSize: number; mediaType: string }>;
}) {
  const canonical = JSON.stringify({
    projectId: input.projectId,
    providerId: input.providerId,
    modelId: input.modelId,
    taskType: "ASSET_UNDERSTANDING",
    promptVersion: ASSET_UNDERSTANDING_VERSION,
    schemaVersion: ASSET_UNDERSTANDING_VERSION,
    maxCalls: 1,
    items: input.items.map((item, index) => ({ slot: `A${index + 1}`, ...item })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function previewFromManifest(value: AnalysisPreview): AnalysisPreview {
  return value;
}
