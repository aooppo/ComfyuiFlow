import type { ProductionAsset, ProductionAssetVersion } from "./generated/client/index.js";
import { ProjectAssetError } from "./contracts.js";
import type { AssetVersionFileInput, CreateProductionAsset } from "./production-asset-contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function versionDto(version: ProductionAssetVersion) {
  return {
    id: version.id,
    projectId: version.projectId,
    productionAssetId: version.productionAssetId,
    versionNumber: version.versionNumber,
    basedOnVersionId: version.basedOnVersionId,
    status: version.status,
    displayName: version.displayName,
    description: version.description,
    facts: version.factsJson,
    sourceType: version.sourceType,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

function assetDto(
  asset: ProductionAsset & {
    versions?: ProductionAssetVersion[];
    characterProfile?: { id: string } | null;
  },
) {
  return {
    id: asset.id,
    projectId: asset.projectId,
    type: asset.type,
    name: asset.name,
    slug: asset.slug,
    status: asset.status,
    currentVersionId: asset.currentVersionId,
    rowVersion: asset.rowVersion,
    characterProfileId: asset.characterProfile?.id ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    ...(asset.versions ? { versions: asset.versions.map(versionDto) } : {}),
  };
}

export class ProductionAssetService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async list(projectId: string, input?: { type?: string; cursor?: string; limit?: number }) {
    await this.requireProject(projectId, false);
    const limit = Math.min(Math.max(input?.limit ?? 30, 1), 100);
    const offset = input?.cursor
      ? Number(Buffer.from(input.cursor, "base64url").toString("utf8"))
      : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new ProjectAssetError("INVALID_CURSOR", "The page cursor is invalid");
    }
    const where = {
      projectId,
      ...(input?.type ? { type: input.type as never } : {}),
      status: { not: "ARCHIVED" as const },
    };
    const [total, rows] = await this.client.$transaction([
      this.client.productionAsset.count({ where }),
      this.client.productionAsset.findMany({
        where,
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 10 },
          characterProfile: { select: { id: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: offset,
        take: limit + 1,
      }),
    ]);
    return {
      assets: rows.slice(0, limit).map(assetDto),
      total,
      nextCursor:
        rows.length > limit ? Buffer.from(String(offset + limit)).toString("base64url") : null,
    };
  }

  async create(projectId: string, input: CreateProductionAsset) {
    await this.requireProject(projectId, true);
    const normalizedName = normalizeName(input.name);
    const created = await this.client.$transaction(async (tx) => {
      const asset = await tx.productionAsset.create({
        data: {
          projectId,
          type: input.type,
          name: input.name,
          normalizedName,
        },
      });
      const version = await tx.productionAssetVersion.create({
        data: {
          projectId,
          productionAssetId: asset.id,
          versionNumber: 1,
          displayName: input.name,
          description: input.description ?? null,
          sourceType: "OWNER",
        },
      });
      if (input.type === "CHARACTER") {
        await tx.characterProfile.create({
          data: { projectId, productionAssetId: asset.id, canonicalName: input.name },
        });
      }
      await tx.projectActivity.create({
        data: { projectId, type: "PRODUCTION_ASSET_CREATED", summary: "Production asset created" },
      });
      return { ...asset, versions: [version] };
    });
    return assetDto(created);
  }

  async getVersion(versionId: string) {
    const version = await this.client.productionAssetVersion.findUnique({
      where: { id: versionId },
    });
    if (!version)
      throw new ProjectAssetError(
        "PRODUCTION_ASSET_VERSION_NOT_FOUND",
        "Asset version was not found",
        404,
      );
    return versionDto(version);
  }

  async createVersion(assetId: string, basedOnVersionId?: string) {
    const asset = await this.client.productionAsset.findUnique({ where: { id: assetId } });
    if (!asset)
      throw new ProjectAssetError(
        "PRODUCTION_ASSET_NOT_FOUND",
        "Production asset was not found",
        404,
      );
    await this.requireProject(asset.projectId, true);
    const result = await this.client.$transaction(async (tx) => {
      const sourceId = basedOnVersionId ?? asset.currentVersionId;
      const source = sourceId
        ? await tx.productionAssetVersion.findUnique({ where: { id: sourceId } })
        : null;
      if (
        source &&
        (source.productionAssetId !== assetId || source.projectId !== asset.projectId)
      ) {
        throw new ProjectAssetError(
          "CROSS_PROJECT",
          "Version must belong to this production asset",
          409,
        );
      }
      const aggregate = await tx.productionAssetVersion.aggregate({
        where: { productionAssetId: assetId },
        _max: { versionNumber: true },
      });
      return tx.productionAssetVersion.create({
        data: {
          projectId: asset.projectId,
          productionAssetId: assetId,
          versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
          basedOnVersionId: source?.id ?? null,
          displayName: source?.displayName ?? asset.name,
          description: source?.description ?? null,
          ...(source?.factsJson === null || source?.factsJson === undefined
            ? {}
            : { factsJson: source.factsJson }),
          sourceType: "OWNER",
        },
      });
    });
    return versionDto(result);
  }

  async publishVersion(versionId: string) {
    const version = await this.client.productionAssetVersion.findUnique({
      where: { id: versionId },
      include: { productionAsset: true },
    });
    if (!version)
      throw new ProjectAssetError(
        "PRODUCTION_ASSET_VERSION_NOT_FOUND",
        "Asset version was not found",
        404,
      );
    if (version.status !== "DRAFT") {
      throw new ProjectAssetError(
        "VERSION_IMMUTABLE",
        "Only a draft version can be published",
        409,
      );
    }
    await this.requireProject(version.projectId, true);
    const published = await this.client.$transaction(async (tx) => {
      await tx.productionAssetVersion.updateMany({
        where: { productionAssetId: version.productionAssetId, status: "ACTIVE" },
        data: { status: "RETIRED" },
      });
      const active = await tx.productionAssetVersion.update({
        where: { id: version.id },
        data: { status: "ACTIVE", publishedAt: new Date() },
      });
      await tx.productionAsset.update({
        where: { id: version.productionAssetId },
        data: { currentVersionId: version.id, rowVersion: { increment: 1 } },
      });
      await tx.projectActivity.create({
        data: {
          projectId: version.projectId,
          type: "PRODUCTION_ASSET_PUBLISHED",
          summary: "Production asset version published",
        },
      });
      return active;
    });
    return versionDto(published);
  }

  async bindFile(versionId: string, input: AssetVersionFileInput) {
    const version = await this.client.productionAssetVersion.findUnique({
      where: { id: versionId },
    });
    if (!version)
      throw new ProjectAssetError(
        "PRODUCTION_ASSET_VERSION_NOT_FOUND",
        "Asset version was not found",
        404,
      );
    if (version.status !== "DRAFT")
      throw new ProjectAssetError("VERSION_IMMUTABLE", "Published versions cannot be changed", 409);
    const file = await this.client.asset.findUnique({ where: { id: input.projectAssetId } });
    if (!file || file.projectId !== version.projectId) {
      throw new ProjectAssetError("CROSS_PROJECT", "File must belong to the same project", 409);
    }
    if (file.status !== "READY")
      throw new ProjectAssetError("FILE_NOT_READY", "Only ready files can be bound", 409);
    const binding = await this.client.$transaction(async (tx) => {
      const value = await tx.assetVersionFile.create({
        data: {
          projectId: version.projectId,
          productionAssetVersionId: version.id,
          projectAssetId: file.id,
          referenceUsage: input.referenceUsage,
          viewpoint: input.viewpoint,
          shotScale: input.shotScale,
          isPreferred: input.isPreferred,
          approvalStatus: "ACCEPTED",
          sourceType: "OWNER",
        },
      });
      await tx.projectActivity.create({
        data: {
          projectId: version.projectId,
          assetId: file.id,
          type: "ASSET_VERSION_FILE_BOUND",
          summary: "Asset reference bound",
        },
      });
      return value;
    });
    return binding;
  }

  async addRelation(versionId: string, toAssetVersionId: string, relationType: string) {
    const [from, to] = await Promise.all([
      this.client.productionAssetVersion.findUnique({ where: { id: versionId } }),
      this.client.productionAssetVersion.findUnique({ where: { id: toAssetVersionId } }),
    ]);
    if (!from || !to)
      throw new ProjectAssetError(
        "PRODUCTION_ASSET_VERSION_NOT_FOUND",
        "Asset version was not found",
        404,
      );
    if (from.projectId !== to.projectId || from.id === to.id) {
      throw new ProjectAssetError(
        "CROSS_PROJECT",
        "Asset relation must stay within one project",
        409,
      );
    }
    if (from.status !== "DRAFT")
      throw new ProjectAssetError("VERSION_IMMUTABLE", "Published versions cannot be changed", 409);
    return this.client.productionAssetRelation.create({
      data: {
        projectId: from.projectId,
        fromAssetVersionId: from.id,
        toAssetVersionId: to.id,
        relationType: relationType as never,
      },
    });
  }

  private async requireProject(projectId: string, active: boolean) {
    const project = await this.client.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    if (active && project.status !== "ACTIVE") {
      throw new ProjectAssetError(
        "PROJECT_ARCHIVED",
        "Restore this project before editing production assets",
        409,
      );
    }
    return project;
  }
}
