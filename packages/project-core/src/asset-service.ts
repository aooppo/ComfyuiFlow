import path from "node:path";
import type { Asset, StoredObject } from "./generated/client/index.js";
import type { AssetFilter, AssetPatch, AssetRoleValue } from "./contracts.js";
import { ProjectAssetError } from "./contracts.js";
import { inspectMedia } from "./media-probe.js";
import { LocalContentStorage, sanitizeFilename, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

type AssetWithObject = Asset & { storedObject: StoredObject };

export function assetDto(asset: AssetWithObject) {
  return {
    id: asset.id,
    projectId: asset.projectId,
    originalFilename: asset.originalFilename,
    displayName: asset.displayName,
    mediaType: asset.mediaType,
    role: asset.role,
    notes: asset.notes,
    status: asset.status,
    sha256: asset.storedObject.sha256,
    byteSize: Number(asset.storedObject.byteSize),
    detectedMimeType: asset.storedObject.detectedMimeType,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    inspectionWarning: asset.inspectionWarning,
    removedAt: asset.removedAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export class AssetService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage(),
  ) {}

  async list(projectId: string, filter: AssetFilter = {}) {
    await this.requireProject(projectId, false);
    const assets = await this.client.asset.findMany({
      where: {
        projectId,
        status: "READY",
        ...(filter.mediaType ? { mediaType: filter.mediaType } : {}),
        ...(filter.role ? { role: filter.role } : {}),
      },
      include: { storedObject: true },
      orderBy: { createdAt: "desc" },
    });
    return { assets: assets.map(assetDto), count: assets.length };
  }

  async get(id: string, includeRemoved = false) {
    const asset = await this.client.asset.findUnique({
      where: { id },
      include: { storedObject: true },
    });
    if (!asset || (!includeRemoved && asset.status !== "READY")) {
      throw new ProjectAssetError("ASSET_NOT_FOUND", "Asset was not found", 404);
    }
    return assetDto(asset);
  }

  async importStream(input: {
    projectId: string;
    filename: string;
    role: AssetRoleValue;
    stream: AsyncIterable<Uint8Array>;
  }) {
    const filename = sanitizeFilename(input.filename);
    await this.requireProject(input.projectId, true);
    let preserved: Awaited<ReturnType<StorageProvider["preserve"]>>;
    try {
      preserved = await this.storage.preserve(input.stream);
    } catch (error) {
      const known = error instanceof ProjectAssetError ? error : null;
      await this.client.assetImportAttempt.create({
        data: {
          projectId: input.projectId,
          submittedFilename: filename,
          requestedRole: input.role,
          outcome: known && known.status < 500 ? "REJECTED" : "FAILED",
          resultCode: known?.code ?? "IMPORT_FAILED",
        },
      });
      return {
        filename,
        outcome: known && known.status < 500 ? "REJECTED" : "FAILED",
        code: known?.code ?? "IMPORT_FAILED",
      } as const;
    }

    const facts = await inspectMedia(preserved.absolutePath, preserved.detectedMimeType);
    const displayName = path.parse(filename).name.trim().slice(0, 120) || "Untitled asset";
    return this.client.$transaction(async (tx) => {
      const storedObject = await tx.storedObject.upsert({
        where: { sha256: preserved.sha256 },
        update: {},
        create: {
          sha256: preserved.sha256,
          byteSize: BigInt(preserved.byteSize),
          detectedMimeType: preserved.detectedMimeType,
          storageKey: preserved.storageKey,
        },
      });
      const duplicate = await tx.asset.findUnique({
        where: {
          projectId_storedObjectId: { projectId: input.projectId, storedObjectId: storedObject.id },
        },
        include: { storedObject: true },
      });
      if (duplicate) {
        await tx.assetImportAttempt.create({
          data: {
            projectId: input.projectId,
            submittedFilename: filename,
            submittedByteSize: BigInt(preserved.byteSize),
            detectedMimeType: preserved.detectedMimeType,
            sha256: preserved.sha256,
            requestedRole: input.role,
            outcome: "DUPLICATE",
            resultCode: duplicate.status === "REMOVED" ? "DUPLICATE_REMOVED" : "DUPLICATE_ACTIVE",
            assetId: duplicate.id,
          },
        });
        return {
          filename,
          outcome: "DUPLICATE" as const,
          code: duplicate.status === "REMOVED" ? "DUPLICATE_REMOVED" : "DUPLICATE_ACTIVE",
          asset: assetDto(duplicate),
        };
      }
      const asset = await tx.asset.create({
        data: {
          projectId: input.projectId,
          storedObjectId: storedObject.id,
          originalFilename: filename,
          displayName,
          mediaType: facts.mediaType,
          role: input.role,
          width: facts.width,
          height: facts.height,
          durationMs: facts.durationMs,
          inspectionWarning: facts.inspectionWarning,
        },
        include: { storedObject: true },
      });
      await tx.assetImportAttempt.create({
        data: {
          projectId: input.projectId,
          submittedFilename: filename,
          submittedByteSize: BigInt(preserved.byteSize),
          detectedMimeType: preserved.detectedMimeType,
          sha256: preserved.sha256,
          requestedRole: input.role,
          outcome: "IMPORTED",
          resultCode: "IMPORTED",
          assetId: asset.id,
        },
      });
      await tx.projectActivity.create({
        data: {
          projectId: input.projectId,
          assetId: asset.id,
          type: "ASSET_IMPORTED",
          summary: "Asset imported",
        },
      });
      await tx.project.update({ where: { id: input.projectId }, data: { updatedAt: new Date() } });
      return { filename, outcome: "IMPORTED" as const, code: "IMPORTED", asset: assetDto(asset) };
    });
  }

  async update(id: string, input: AssetPatch) {
    const existing = await this.client.asset.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing || existing.status !== "READY") {
      throw new ProjectAssetError("ASSET_NOT_FOUND", "Asset was not found", 404);
    }
    if (existing.project.status !== "ACTIVE") {
      throw new ProjectAssetError(
        "PROJECT_ARCHIVED",
        "Restore this project before editing assets",
        409,
      );
    }
    const asset = await this.client.$transaction(async (tx) => {
      const updated = await tx.asset.update({
        where: { id },
        data: {
          ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
          ...(input.role === undefined ? {} : { role: input.role }),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
        include: { storedObject: true },
      });
      await tx.projectActivity.create({
        data: {
          projectId: existing.projectId,
          assetId: id,
          type: "ASSET_UPDATED",
          summary: "Asset details updated",
        },
      });
      await tx.project.update({
        where: { id: existing.projectId },
        data: { updatedAt: new Date() },
      });
      return updated;
    });
    return assetDto(asset);
  }

  async remove(id: string) {
    const existing = await this.client.asset.findUnique({
      where: { id },
      include: { storedObject: true, project: true },
    });
    if (!existing) throw new ProjectAssetError("ASSET_NOT_FOUND", "Asset was not found", 404);
    if (existing.status === "REMOVED") return assetDto(existing);
    if (existing.project.status !== "ACTIVE") {
      throw new ProjectAssetError(
        "PROJECT_ARCHIVED",
        "Restore this project before removing assets",
        409,
      );
    }
    const asset = await this.client.$transaction(async (tx) => {
      const removed = await tx.asset.update({
        where: { id },
        data: { status: "REMOVED", removedAt: new Date() },
        include: { storedObject: true },
      });
      await tx.projectActivity.create({
        data: {
          projectId: existing.projectId,
          assetId: id,
          type: "ASSET_REMOVED",
          summary: "Asset removed from library",
        },
      });
      await tx.project.update({
        where: { id: existing.projectId },
        data: { updatedAt: new Date() },
      });
      return removed;
    });
    return assetDto(asset);
  }

  async content(id: string) {
    const asset = await this.client.asset.findUnique({
      where: { id },
      include: { storedObject: true },
    });
    if (!asset || asset.status !== "READY") {
      throw new ProjectAssetError("ASSET_NOT_FOUND", "Asset was not found", 404);
    }
    const absolutePath = await this.storage.resolveVerified(
      asset.storedObject.storageKey,
      asset.storedObject.sha256,
      Number(asset.storedObject.byteSize),
    );
    return {
      absolutePath,
      filename: asset.originalFilename,
      mimeType: asset.storedObject.detectedMimeType,
      byteSize: Number(asset.storedObject.byteSize),
      sha256: asset.storedObject.sha256,
    };
  }

  private async requireProject(projectId: string, active: boolean) {
    const project = await this.client.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    if (active && project.status !== "ACTIVE") {
      throw new ProjectAssetError(
        "PROJECT_ARCHIVED",
        "Restore this project before importing assets",
        409,
      );
    }
    return project;
  }
}
