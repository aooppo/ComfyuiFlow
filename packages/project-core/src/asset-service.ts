import path from "node:path";
import type { Asset, StoredObject } from "./generated/client/index.js";
import type { AssetFilter, AssetPatch, AssetRoleValue } from "./contracts.js";
import { ProjectAssetError } from "./contracts.js";
import type { ProjectAssetFilter } from "./project-asset-contracts.js";
import { MEDIA_PROBE_VERSION, probeMedia } from "./media-probe.js";
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { assets: assets.map(assetDto), count: assets.length };
  }

  async listPage(projectId: string, filter: ProjectAssetFilter) {
    await this.requireProject(projectId, false);
    const offset = decodeCursor(filter.cursor);
    const where = {
      projectId,
      ...(filter.status ? { status: filter.status } : { status: { not: "REMOVED" as const } }),
      ...(filter.mediaType ? { mediaType: filter.mediaType } : {}),
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.query
        ? { displayName: { contains: filter.query, mode: "insensitive" as const } }
        : {}),
    };
    const [total, assets] = await this.client.$transaction([
      this.client.asset.count({ where }),
      this.client.asset.findMany({
        where,
        include: { storedObject: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: filter.limit + 1,
      }),
    ]);
    const page = assets.slice(0, filter.limit);
    return {
      assets: page.map(assetDto),
      total,
      nextCursor: assets.length > filter.limit ? encodeCursor(offset + filter.limit) : null,
    };
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

  async createImportBatch(projectId: string, idempotencyKey: string, requestedItemCount: number) {
    await this.requireProject(projectId, true);
    return this.client.assetImportBatch.upsert({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
      update: {},
      create: { projectId, idempotencyKey, requestedItemCount },
    });
  }

  async completeImportBatch(batchId: string) {
    const attempts = await this.client.assetImportAttempt.findMany({ where: { batchId } });
    const hasFailure = attempts.some(
      (attempt) => attempt.outcome === "FAILED" || attempt.outcome === "REJECTED",
    );
    return this.client.assetImportBatch.update({
      where: { id: batchId },
      data: {
        status: hasFailure ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        completedAt: new Date(),
      },
    });
  }

  async recordRejectedImport(input: {
    projectId: string;
    filename: string;
    role: AssetRoleValue;
    code: string;
    batchId?: string;
    itemIndex?: number;
  }) {
    await this.client.assetImportAttempt.create({
      data: {
        projectId: input.projectId,
        ...(input.batchId ? { batchId: input.batchId } : {}),
        ...(input.itemIndex === undefined ? {} : { itemIndex: input.itemIndex }),
        submittedFilename: sanitizeFilename(input.filename),
        requestedRole: input.role,
        outcome: "REJECTED",
        resultCode: input.code,
        status: "TERMINAL",
        completedAt: new Date(),
      },
    });
    return {
      filename: sanitizeFilename(input.filename),
      outcome: "REJECTED" as const,
      code: input.code,
    };
  }

  async importStream(input: {
    projectId: string;
    filename: string;
    role: AssetRoleValue;
    stream: AsyncIterable<Uint8Array>;
    batchId?: string;
    itemIndex?: number;
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
          ...(input.batchId ? { batchId: input.batchId } : {}),
          ...(input.itemIndex === undefined ? {} : { itemIndex: input.itemIndex }),
          submittedFilename: filename,
          requestedRole: input.role,
          outcome: known && known.status < 500 ? "REJECTED" : "FAILED",
          resultCode: known?.code ?? "IMPORT_FAILED",
          status: "TERMINAL",
          completedAt: new Date(),
        },
      });
      return {
        filename,
        outcome: known && known.status < 500 ? "REJECTED" : "FAILED",
        code: known?.code ?? "IMPORT_FAILED",
      } as const;
    }

    const facts = await probeMedia(preserved.absolutePath, preserved.detectedMimeType);
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
          verificationStatus: facts.status === "PASS" ? "VERIFIED" : "INVALID",
          ...(facts.status === "PASS" ? { verifiedAt: new Date() } : {}),
        },
      });
      const nextOrdinal =
        (await tx.mediaProbeResult.count({ where: { storedObjectId: storedObject.id } })) + 1;
      await tx.mediaProbeResult.create({
        data: {
          storedObjectId: storedObject.id,
          ordinal: nextOrdinal,
          probeVersion: MEDIA_PROBE_VERSION,
          status: facts.status,
          mediaType: facts.mediaType,
          container: facts.container,
          width: facts.width,
          height: facts.height,
          durationMs: facts.durationMs,
          streamCount: facts.streamCount,
          safeResultCode: facts.safeResultCode,
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
            ...(input.batchId ? { batchId: input.batchId } : {}),
            ...(input.itemIndex === undefined ? {} : { itemIndex: input.itemIndex }),
            submittedFilename: filename,
            submittedByteSize: BigInt(preserved.byteSize),
            detectedMimeType: preserved.detectedMimeType,
            sha256: preserved.sha256,
            requestedRole: input.role,
            outcome: "DUPLICATE",
            resultCode: duplicate.status === "REMOVED" ? "DUPLICATE_REMOVED" : "DUPLICATE_ACTIVE",
            assetId: duplicate.id,
            status: "TERMINAL",
            completedAt: new Date(),
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
          status: facts.status === "PASS" ? "READY" : "INVALID",
          width: facts.width,
          height: facts.height,
          durationMs: facts.durationMs,
          inspectionWarning: facts.status === "PASS" ? null : facts.safeResultCode,
        },
        include: { storedObject: true },
      });
      await tx.assetImportAttempt.create({
        data: {
          projectId: input.projectId,
          ...(input.batchId ? { batchId: input.batchId } : {}),
          ...(input.itemIndex === undefined ? {} : { itemIndex: input.itemIndex }),
          submittedFilename: filename,
          submittedByteSize: BigInt(preserved.byteSize),
          detectedMimeType: preserved.detectedMimeType,
          sha256: preserved.sha256,
          requestedRole: input.role,
          outcome: "IMPORTED",
          resultCode: facts.status === "PASS" ? "IMPORTED_READY" : "IMPORTED_INVALID",
          assetId: asset.id,
          status: "TERMINAL",
          completedAt: new Date(),
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
      return {
        filename,
        outcome: "IMPORTED" as const,
        code: facts.status === "PASS" ? "IMPORTED_READY" : "IMPORTED_INVALID",
        asset: assetDto(asset),
      };
    });
  }

  async revalidate(projectId: string, assetIds: string[]) {
    await this.requireProject(projectId, true);
    const assets = await this.client.asset.findMany({
      where: { projectId, id: { in: assetIds }, status: { in: ["PRESERVED", "READY", "INVALID"] } },
      include: { storedObject: true },
    });
    if (assets.length !== assetIds.length) {
      throw new ProjectAssetError(
        "ASSET_NOT_FOUND",
        "One or more assets cannot be revalidated",
        404,
      );
    }
    const results = [];
    for (const asset of assets) {
      try {
        const absolutePath = await this.storage.resolveVerified(
          asset.storedObject.storageKey,
          asset.storedObject.sha256,
          Number(asset.storedObject.byteSize),
        );
        const facts = await probeMedia(absolutePath, asset.storedObject.detectedMimeType);
        let updated: AssetWithObject | undefined;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            updated = await this.client.$transaction(async (tx) => {
              const ordinal =
                (await tx.mediaProbeResult.count({
                  where: { storedObjectId: asset.storedObjectId },
                })) + 1;
              await tx.mediaProbeResult.create({
                data: {
                  storedObjectId: asset.storedObjectId,
                  ordinal,
                  probeVersion: MEDIA_PROBE_VERSION,
                  status: facts.status,
                  mediaType: facts.mediaType,
                  container: facts.container,
                  width: facts.width,
                  height: facts.height,
                  durationMs: facts.durationMs,
                  streamCount: facts.streamCount,
                  safeResultCode: facts.safeResultCode,
                },
              });
              await tx.storedObject.update({
                where: { id: asset.storedObjectId },
                data: {
                  verificationStatus: facts.status === "PASS" ? "VERIFIED" : "INVALID",
                  ...(facts.status === "PASS" ? { verifiedAt: new Date() } : {}),
                },
              });
              const projectAsset = await tx.asset.update({
                where: { id: asset.id },
                data: {
                  status: facts.status === "PASS" ? "READY" : "INVALID",
                  width: facts.width,
                  height: facts.height,
                  durationMs: facts.durationMs,
                  inspectionWarning: facts.status === "PASS" ? null : facts.safeResultCode,
                },
                include: { storedObject: true },
              });
              await tx.projectActivity.create({
                data: {
                  projectId,
                  assetId: asset.id,
                  type: "ASSET_REVALIDATED",
                  summary: "Asset revalidated",
                },
              });
              return projectAsset;
            });
            break;
          } catch (error) {
            if (!this.isUniqueConflict(error) || attempt === 2) throw error;
          }
        }
        if (!updated) throw new Error("REVALIDATION_CONFLICT");
        results.push({ asset: assetDto(updated), code: facts.safeResultCode });
      } catch (error) {
        const code = error instanceof ProjectAssetError ? error.code : "REVALIDATION_FAILED";
        const invalid = await this.client.asset.update({
          where: { id: asset.id },
          data: { status: "INVALID", inspectionWarning: code },
          include: { storedObject: true },
        });
        results.push({ asset: assetDto(invalid), code });
      }
    }
    return { results };
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

  private isUniqueConflict(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset)).toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return 0;
  const value = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ProjectAssetError("INVALID_CURSOR", "The page cursor is invalid");
  }
  return value;
}
