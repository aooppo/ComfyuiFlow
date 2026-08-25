import { ProjectAssetError } from "./contracts.js";
import {
  assetCandidateResultSchema,
  assetCandidateRequirementSchema,
  canonicalCandidateRequirementHash,
  type AssetCandidateResult,
  type AssetCandidateRequirement,
} from "./asset-candidate-contracts.js";
import {
  ASSET_CANDIDATE_POLICY_VERSION,
  compareAssetCandidateRank,
  evaluateAssetCandidate,
} from "./asset-candidate-policy.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export class AssetCandidateService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async preview(rawInput: AssetCandidateRequirement): Promise<AssetCandidateResult> {
    const input = assetCandidateRequirementSchema.parse(rawInput);
    const identity = await this.resolveIdentity(input);
    const bindings = await this.client.assetVersionFile.findMany({
      where: { projectId: input.projectId },
      include: {
        projectAsset: { include: { storedObject: true } },
        productionAssetVersion: { include: { productionAsset: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const rankedEligible: Array<
      AssetCandidateResult["eligible"][number] & { createdAt: Date; referenceUsage: string }
    > = [];
    const rejected: AssetCandidateResult["rejected"] = [];
    for (const binding of bindings) {
      const decision = evaluateAssetCandidate(
        input,
        {
          id: binding.id,
          projectId: binding.projectId,
          productionAssetVersionId: binding.productionAssetVersionId,
          assetType: binding.productionAssetVersion.productionAsset.type,
          productionAssetStatus: binding.productionAssetVersion.productionAsset.status,
          productionAssetVersionStatus: binding.productionAssetVersion.status,
          bindingStatus: binding.status,
          projectAssetStatus: binding.projectAsset.status,
          approvalStatus: binding.approvalStatus,
          referenceUsage: binding.referenceUsage,
          viewpoint: binding.viewpoint,
          shotScale: binding.shotScale,
          mediaType: binding.projectAsset.mediaType,
          detectedMimeType: binding.projectAsset.storedObject.detectedMimeType,
          width: binding.projectAsset.width,
          height: binding.projectAsset.height,
          isPreferred: binding.isPreferred,
        },
        { expectedVersionId: identity.versionId, characterStateMatches: true },
      );
      const candidate = {
        projectAssetId: binding.projectAssetId,
        productionAssetVersionId: binding.productionAssetVersionId,
        bindingId: binding.id,
      };
      if (decision.reasonCodes.length > 0) {
        rejected.push({
          ...candidate,
          matchedRules: decision.matchedRules,
          reasonCodes: decision.reasonCodes,
        });
        continue;
      }
      rankedEligible.push({
        ...candidate,
        matchedRules: decision.matchedRules,
        scoreFacts: decision.scoreFacts,
        createdAt: binding.createdAt,
        referenceUsage: binding.referenceUsage,
      });
    }
    rankedEligible.sort(compareAssetCandidateRank);
    const matchedUsages = new Set(rankedEligible.map((candidate) => candidate.referenceUsage));
    const eligible = rankedEligible.map((candidate) => ({
      projectAssetId: candidate.projectAssetId,
      productionAssetVersionId: candidate.productionAssetVersionId,
      bindingId: candidate.bindingId,
      matchedRules: candidate.matchedRules,
      scoreFacts: candidate.scoreFacts,
    }));
    const gaps = input.referenceUsages.filter((usage) => !matchedUsages.has(usage));
    const result = {
      policyVersion: ASSET_CANDIDATE_POLICY_VERSION,
      inputHash: canonicalCandidateRequirementHash(input),
      resolvedIdentity: identity,
      eligible,
      rejected,
      gaps: eligible.length === 0 ? [...gaps, "NO_ELIGIBLE_CANDIDATE" as const] : gaps,
      formalSelectionCreated: false as const,
    };
    return assetCandidateResultSchema.parse(result);
  }

  private async resolveIdentity(input: AssetCandidateRequirement) {
    let versionId = input.productionAssetVersionId;
    const characterStateVersionId = input.characterStateVersionId;
    if (characterStateVersionId) {
      const state = await this.client.characterStateVersion.findUnique({
        where: { id: characterStateVersionId },
        include: { characterVersion: true },
      });
      if (!state || state.projectId !== input.projectId) {
        throw new ProjectAssetError(
          "WRONG_CHARACTER_STATE",
          "Character state was not found in this project",
          409,
        );
      }
      if (state.status !== "ACTIVE") {
        throw new ProjectAssetError("INACTIVE_ASSET", "Character state is not active", 409);
      }
      versionId ??= state.characterVersion.productionAssetVersionId;
      if (input.characterVersionId && state.characterVersionId !== input.characterVersionId) {
        throw new ProjectAssetError(
          "WRONG_CHARACTER_STATE",
          "Character state does not match the requested character version",
          409,
        );
      }
    }
    if (!versionId && input.characterProfileId) {
      const character = await this.client.characterProfile.findUnique({
        where: { id: input.characterProfileId },
        include: { productionAsset: true },
      });
      if (!character || character.projectId !== input.projectId) {
        throw new ProjectAssetError(
          "WRONG_IDENTITY",
          "Character was not found in this project",
          409,
        );
      }
      versionId = character.productionAsset.currentVersionId ?? undefined;
    }
    if (!versionId && input.productionAssetId) {
      const productionAsset = await this.client.productionAsset.findUnique({
        where: { id: input.productionAssetId },
      });
      if (!productionAsset || productionAsset.projectId !== input.projectId) {
        throw new ProjectAssetError(
          "WRONG_IDENTITY",
          "Production asset was not found in this project",
          409,
        );
      }
      versionId = productionAsset.currentVersionId ?? undefined;
    }
    if (!versionId)
      throw new ProjectAssetError(
        "NO_ELIGIBLE_CANDIDATE",
        "No active asset version is available",
        409,
      );
    const version = await this.client.productionAssetVersion.findUnique({
      where: { id: versionId },
      include: { productionAsset: true },
    });
    if (
      !version ||
      version.projectId !== input.projectId ||
      version.productionAsset.type !== input.assetType
    ) {
      throw new ProjectAssetError(
        "WRONG_IDENTITY",
        "Requested asset version does not match this requirement",
        409,
      );
    }
    if (version.status !== "ACTIVE" && !input.productionAssetVersionId) {
      throw new ProjectAssetError("INACTIVE_ASSET", "No active asset version is available", 409);
    }
    return {
      productionAssetVersionId: version.id,
      characterStateVersionId: characterStateVersionId ?? null,
      versionId: version.id,
    };
  }
}
