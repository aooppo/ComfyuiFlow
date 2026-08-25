import { randomUUID } from "node:crypto";
import type { CreateContinuityVersionV1 } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import type { Prisma } from "./generated/client/index.js";
import {
  continuityDecisionSchema,
  continuitySuggestionSchema,
  createContinuityVersionSchema,
  type ContinuityDecisionInput,
  type ContinuitySuggestionInput,
  type CreateContinuityVersionInput,
} from "./continuity-contracts.js";
import {
  buildContinuitySuggestion,
  CONTINUITY_REGISTRY_VERSION,
  preflightContinuityData,
  type ContinuitySeedAsset,
} from "./continuity-registry.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

const versionInclude = {
  subjects: { include: { rules: true }, orderBy: [{ kind: "asc" }, { label: "asc" }] },
  boundaries: { orderBy: { boundaryIndex: "asc" } },
  shotStates: { include: { storyboardShot: true }, orderBy: { ordinal: "asc" } },
  decisions: { orderBy: { createdAt: "desc" } },
  keyframePlans: { orderBy: { createdAt: "desc" }, take: 10 },
} satisfies Prisma.ContinuityProfileVersionInclude;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function assetKind(type: string): ContinuitySeedAsset["kind"] | null {
  if (type === "SCENE") return "ENVIRONMENT";
  if (type === "CHARACTER") return "CHARACTER";
  if (type === "PROP") return "PROP";
  if (type === "OTHER") return null;
  if (["VOICE", "LORA", "HAIR", "MAKEUP", "ACCESSORY", "OUTFIT"].includes(type)) return null;
  return "PRODUCT";
}

