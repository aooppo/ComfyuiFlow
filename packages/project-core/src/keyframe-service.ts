import { readFile } from "node:fs/promises";
import {
  CodexManagerKeyframeImageProvider,
  FakeKeyframeImageProvider,
  type KeyframeImageProvider,
  type KeyframeReferenceImage,
} from "@comfyuiflow/ai-providers";
import type {
  AuthorizeKeyframePlanV1Schema,
  CreateKeyframePlanV1Schema,
  KeyframeDecisionInputV1Schema,
  KeyframeProviderProfileId,
  PreviewKeyframePlanV1Schema,
} from "@comfyuiflow/contracts";
import { KeyframePlanPreviewV1Schema } from "@comfyuiflow/contracts";
import type { z } from "zod";
import { canonicalSha256 } from "./canonical-json.js";
import { ProjectAssetError } from "./contracts.js";
import { Prisma } from "./generated/client/index.js";
import {
  authorizeKeyframePlanSchema,
  createKeyframePlanSchema,
  keyframeDecisionSchema,
  previewKeyframePlanSchema,
} from "./keyframe-contracts.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { normalizeKeyframeImage } from "./keyframe-image-normalizer.js";
import { prisma, type ProjectPrisma } from "./prisma.js";
import { CONTINUITY_REGISTRY_VERSION } from "./continuity-registry.js";

type PreviewInput = z.infer<typeof PreviewKeyframePlanV1Schema>;
type CreateInput = z.infer<typeof CreateKeyframePlanV1Schema>;
type AuthorizeInput = z.infer<typeof AuthorizeKeyframePlanV1Schema>;
type DecisionInput = z.infer<typeof KeyframeDecisionInputV1Schema>;

interface KeyframeReferenceRecord {
  assetVersionFileId: string;
  projectAssetId: string;
  sha256: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  displayName: string;
  storageKey: string;
  byteSize: number;
  continuityPriority: number;
}

interface PromptSubject {
  kind: string;
  label: string;
  assetVersionFileId?: string | null | undefined;
  rules?: Array<{ policy?: string | undefined }> | undefined;
  facts?: unknown;
  factsJson?: unknown;
}

export function keyframeReferencePriority(subject: { kind: string; policy?: string | undefined }) {
  if (subject.kind === "ENVIRONMENT") return 0;
  if (subject.kind === "PRODUCT") return 1;
  if (subject.kind === "PROP" && subject.policy !== "SHOT_CHANGE") return 1;
  if (subject.kind === "CHARACTER") return 2;
  if (subject.kind === "PROP") return 3;
  return 4;
}

interface PromptBoundary {
  label: string;
  state?: Record<string, unknown>;
  stateJson?: Record<string, unknown>;
}

function renderableBoundaryState(boundary: PromptBoundary) {
  const source = boundary.stateJson ?? boundary.state ?? {};
  return Object.fromEntries(
    Object.entries(source).map(([key, raw]) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [key, raw];
      const value = raw as Record<string, unknown>;
      const renderable = { ...value };
      delete renderable.continuityEvidence;
      return [key, renderable];
    }),
  );
}

