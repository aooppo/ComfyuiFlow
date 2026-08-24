import { ProjectAssetError } from "./contracts.js";
import type { CreateCharacterState } from "./production-asset-contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const slotAssetTypes = {
  OUTFIT: "OUTFIT",
  HAIR: "HAIR",
  MAKEUP: "MAKEUP",
  ACCESSORY: "ACCESSORY",
} as const;

export class CharacterStateService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async createCharacterVersion(
    profileId: string,
    productionAssetVersionId: string,
    basedOnCharacterVersionId?: string,
  ) {
    const profile = await this.client.characterProfile.findUnique({
      where: { id: profileId },
      include: { productionAsset: true },
    });
    const assetVersion = await this.client.productionAssetVersion.findUnique({
      where: { id: productionAssetVersionId },
    });
    if (!profile || !assetVersion)
      throw new ProjectAssetError(
        "CHARACTER_NOT_FOUND",
        "Character profile or version was not found",
        404,
      );
    if (
      profile.productionAsset.type !== "CHARACTER" ||
      assetVersion.productionAssetId !== profile.productionAssetId ||
      assetVersion.projectId !== profile.projectId
    ) {
      throw new ProjectAssetError(
        "WRONG_IDENTITY",
        "Character version must belong to this character",
        409,
      );
    }
    const aggregate = await this.client.characterVersion.aggregate({
      where: { characterProfileId: profileId },
      _max: { versionNumber: true },
    });
    return this.client.characterVersion.create({
      data: {
        projectId: profile.projectId,
        characterProfileId: profileId,
        productionAssetVersionId,
        versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
        basedOnVersionId: basedOnCharacterVersionId ?? null,
      },
    });
  }

  async publishCharacterVersion(versionId: string) {
    const version = await this.client.characterVersion.findUnique({ where: { id: versionId } });
    if (!version)
      throw new ProjectAssetError(
        "CHARACTER_VERSION_NOT_FOUND",
        "Character version was not found",
        404,
      );
    if (version.status !== "DRAFT")
      throw new ProjectAssetError(
        "VERSION_IMMUTABLE",
        "Only draft character versions can be published",
        409,
      );
    return this.client.$transaction(async (tx) => {
      await tx.characterVersion.updateMany({
        where: { characterProfileId: version.characterProfileId, status: "ACTIVE" },
        data: { status: "RETIRED" },
      });
      return tx.characterVersion.update({
        where: { id: versionId },
        data: { status: "ACTIVE", publishedAt: new Date() },
      });
    });
  }

  async createState(characterVersionId: string, input: CreateCharacterState) {
    const characterVersion = await this.client.characterVersion.findUnique({
      where: { id: characterVersionId },
    });
    if (!characterVersion)
      throw new ProjectAssetError(
        "CHARACTER_VERSION_NOT_FOUND",
        "Character version was not found",
        404,
      );
    const aggregate = await this.client.characterStateVersion.aggregate({
      where: { characterVersionId, stateKey: input.stateKey },
      _max: { versionNumber: true },
    });
    return this.client.characterStateVersion.create({
      data: {
        projectId: characterVersion.projectId,
        characterVersionId,
        stateKey: input.stateKey,
        versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
        name: input.name,
        description: input.description ?? null,
      },
    });
  }

  async bindComponent(input: {
    stateVersionId: string;
    slotType: keyof typeof slotAssetTypes;
    componentAssetVersionId: string;
    slotKey: string;
    sortOrder: number;
    required: boolean;
  }) {
    const state = await this.client.characterStateVersion.findUnique({
      where: { id: input.stateVersionId },
    });
    const component = await this.client.productionAssetVersion.findUnique({
      where: { id: input.componentAssetVersionId },
      include: { productionAsset: true },
    });
    if (!state || !component)
      throw new ProjectAssetError(
        "CHARACTER_STATE_NOT_FOUND",
        "Character state or component was not found",
        404,
      );
    if (state.status !== "DRAFT")
      throw new ProjectAssetError("VERSION_IMMUTABLE", "Published states cannot be changed", 409);
    if (state.projectId !== component.projectId)
      throw new ProjectAssetError(
        "CROSS_PROJECT",
        "Component must belong to the same project",
        409,
      );
    if (component.productionAsset.type !== slotAssetTypes[input.slotType]) {
      throw new ProjectAssetError(
        "INVALID_STATE_COMPONENT",
        "Component type does not match the character state slot",
        409,
      );
    }
    return this.client.characterStateComponent.create({
      data: {
        projectId: state.projectId,
        characterStateVersionId: state.id,
        slotType: input.slotType,
        componentAssetVersionId: component.id,
        slotKey: input.slotKey,
        sortOrder: input.sortOrder,
        required: input.required,
      },
    });
  }

  async publishState(stateVersionId: string) {
    const state = await this.client.characterStateVersion.findUnique({
      where: { id: stateVersionId },
    });
    if (!state)
      throw new ProjectAssetError(
        "CHARACTER_STATE_NOT_FOUND",
        "Character state was not found",
        404,
      );
    if (state.status !== "DRAFT")
      throw new ProjectAssetError("VERSION_IMMUTABLE", "Only a draft state can be published", 409);
    return this.client.$transaction(async (tx) => {
      await tx.characterStateVersion.updateMany({
        where: {
          characterVersionId: state.characterVersionId,
          stateKey: state.stateKey,
          status: "ACTIVE",
        },
        data: { status: "RETIRED" },
      });
      const active = await tx.characterStateVersion.update({
        where: { id: state.id },
        data: { status: "ACTIVE", publishedAt: new Date() },
      });
      await tx.projectActivity.create({
        data: {
          projectId: state.projectId,
          type: "CHARACTER_STATE_PUBLISHED",
          summary: "Character state published",
        },
      });
      return active;
    });
  }
}
