import { readFile } from "node:fs/promises";
import { ProjectAssetError } from "./contracts.js";
import type { StorageProvider } from "./local-storage.js";

export interface AnalysisContentItem {
  slot: string;
  asset: {
    status: string;
    mediaType: string;
    storedObject: {
      storageKey: string;
      sha256: string;
      byteSize: bigint;
      detectedMimeType: string;
    };
  };
}

export async function readAnalysisContent(item: AnalysisContentItem, storage: StorageProvider) {
  if (item.asset.status !== "READY" || item.asset.mediaType !== "IMAGE") {
    throw new ProjectAssetError(
      "ANALYSIS_ASSET_NOT_READY",
      "Analysis input is no longer a ready image",
      409,
    );
  }
  const object = item.asset.storedObject;
  const verifiedPath = await storage.resolveVerified(
    object.storageKey,
    object.sha256,
    Number(object.byteSize),
  );
  return {
    slot: item.slot,
    mimeType: object.detectedMimeType,
    content: await readFile(verifiedPath),
  };
}