export function compileContinuityKeyframePrompt(
  subjects: PromptSubject[],
  boundary: PromptBoundary,
) {
  const labels = subjects.map((subject) => subject.label).join("、");
  const productFacts = subjects
    .filter((subject) => subject.kind === "PRODUCT" || subject.kind === "PROP")
    .map((subject) => ({ label: subject.label, facts: subject.factsJson ?? subject.facts ?? {} }));
  const referenceOrder = subjects
    .filter((subject) => Boolean(subject.assetVersionFileId))
    .map((subject) => ({
      label: subject.label,
      assetVersionFileId: subject.assetVersionFileId ?? "",
      priority: keyframeReferencePriority({
        kind: subject.kind,
        policy: subject.rules?.[0]?.policy,
      }),
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.assetVersionFileId.localeCompare(right.assetVersionFileId),
    )
    .map((subject, index) => `Picture ${index + 1}=${subject.label}`)
    .join(", ");
  return [
    "Create one portrait continuity boundary frame for an approved video storyboard.",
    `Boundary: ${boundary.label}. Render only this shared boundary instant, before any next-shot action or final pose occurs.`,
    `Keep approved identities and layouts for: ${labels}.`,
    referenceOrder
      ? `REFERENCE ORDER IS AUTHORITATIVE: ${referenceOrder}. Picture 1 is the scene base canvas; edit it without redesigning its layout.`
      : "Use the approved scene reference as the base canvas and the remaining references only for identity preservation.",
    "PRODUCT AND PROP IDENTITY IS A HARD LOCK: reproduce every approved product or prop with the same silhouette and proportions. Keep the same tabletop shape, leg count, leg structure, joinery, material, and scale. Do not redesign or simplify it.",
    `Approved product and prop facts: ${JSON.stringify(productFacts)}.`,
    "SCENE INVENTORY IS PERSISTENT: preserve all architecture, furniture, books, lamps, lanterns, tabletop objects, and decor visible in the approved scene reference, with the same count and positions, unless the boundary explicitly declares that exact object moved or was removed.",
    'Physical presence and visibility are separate. "Not emphasized", "not a focus", or "out of frame" never means removed; keep the object physically in the scene.',
    `Exact renderable boundary state: ${JSON.stringify(renderableBoundaryState(boundary))}.`,
    "Do not depict future movement, a next-shot destination, or a later final composition.",
    "Do not add people, products, props, text, logos, or layout changes not present in references.",
  ].join("\n");
}

export class KeyframeService {
  private readonly providers: Record<KeyframeProviderProfileId, KeyframeImageProvider>;

  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly storage: StorageProvider = new LocalContentStorage(),
    environment: NodeJS.ProcessEnv = process.env,
    providers?: Partial<Record<KeyframeProviderProfileId, KeyframeImageProvider>>,
  ) {
    this.providers = {
      "fake-keyframe-v1": providers?.["fake-keyframe-v1"] ?? new FakeKeyframeImageProvider(),
      "codexmanager-gpt-image-2-v1":
        providers?.["codexmanager-gpt-image-2-v1"] ??
        new CodexManagerKeyframeImageProvider(environment),
    };
  }

  async preview(continuityProfileVersionId: string, rawInput: PreviewInput) {
    const input = previewKeyframePlanSchema.parse(rawInput);
    const provider = this.providers[input.providerProfileId];
    const version = await this.loadApprovedProfile(continuityProfileVersionId);
    const capability = provider.preview();
    const references = await this.resolveReferenceRecords(version.subjects);
    const blockers = [...capability.blockers];
    if (!capability.editing || !capability.multipleReferenceImages)
      blockers.push("KEYFRAME_CAPABILITY_UNAVAILABLE");
    if (references.length === 0) blockers.push("KEYFRAME_REFERENCES_MISSING");
    if (references.length > capability.maximumReferenceImages)
      blockers.push("KEYFRAME_REFERENCE_LIMIT_EXCEEDED");

    const referencesPublic = references.map((reference) => ({
      assetVersionFileId: reference.assetVersionFileId,
      projectAssetId: reference.projectAssetId,
      sha256: reference.sha256,
      displayName: reference.displayName,
    }));
    const referencesHash = canonicalSha256(referencesPublic);
    const targets = version.boundaries.map((boundary) => {
      const prompt = this.compilePrompt(version.subjects, boundary);
      const promptHash = canonicalSha256(prompt);
      return {
        boundaryId: boundary.id,
        boundaryIndex: boundary.boundaryIndex,
        label: boundary.label,
        stateHash: boundary.stateHash,
        referenceCount: references.length,
        referencesHash,
        promptHash,
        targetHash: canonicalSha256({
          profileOutputHash: version.outputHash,
          boundaryId: boundary.id,
          stateHash: boundary.stateHash,
          referencesHash,
          promptHash,
          capability,
        }),
      };
    });
    const ready = blockers.length === 0;
    const core = {
      schemaVersion: "keyframe-plan-preview-v1" as const,
      projectId: version.projectId,
      continuityProfileVersionId: version.id,
      capability,
      targets,
      maximumCalls: targets.length,
      estimatedMaximumCostUsd:
        capability.estimatedCostUsdPerImage === null
          ? null
          : capability.estimatedCostUsdPerImage * targets.length,
      noRetry: true as const,
      externalCalls: 0 as const,
      ready,
      blockers: [...new Set(blockers)],
    };
    return KeyframePlanPreviewV1Schema.parse({ ...core, planHash: canonicalSha256(core) });
  }

  async create(continuityProfileVersionId: string, rawInput: CreateInput) {
    const input = createKeyframePlanSchema.parse(rawInput);
    const preview = await this.preview(continuityProfileVersionId, {
      providerProfileId: input.providerProfileId,
    });
    if (preview.planHash !== input.planHash)
      throw this.error("KEYFRAME_SCOPE_CHANGED", "Keyframe preview changed; review it again", 409);
    if (!preview.ready)
      throw this.error(
        preview.blockers[0] ?? "KEYFRAME_CAPABILITY_UNAVAILABLE",
        "Keyframe provider is not ready for this exact batch",
        409,
      );
    const existing = await this.client.keyframePlanVersion.findUnique({
      where: { planHash: preview.planHash },
      include: { targets: { orderBy: { boundaryIndex: "asc" } } },
    });
    if (existing) return existing;
    const version = await this.loadApprovedProfile(continuityProfileVersionId);
    const references = await this.resolveReferenceRecords(version.subjects);
    return this.client.keyframePlanVersion.create({
      data: {
        projectId: preview.projectId,
        continuityProfileVersionId,
        providerProfileId: preview.capability.profileId,
        providerId: preview.capability.providerId,
        modelId: preview.capability.modelId,
        modelSnapshot: preview.capability.modelSnapshot,
        capabilitiesJson: preview.capability as Prisma.InputJsonValue,
        width: 768,
        height: 1344,
        quality: "low",
        priceFactsJson: {
          estimatedCostUsdPerImage: preview.capability.estimatedCostUsdPerImage,
          estimatedMaximumCostUsd: preview.estimatedMaximumCostUsd,
        },
        priceAsOf: preview.capability.priceAsOf ? new Date(preview.capability.priceAsOf) : null,
        priceExpiresAt: preview.capability.priceExpiresAt
          ? new Date(preview.capability.priceExpiresAt)
          : null,
        maximumCalls: preview.maximumCalls,
        planHash: preview.planHash,
        targets: {
          create: preview.targets.map((target) => ({
            shotBoundaryId: target.boundaryId,
            boundaryIndex: target.boundaryIndex,
            stateHash: target.stateHash,
            referencesJson: references.map((reference) => ({
              assetVersionFileId: reference.assetVersionFileId,
              projectAssetId: reference.projectAssetId,
              sha256: reference.sha256,
              mimeType: reference.mimeType,
              displayName: reference.displayName,
            })) as Prisma.InputJsonValue,
            referencesHash: target.referencesHash,
            prompt: this.compilePrompt(
              version.subjects,
              version.boundaries.find((boundary) => boundary.id === target.boundaryId)!,
            ),
            promptHash: target.promptHash,
            targetHash: target.targetHash,
          })),
        },
      },
      include: { targets: { orderBy: { boundaryIndex: "asc" } } },
    });
  }

  async authorize(planId: string, rawInput: AuthorizeInput) {
    const input = authorizeKeyframePlanSchema.parse(rawInput);
    const plan = await this.requireCurrentPlan(planId);
    if (input.planHash !== plan.planHash)
      throw this.error("KEYFRAME_SCOPE_CHANGED", "Keyframe plan changed", 409);
    if (input.maximumCalls !== plan.maximumCalls)
      throw this.error(
        "KEYFRAME_AUTHORIZATION_REQUIRED",
        "Confirm the exact image call limit",
        409,
      );
    const existing = await this.client.keyframeAuthorization.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const now = new Date();
    return this.client.keyframeAuthorization.create({
      data: {
        projectId: plan.projectId,
        keyframePlanVersionId: plan.id,
        planHash: plan.planHash,
        maximumCalls: input.maximumCalls,
        idempotencyKey: input.idempotencyKey,
        confirmedAt: now,
        expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1_000),
      },
    });
  }

  async execute(planId: string) {
    const plan = await this.requireCurrentPlan(planId);
    const provider = this.providers[plan.providerProfileId as KeyframeProviderProfileId];
    const authorization = plan.authorization;
    if (!authorization)
      throw this.error("KEYFRAME_AUTHORIZATION_REQUIRED", "Confirm this keyframe batch first", 409);
    if (authorization.expiresAt.getTime() <= Date.now())
      throw this.error("KEYFRAME_AUTHORIZATION_REQUIRED", "Keyframe authorization expired", 409);
    if (authorization.planHash !== plan.planHash)
      throw this.error("KEYFRAME_SCOPE_CHANGED", "Keyframe authorization no longer matches", 409);

    await this.client.keyframePlanVersion.update({
      where: { id: plan.id },
      data: { status: "RUNNING", rowVersion: { increment: 1 } },
    });
    for (const target of plan.targets) {
      if (target.attempts.length > 0) continue;
      const used = await this.client.keyframeAttempt.count({
        where: { keyframeAuthorizationId: authorization.id },
      });
      if (used >= authorization.maximumCalls)
        throw this.error("KEYFRAME_AUTHORIZATION_REQUIRED", "Image call budget is exhausted", 409);
      const requestHash = canonicalSha256({
        planHash: plan.planHash,
        targetHash: target.targetHash,
        authorizationId: authorization.id,
      });
      const attempt = await this.client.keyframeAttempt.create({
        data: {
          projectId: plan.projectId,
          keyframeAuthorizationId: authorization.id,
          keyframeTargetId: target.id,
          providerId: plan.providerId,
          modelSnapshot: plan.modelSnapshot,
          requestHash,
          safeResultCode: "ATTEMPT_CONSUMED",
        },
      });
      let providerStarted = false;
      try {
        const references = await this.readReferences(target.referencesJson as unknown[]);
        providerStarted = true;
        const result = await provider.generateOnce({
          requestHash,
          prompt: target.prompt,
          references,
          width: 768,
          height: 1344,
          quality: "low",
        });
        const normalized = await normalizeKeyframeImage(result.bytes, result.mimeType);
        const preserved = await this.storage.preserve(
          (async function* () {
            yield normalized.bytes;
          })(),
        );
        await this.client.$transaction([
          this.client.keyframeArtifact.create({
            data: {
              projectId: plan.projectId,
              keyframeAttemptId: attempt.id,
              storageKey: preserved.storageKey,
              sha256: preserved.sha256,
              byteSize: BigInt(preserved.byteSize),
              detectedMimeType: preserved.detectedMimeType,
              width: normalized.width,
              height: normalized.height,
            },
          }),
          this.client.keyframeAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "SUCCEEDED",
              safeResultCode: "KEYFRAME_RETAINED",
              providerCallCount: provider.external ? 1 : 0,
              responseId: result.responseId ?? null,
              usageJson: result.usage ? (result.usage as Prisma.InputJsonValue) : Prisma.JsonNull,
              costFactsJson: {
                ...(result.costFacts ?? {}),
                originalSha256: normalized.originalSha256,
                originalWidth: normalized.originalWidth,
                originalHeight: normalized.originalHeight,
                normalized: normalized.normalized,
              } as Prisma.InputJsonValue,
              finishedAt: new Date(),
            },
          }),
        ]);
      } catch (cause) {
        const ambiguous =
          providerStarted &&
          (cause instanceof TypeError || (cause instanceof Error && cause.name === "TimeoutError"));
        await this.client.$transaction([
          this.client.keyframeAttempt.update({
            where: { id: attempt.id },
            data: {
              status: ambiguous ? "AMBIGUOUS" : "FAILED",
              safeResultCode: ambiguous ? "KEYFRAME_ATTEMPT_AMBIGUOUS" : "KEYFRAME_ATTEMPT_FAILED",
              providerCallCount: providerStarted && provider.external ? 1 : 0,
              finishedAt: new Date(),
            },
          }),
          this.client.keyframePlanVersion.update({
            where: { id: plan.id },
            data: { status: "PAUSED", rowVersion: { increment: 1 } },
          }),
        ]);
        return this.getState(plan.id);
      }
    }
    await this.client.keyframePlanVersion.update({
      where: { id: plan.id },
      data: { status: "AWAITING_REVIEW", rowVersion: { increment: 1 } },
    });
    return this.getState(plan.id);
  }

  async decideArtifact(artifactId: string, rawInput: DecisionInput) {
    const input = keyframeDecisionSchema.parse(rawInput);
    const artifact = await this.client.keyframeArtifact.findUnique({
      where: { id: artifactId },
      include: { keyframeAttempt: { include: { keyframeTarget: true } } },
    });
    if (!artifact) throw this.error("KEYFRAME_NOT_FOUND", "Keyframe was not found", 404);
    await this.storage.resolveVerified(
      artifact.storageKey,
      artifact.sha256,
      Number(artifact.byteSize),
    );
    const existing = await this.client.keyframeDecision.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const decision = await this.client.keyframeDecision.create({
      data: {
        projectId: artifact.projectId,
        keyframeArtifactId: artifact.id,
        decision: input.decision,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes ?? null,
      },
    });
    await this.refreshReviewStatus(artifact.keyframeAttempt.keyframeTarget.keyframePlanVersionId);
    return decision;
  }

  async get(planId: string) {
    const plan = await this.client.keyframePlanVersion.findUnique({
      where: { id: planId },
      include: {
        authorization: true,
        targets: {
          orderBy: { boundaryIndex: "asc" },
          include: {
            shotBoundary: true,
            attempts: {
              include: {
                artifact: { include: { decisions: { orderBy: { createdAt: "desc" } } } },
              },
            },
          },
        },
      },
    });
    if (!plan) throw this.error("KEYFRAME_NOT_FOUND", "Keyframe plan was not found", 404);
    return plan;
  }

  async getState(planId: string) {
    const plan = await this.get(planId);
    return {
      id: plan.id,
      projectId: plan.projectId,
      continuityProfileVersionId: plan.continuityProfileVersionId,
      providerProfileId: plan.providerProfileId,
      providerId: plan.providerId,
      modelId: plan.modelId,
      modelSnapshot: plan.modelSnapshot,
      width: plan.width,
      height: plan.height,
      quality: plan.quality,
      maximumCalls: plan.maximumCalls,
      planHash: plan.planHash,
      status: plan.status,
      authorized: Boolean(plan.authorization),
      expiresAt: plan.authorization?.expiresAt ?? null,
      targets: plan.targets.map((target) => {
        const attempt = target.attempts[0] ?? null;
        const artifact = attempt?.artifact ?? null;
        return {
          boundaryIndex: target.boundaryIndex,
          label: target.shotBoundary.label,
          targetHash: target.targetHash,
          attemptStatus: attempt?.status ?? null,
          safeResultCode: attempt?.safeResultCode ?? null,
          artifact: artifact
            ? {
                id: artifact.id,
                sha256: artifact.sha256,
                width: artifact.width,
                height: artifact.height,
                mimeType: artifact.detectedMimeType,
                decision: artifact.decisions[0]?.decision ?? null,
              }
            : null,
        };
      }),
    };
  }

  async getArtifact(artifactId: string) {
    const artifact = await this.client.keyframeArtifact.findUnique({ where: { id: artifactId } });
    if (!artifact) throw this.error("KEYFRAME_NOT_FOUND", "Keyframe was not found", 404);
    const absolutePath = await this.storage.resolveVerified(
      artifact.storageKey,
      artifact.sha256,
      Number(artifact.byteSize),
    );
    return { artifact, absolutePath };
  }

  private async loadApprovedProfile(versionId: string) {
    const version = await this.client.continuityProfileVersion.findUnique({
      where: { id: versionId },
      include: {
        continuityProfile: { include: { storyboard: true } },
        subjects: { include: { rules: true }, orderBy: { subjectKey: "asc" } },
        boundaries: { orderBy: { boundaryIndex: "asc" } },
      },
    });
    if (!version) throw this.error("CONTINUITY_NOT_FOUND", "Continuity version was not found", 404);
    if (version.registryVersion !== CONTINUITY_REGISTRY_VERSION)
      throw this.error(
        "PROFILE_STALE",
        "Continuity rules changed after visual review; create and approve a new continuity version",
        409,
      );
    if (
      version.continuityProfile.approvedVersionId !== version.id ||
      version.continuityProfile.storyboard.approvedVersionId !== version.storyboardVersionId
    )
      throw this.error("PROFILE_STALE", "Approve this exact current continuity version first", 409);
    return version;
  }

  private async requireCurrentPlan(planId: string) {
    const plan = await this.get(planId);
    const version = await this.loadApprovedProfile(plan.continuityProfileVersionId);
    if (version.id !== plan.continuityProfileVersionId)
      throw this.error("KEYFRAME_SCOPE_CHANGED", "Continuity profile changed", 409);
    return plan;
  }

  private async resolveReferenceRecords(subjects: Array<any>): Promise<KeyframeReferenceRecord[]> {
    const ids = subjects
      .map((subject) => subject.assetVersionFileId)
      .filter((value): value is string => Boolean(value));
    const files = await this.client.assetVersionFile.findMany({
      where: { id: { in: ids } },
      include: { projectAsset: { include: { storedObject: true } } },
    });
    const subjectByFileId = new Map(
      subjects
        .filter((subject) => Boolean(subject.assetVersionFileId))
        .map((subject) => [subject.assetVersionFileId, subject]),
    );
    return files
      .filter(
        (file) =>
          file.status === "ACTIVE" &&
          file.approvalStatus === "ACCEPTED" &&
          file.projectAsset.status === "READY" &&
          file.projectAsset.storedObject.verificationStatus === "VERIFIED" &&
          ["image/png", "image/jpeg", "image/webp"].includes(
            file.projectAsset.storedObject.detectedMimeType,
          ),
      )
      .map((file) => ({
        assetVersionFileId: file.id,
        projectAssetId: file.projectAssetId,
        sha256: file.projectAsset.storedObject.sha256,
        mimeType: file.projectAsset.storedObject
          .detectedMimeType as KeyframeReferenceRecord["mimeType"],
        displayName: file.projectAsset.displayName,
        storageKey: file.projectAsset.storedObject.storageKey,
        byteSize: Number(file.projectAsset.storedObject.byteSize),
        continuityPriority: keyframeReferencePriority({
          kind: subjectByFileId.get(file.id)?.kind ?? "OTHER",
          policy: subjectByFileId.get(file.id)?.rules?.[0]?.policy,
        }),
      }))
      .sort(
        (a, b) =>
          a.continuityPriority - b.continuityPriority ||
          a.assetVersionFileId.localeCompare(b.assetVersionFileId),
      );
  }

  private async readReferences(raw: unknown[]): Promise<KeyframeReferenceImage[]> {
    const references = raw as Array<
      Omit<KeyframeReferenceRecord, "storageKey" | "byteSize" | "continuityPriority">
    >;
    const files = await this.client.assetVersionFile.findMany({
      where: { id: { in: references.map((reference) => reference.assetVersionFileId) } },
      include: { projectAsset: { include: { storedObject: true } } },
    });
    const byId = new Map(files.map((file) => [file.id, file]));
    const output: KeyframeReferenceImage[] = [];
    for (const reference of references) {
      const file = byId.get(reference.assetVersionFileId);
      if (!file || file.projectAsset.storedObject.sha256 !== reference.sha256)
        throw this.error("KEYFRAME_SCOPE_CHANGED", "A keyframe reference changed", 409);
      const absolutePath = await this.storage.resolveVerified(
        file.projectAsset.storedObject.storageKey,
        reference.sha256,
        Number(file.projectAsset.storedObject.byteSize),
      );
      output.push({
        sha256: reference.sha256,
        mimeType: reference.mimeType,
        filename: reference.displayName,
        bytes: await readFile(absolutePath),
      });
    }
    return output;
  }

  private compilePrompt(subjects: Array<any>, boundary: any) {
    return compileContinuityKeyframePrompt(subjects, boundary);
  }

  private async refreshReviewStatus(planId: string) {
    const plan = await this.get(planId);
    const latest = plan.targets.map(
      (target) => target.attempts[0]?.artifact?.decisions[0]?.decision,
    );
    const status = latest.every((decision) => decision === "APPROVED")
      ? "APPROVED"
      : latest.some((decision) => decision === "REJECTED")
        ? "REJECTED"
        : "AWAITING_REVIEW";
    await this.client.keyframePlanVersion.update({
      where: { id: plan.id },
      data: { status, rowVersion: { increment: 1 } },
    });
  }

  private error(code: string, message: string, status: number) {
    return new ProjectAssetError(code, message, status);
  }
}
