import { createHash } from "node:crypto";
import { ProjectAssetError } from "./contracts.js";
import {
  assetCandidateRequirementSchema,
  type AssetCandidateRequirement,
} from "./asset-candidate-contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

type CandidateReason =
  | "WRONG_IDENTITY"
  | "WRONG_VERSION"
  | "WRONG_CHARACTER_STATE"
  | "INACTIVE_ASSET"
  | "FILE_NOT_READY"
  | "UNAPPROVED_BINDING"
  | "REFERENCE_USAGE_MISSING"
  | "VIEWPOINT_MISMATCH"
  | "SHOT_SCALE_MISMATCH"
  | "MEDIA_CAPABILITY_MISMATCH";

export class AssetCandidateService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async preview(rawInput: AssetCandidateRequirement) {
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
    const eligible: Array<Record<string, unknown>> = [];
    const rejected: Array<Record<string, unknown>> = [];
    for (const binding of bindings) {
      const reasons = this.reasons(input, identity.versionId, binding);
      const candidate = {
        projectAssetId: binding.projectAssetId,
        productionAssetVersionId: binding.productionAssetVersionId,
        bindingId: binding.id,
      };
      if (reasons.length > 0) {
        rejected.push({ ...candidate, reasonCodes: reasons });
        continue;
      }
      const scoreFacts = {
        preferred: binding.isPreferred ? 1 : 0,
        usageExact: input.referenceUsages.includes(binding.referenceUsage) ? 1 : 0,
        viewpointExact:
          input.viewpoints.length === 0 || input.viewpoints.includes(binding.viewpoint) ? 1 : 0,
        shotScaleExact:
          input.shotScales.length === 0 || input.shotScales.includes(binding.shotScale) ? 1 : 0,
        effectivePixels: (binding.projectAsset.width ?? 0) * (binding.projectAsset.height ?? 0),
      };
      eligible.push({ ...candidate, scoreFacts });
    }
    eligible.sort((left, right) => {
      const a = left.scoreFacts as Record<string, number>;
      const b = right.scoreFacts as Record<string, number>;
      for (const key of [
        "preferred",
        "usageExact",
        "viewpointExact",
        "shotScaleExact",
        "effectivePixels",
      ]) {
        if (a[key] !== b[key]) return (b[key] ?? 0) - (a[key] ?? 0);
      }
      return String(left.bindingId).localeCompare(String(right.bindingId));
    });
    const matchedUsages = new Set(
      eligible.map(
        (candidate) =>
          bindings.find((binding) => binding.id === candidate.bindingId)?.referenceUsage,
      ),
    );
    const gaps = input.referenceUsages.filter((usage) => !matchedUsages.has(usage));
    if (eligible.length === 0 && !gaps.includes("NO_ELIGIBLE_CANDIDATE" as never)) {
      gaps.push("NO_ELIGIBLE_CANDIDATE" as never);
    }
    return {
      policyVersion: "deterministic-assets-v1" as const,
      inputHash: hashInput(input),
      resolvedIdentity: identity,
      eligible,
      rejected,
      gaps,
      formalSelectionCreated: false as const,
    };
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

  private reasons(
    input: AssetCandidateRequirement,
    expectedVersionId: string,
    binding: Awaited<ReturnType<ProjectPrisma["assetVersionFile"]["findMany"]>>[number] & {
      projectAsset: {
        storedObject: { detectedMimeType: string };
        status: string;
        mediaType: string;
        width: number | null;
        height: number | null;
      };
      productionAssetVersion: { status: string; productionAsset: { type: string; status: string } };
    },
  ): CandidateReason[] {
    const reasons: CandidateReason[] = [];
    if (binding.productionAssetVersionId !== expectedVersionId) reasons.push("WRONG_VERSION");
    if (binding.productionAssetVersion.productionAsset.type !== input.assetType)
      reasons.push("WRONG_IDENTITY");
    if (
      binding.productionAssetVersion.status !== "ACTIVE" ||
      binding.productionAssetVersion.productionAsset.status !== "ACTIVE" ||
      binding.status !== "ACTIVE"
    )
      reasons.push("INACTIVE_ASSET");
    if (binding.projectAsset.status !== "READY") reasons.push("FILE_NOT_READY");
    if (binding.approvalStatus !== "ACCEPTED") reasons.push("UNAPPROVED_BINDING");
    if (!input.referenceUsages.includes(binding.referenceUsage))
      reasons.push("REFERENCE_USAGE_MISSING");
    if (
      input.viewpoints.length > 0 &&
      !input.viewpoints.includes(binding.viewpoint) &&
      !(input.policy.allowUnspecifiedViewpoint && binding.viewpoint === "UNSPECIFIED")
    )
      reasons.push("VIEWPOINT_MISMATCH");
    if (
      input.shotScales.length > 0 &&
      !input.shotScales.includes(binding.shotScale) &&
      !(input.policy.allowUnspecifiedShotScale && binding.shotScale === "UNSPECIFIED")
    )
      reasons.push("SHOT_SCALE_MISMATCH");
    const capability = input.mediaCapability;
    if (
      binding.projectAsset.mediaType !== capability.mediaType ||
      (capability.acceptedMimeTypes.length > 0 &&
        !capability.acceptedMimeTypes.includes(
          binding.projectAsset.storedObject.detectedMimeType,
        )) ||
      (capability.minimumWidth !== undefined &&
        (binding.projectAsset.width ?? 0) < capability.minimumWidth) ||
      (capability.minimumHeight !== undefined &&
        (binding.projectAsset.height ?? 0) < capability.minimumHeight)
    )
      reasons.push("MEDIA_CAPABILITY_MISMATCH");
    return reasons;
  }
}

function hashInput(input: AssetCandidateRequirement) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
