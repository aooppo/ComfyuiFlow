import { ProjectAssetError } from "./contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export class UnderstandingService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async history(projectAssetId: string) {
    const revisions = await this.client.assetUnderstandingRevision.findMany({
      where: { projectAssetId },
      include: { reviews: { orderBy: { createdAt: "desc" } } },
      orderBy: { ordinal: "desc" },
    });
    if (revisions.length === 0) return { revisions: [], approved: null };
    const mapped = revisions.map((revision) => ({
      id: revision.id,
      ordinal: revision.ordinal,
      authorType: revision.authorType,
      facts: revision.factsJson,
      createdAt: revision.createdAt.toISOString(),
      decision: revision.reviews[0]?.decision ?? null,
    }));
    return {
      revisions: mapped,
      approved: mapped.find((revision) => revision.decision === "ACCEPTED") ?? null,
    };
  }

  async review(
    revisionId: string,
    decision: "ACCEPTED" | "REJECTED",
    notes: string | undefined,
    idempotencyKey: string,
  ) {
    const revision = await this.client.assetUnderstandingRevision.findUnique({
      where: { id: revisionId },
    });
    if (!revision)
      throw new ProjectAssetError(
        "UNDERSTANDING_REVISION_NOT_FOUND",
        "Understanding revision was not found",
        404,
      );
    const existing = await this.client.understandingReview.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;
    return this.client.understandingReview.create({
      data: { revisionId, decision, ...(notes ? { notes } : {}), idempotencyKey },
    });
  }

  async correct(revisionId: string, facts: unknown, idempotencyKey: string) {
    const source = await this.client.assetUnderstandingRevision.findUnique({
      where: { id: revisionId },
    });
    if (!source)
      throw new ProjectAssetError(
        "UNDERSTANDING_REVISION_NOT_FOUND",
        "Understanding revision was not found",
        404,
      );
    const existing = await this.client.understandingReview.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return { review: existing, revision: null };
    return this.client.$transaction(async (tx) => {
      const aggregate = await tx.assetUnderstandingRevision.aggregate({
        where: { projectAssetId: source.projectAssetId },
        _max: { ordinal: true },
      });
      const revision = await tx.assetUnderstandingRevision.create({
        data: {
          projectAssetId: source.projectAssetId,
          sourceRevisionId: source.id,
          ordinal: (aggregate._max.ordinal ?? 0) + 1,
          authorType: "OWNER",
          schemaVersion: "asset-understanding-v1",
          factsJson: facts as never,
        },
      });
      const review = await tx.understandingReview.create({
        data: { revisionId: revision.id, decision: "ACCEPTED", idempotencyKey },
      });
      return { revision, review };
    });
  }

  async apply(
    revisionId: string,
    input: {
      targetType: "PRODUCTION_ASSET_DRAFT" | "ASSET_VERSION_FILE_DRAFT";
      targetId: string;
      fieldMappings: Array<{ sourceField: string; targetField: string }>;
      idempotencyKey: string;
    },
  ) {
    const existing = await this.client.understandingApplication.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const revision = await this.client.assetUnderstandingRevision.findUnique({
      where: { id: revisionId },
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 1 }, projectAsset: true },
    });
    if (!revision || revision.reviews[0]?.decision !== "ACCEPTED") {
      throw new ProjectAssetError(
        "UNDERSTANDING_NOT_APPROVED",
        "Only an approved revision can be applied",
        409,
      );
    }
    const facts = revision.factsJson as Record<string, unknown>;
    const values = Object.fromEntries(
      input.fieldMappings
        .filter((mapping) => Object.hasOwn(facts, mapping.sourceField))
        .map((mapping) => [mapping.targetField, facts[mapping.sourceField]]),
    );
    return this.client.$transaction(async (tx) => {
      if (input.targetType === "PRODUCTION_ASSET_DRAFT") {
        const version = await tx.productionAssetVersion.findUnique({
          where: { id: input.targetId },
        });
        if (
          !version ||
          version.projectId !== revision.projectAsset.projectId ||
          version.status !== "DRAFT"
        ) {
          throw new ProjectAssetError(
            "APPLICATION_TARGET_INVALID",
            "Choose a draft asset version in the same project",
            409,
          );
        }
        await tx.productionAssetVersion.update({
          where: { id: version.id },
          data: {
            factsJson: { ...asObject(version.factsJson), ...values } as never,
            sourceType: "UNDERSTANDING_REVISION",
            sourceRevisionId: revision.id,
          },
        });
      } else {
        const binding = await tx.assetVersionFile.findUnique({
          where: { id: input.targetId },
          include: { productionAssetVersion: true },
        });
        if (
          !binding ||
          binding.projectId !== revision.projectAsset.projectId ||
          binding.productionAssetVersion.status !== "DRAFT"
        ) {
          throw new ProjectAssetError(
            "APPLICATION_TARGET_INVALID",
            "Choose a draft file binding in the same project",
            409,
          );
        }
        await tx.assetVersionFile.update({
          where: { id: binding.id },
          data: {
            qualityFactsJson: { ...asObject(binding.qualityFactsJson), ...values } as never,
            sourceType: "UNDERSTANDING_REVISION",
            sourceRevisionId: revision.id,
          },
        });
      }
      const application = await tx.understandingApplication.create({
        data: {
          revisionId,
          targetType: input.targetType,
          targetId: input.targetId,
          fieldMappings: input.fieldMappings,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.projectActivity.create({
        data: {
          projectId: revision.projectAsset.projectId,
          assetId: revision.projectAssetId,
          type: "UNDERSTANDING_APPLIED",
          summary: "Approved understanding applied",
        },
      });
      return application;
    });
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