export class ContinuityService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async getForStoryboard(storyboardId: string) {
    const storyboard = await this.client.storyboard.findUnique({
      where: { id: storyboardId },
      include: {
        approvedVersion: { include: { shots: { orderBy: { ordinal: "asc" } }, manifest: true } },
        continuityProfile: {
          include: {
            headVersion: { include: versionInclude },
            approvedVersion: { select: { id: true, versionNumber: true, outputHash: true } },
          },
        },
      },
    });
    if (!storyboard) throw this.error("CONTINUITY_NOT_FOUND", "Storyboard was not found", 404);
    const eligible = Boolean(
      storyboard.status === "ACTIVE" &&
      storyboard.approvedVersion &&
      storyboard.approvedVersion.manifest &&
      storyboard.approvedVersion.shots.length >= 1 &&
      storyboard.approvedVersion.shots.length <= 20,
    );
    const preflight = storyboard.continuityProfile?.headVersion
      ? await this.preflight(storyboard.continuityProfile.headVersion.id)
      : null;
    return {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      storyboardRowVersion: storyboard.rowVersion,
      title: storyboard.title,
      eligible,
      blockers: eligible ? [] : ["需要先批准含完整素材绑定的 1–20 镜 Storyboard"],
      profile: storyboard.continuityProfile,
      preflight,
      externalCalls: 0 as const,
    };
  }

  async suggest(storyboardId: string, rawInput: ContinuitySuggestionInput) {
    const input = continuitySuggestionSchema.parse(rawInput);
    const storyboard = await this.client.storyboard.findUnique({
      where: { id: storyboardId },
      include: {
        continuityProfile: true,
        approvedVersion: {
          include: {
            shots: { orderBy: { ordinal: "asc" } },
            manifest: {
              include: {
                bindings: {
                  include: {
                    productionAssetVersion: { include: { productionAsset: true } },
                    assetVersionFile: true,
                    projectAsset: { include: { storedObject: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!storyboard) throw this.error("CONTINUITY_NOT_FOUND", "Storyboard was not found", 404);
    if (storyboard.rowVersion !== input.expectedStoryboardRowVersion)
      throw this.error("CONTINUITY_CONFLICT", "Storyboard changed; refresh before continuing", 409);
    const approved = storyboard.approvedVersion;
    if (
      storyboard.status !== "ACTIVE" ||
      !approved?.manifest ||
      approved.shots.length < 1 ||
      approved.shots.length > 20
    )
      throw this.error(
        "CONTINUITY_NOT_ELIGIBLE",
        "Approve a complete 1–20 shot Storyboard before continuity setup",
        409,
      );

    const seen = new Set<string>();
    const assets: ContinuitySeedAsset[] = [];
    for (const binding of approved.manifest.bindings) {
      if (seen.has(binding.productionAssetVersionId)) continue;
      const kind = assetKind(binding.productionAssetVersion.productionAsset.type);
      if (!kind) continue;
      seen.add(binding.productionAssetVersionId);
      assets.push({
        subjectKey: `${kind.toLowerCase()}:${binding.productionAssetVersionId}`,
        kind,
        label: binding.productionAssetVersion.displayName,
        productionAssetVersionId: binding.productionAssetVersionId,
        assetVersionFileId: binding.assetVersionFileId,
        sourceSha256: binding.projectAsset.storedObject.sha256,
        facts: {
          description: binding.productionAssetVersion.description ?? "",
          referenceUsage: binding.assetVersionFile.referenceUsage,
        },
      });
    }
    const suggestion = buildContinuitySuggestion({ assets, shots: approved.shots });
    return this.appendVersion(storyboard, approved.id, approved.manifest.id, {
      ...suggestion,
      expectedRowVersion: storyboard.continuityProfile?.rowVersion ?? 0,
      parentVersionId: storyboard.continuityProfile?.headVersionId ?? undefined,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async save(profileId: string, rawInput: CreateContinuityVersionInput) {
    const input = createContinuityVersionSchema.parse(rawInput);
    const profile = await this.client.continuityProfile.findUnique({
      where: { id: profileId },
      include: {
        storyboard: true,
        headVersion: true,
      },
    });
    if (!profile) throw this.error("CONTINUITY_NOT_FOUND", "Continuity profile was not found", 404);
    if (!profile.headVersion || input.parentVersionId !== profile.headVersion.id)
      throw this.error("PROFILE_STALE", "A newer continuity version exists", 409);
    if (profile.rowVersion !== input.expectedRowVersion)
      throw this.error("CONTINUITY_CONFLICT", "Continuity profile changed; refresh first", 409);
    return this.appendVersion(
      { ...profile.storyboard, continuityProfile: profile },
      profile.headVersion.storyboardVersionId,
      profile.headVersion.manifestId,
      input,
    );
  }

  async preflight(versionId: string) {
    const version = await this.getVersion(versionId);
    const data = {
      subjects: version.subjects.map((subject) => ({
        subjectKey: subject.subjectKey,
        kind: subject.kind,
        label: subject.label,
        productionAssetVersionId: subject.productionAssetVersionId,
        assetVersionFileId: subject.assetVersionFileId,
        sourceSha256: subject.sourceSha256,
        facts: subject.factsJson as Record<string, unknown>,
        rules: subject.rules.map((rule) => ({
          propertyKey: rule.propertyKey,
          policy: rule.policy,
          importance: rule.importance,
          expectedValue: rule.expectedValueJson,
          explanation: rule.explanation ?? undefined,
        })),
      })),
      boundaries: version.boundaries.map((boundary) => ({
        boundaryIndex: boundary.boundaryIndex,
        label: boundary.label,
        state: boundary.stateJson as Record<string, unknown>,
      })),
      shots: version.shotStates.map((shot) => ({
        storyboardShotId: shot.storyboardShotId,
        ordinal: shot.ordinal,
        startBoundaryIndex: version.boundaries.find(
          (boundary) => boundary.id === shot.startBoundaryId,
        )!.boundaryIndex,
        endBoundaryIndex: version.boundaries.find((boundary) => boundary.id === shot.endBoundaryId)!
          .boundaryIndex,
        declaredChanges: shot.declaredChangesJson as Record<string, unknown>,
      })),
    };
    const result = preflightContinuityData(version.id, data);
    const profile = await this.client.continuityProfile.findUnique({
      where: { id: version.continuityProfileId },
      include: { storyboard: true },
    });
    if (
      !profile ||
      profile.storyboard.approvedVersionId !== version.storyboardVersionId ||
      profile.storyboard.status !== "ACTIVE"
    ) {
      const stale = {
        severity: "BLOCKER" as const,
        code: "PROFILE_STALE",
        subjectKey: null,
        shotOrdinal: null,
        boundaryIndex: null,
        message: "Storyboard 批准版本已经变化，请创建新的一致性版本",
        actions: ["SELECT_APPROVED_REFERENCE" as const],
      };
      const core = {
        ...result,
        ready: false,
        blockers: [...result.blockers, stale],
        preflightHash: undefined,
      };
      return { ...core, preflightHash: canonicalSha256(core) };
    }
    return result;
  }

  async decide(versionId: string, rawInput: ContinuityDecisionInput) {
    const input = continuityDecisionSchema.parse(rawInput);
    const version = await this.getVersion(versionId);
    const preflight = await this.preflight(version.id);
    if (preflight.preflightHash !== input.preflightHash)
      throw this.error("PROFILE_STALE", "Continuity preflight changed; review it again", 409);
    if (input.decision === "APPROVED" && !preflight.ready)
      throw this.error("CONTINUITY_CONFLICT", "Resolve blocking continuity conflicts first", 409);
    return this.client.$transaction(async (tx) => {
      const existing = await tx.continuityDecision.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
      const decision = await tx.continuityDecision.create({
        data: {
          projectId: version.projectId,
          continuityProfileId: version.continuityProfileId,
          continuityProfileVersionId: version.id,
          decision: input.decision,
          preflightHash: input.preflightHash,
          idempotencyKey: input.idempotencyKey,
          notes: input.notes ?? null,
        },
      });
      await tx.continuityProfile.update({
        where: { id: version.continuityProfileId },
        data: {
          approvedVersionId: input.decision === "APPROVED" ? version.id : null,
          rowVersion: { increment: 1 },
        },
      });
      return decision;
    });
  }

  async getVersion(versionId: string) {
    const version = await this.client.continuityProfileVersion.findUnique({
      where: { id: versionId },
      include: versionInclude,
    });
    if (!version) throw this.error("CONTINUITY_NOT_FOUND", "Continuity version was not found", 404);
    return version;
  }

  private async appendVersion(
    storyboard: {
      id: string;
      projectId: string;
      continuityProfile?: { id: string; rowVersion: number; headVersionId: string | null } | null;
    },
    storyboardVersionId: string,
    manifestId: string,
    rawInput: CreateContinuityVersionV1,
  ) {
    const input = createContinuityVersionSchema.parse(rawInput);
    const existing = await this.client.continuityProfileVersion.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: versionInclude,
    });
    if (existing) return existing;
    const outputCore = {
      registryVersion: CONTINUITY_REGISTRY_VERSION,
      storyboardVersionId,
      manifestId,
      subjects: input.subjects,
      boundaries: input.boundaries,
      shots: input.shots,
    };
    const inputHash = canonicalSha256({
      storyboardVersionId,
      manifestId,
      parent: input.parentVersionId ?? null,
    });
    const outputHash = canonicalSha256(outputCore);

    return this.client.$transaction(async (tx) => {
      let profile = await tx.continuityProfile.findUnique({
        where: { storyboardId: storyboard.id },
      });
      if (!profile) {
        profile = await tx.continuityProfile.create({
          data: { projectId: storyboard.projectId, storyboardId: storyboard.id },
        });
      } else if (
        profile.rowVersion !== input.expectedRowVersion ||
        profile.headVersionId !== (input.parentVersionId ?? null)
      ) {
        throw this.error("CONTINUITY_CONFLICT", "Continuity profile changed; refresh first", 409);
      }
      const versionId = randomUUID();
      const versionNumber = profile.rowVersion + 1;
      await tx.continuityProfileVersion.create({
        data: {
          id: versionId,
          projectId: storyboard.projectId,
          continuityProfileId: profile.id,
          storyboardVersionId,
          manifestId,
          parentVersionId: input.parentVersionId ?? null,
          versionNumber,
          registryVersion: CONTINUITY_REGISTRY_VERSION,
          inputHash,
          outputHash,
          idempotencyKey: input.idempotencyKey,
        },
      });
      for (const subject of input.subjects) {
        const subjectId = randomUUID();
        await tx.continuitySubject.create({
          data: {
            id: subjectId,
            projectId: storyboard.projectId,
            continuityProfileVersionId: versionId,
            subjectKey: subject.subjectKey,
            kind: subject.kind,
            label: subject.label,
            productionAssetVersionId: subject.productionAssetVersionId ?? null,
            assetVersionFileId: subject.assetVersionFileId ?? null,
            sourceSha256: subject.sourceSha256 ?? null,
            factsJson: json(subject.facts),
            rules: {
              create: subject.rules.map((rule) => ({
                propertyKey: rule.propertyKey,
                policy: rule.policy,
                importance: rule.importance,
                expectedValueJson: json(rule.expectedValue),
                explanation: rule.explanation ?? null,
              })),
            },
          },
        });
      }
      const boundaryIds = new Map<number, string>();
      for (const boundary of input.boundaries) {
        const id = randomUUID();
        boundaryIds.set(boundary.boundaryIndex, id);
        await tx.shotBoundary.create({
          data: {
            id,
            continuityProfileVersionId: versionId,
            boundaryIndex: boundary.boundaryIndex,
            label: boundary.label,
            stateJson: json(boundary.state),
            stateHash: canonicalSha256(boundary.state),
          },
        });
      }
      for (const shot of input.shots) {
        const startBoundaryId = boundaryIds.get(shot.startBoundaryIndex);
        const endBoundaryId = boundaryIds.get(shot.endBoundaryIndex);
        if (!startBoundaryId || !endBoundaryId)
          throw this.error("CONTINUITY_CONFLICT", "Shot boundary is missing", 422);
        await tx.shotContinuityState.create({
          data: {
            projectId: storyboard.projectId,
            continuityProfileVersionId: versionId,
            storyboardShotId: shot.storyboardShotId,
            ordinal: shot.ordinal,
            startBoundaryId,
            endBoundaryId,
            declaredChangesJson: json(shot.declaredChanges),
          },
        });
      }
      await tx.continuityProfile.update({
        where: { id: profile.id },
        data: { headVersionId: versionId, rowVersion: { increment: 1 } },
      });
      return tx.continuityProfileVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: versionInclude,
      });
    });
  }

  private error(code: string, message: string, status: number) {
    return new ProjectAssetError(code, message, status);
  }
}
