import { randomUUID } from "node:crypto";
import {
  GenerationPlanV3Schema,
  GenerationSpecV3Schema,
  TrialScopeApprovalCreateRequestV3Schema,
  TrialScopeApprovalHistoryV3Schema,
  TrialScopeApprovalV3Schema,
  TrialScopeRevocationRequestV3Schema,
  type GenerationImplementationV2,
  type TrialScopeApprovalItemV3,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";
import { ProjectAssetError } from "../contracts.js";
import type { Prisma } from "../generated/client/index.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { CapabilityRegistryLoader, type LoadedCapabilityRegistry } from "./capability-registry.js";

const approvalInclude = {
  items: { orderBy: { shotId: "asc" as const } },
  revocation: true,
} as const;

const refKey = (value: { id: string; version: string }) => `${value.id}@${value.version}`;

function requireIdempotencyKey(value: string | null) {
  const normalized = value?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(normalized))
    throw new ProjectAssetError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "A stable Idempotency-Key is required",
      400,
    );
  return normalized;
}

export function trialImplementationComposition(implementation: GenerationImplementationV2) {
  const costPolicyDigest = canonicalSha256(implementation.costPolicy);
  const core = {
    implementationRef: { id: implementation.id, version: implementation.version },
    runtimeRef: implementation.runtimeRef,
    providerRef: implementation.providerRef,
    modelRef: implementation.modelRef,
    adapterRef: implementation.adapterRef,
    compilerRef: implementation.compilerRef,
    costPolicyDigest,
  };
  return { ...core, compositionDigest: canonicalSha256(core) };
}

type ApprovalRecord = Prisma.TrialScopeApprovalGetPayload<{ include: typeof approvalInclude }>;

function approvalStatus(record: ApprovalRecord, now: Date) {
  if (record.revocation) return "REVOKED" as const;
  if (record.expiresAt.getTime() <= now.getTime()) return "EXPIRED" as const;
  return "ACTIVE" as const;
}

function approvalDto(record: ApprovalRecord, now: Date) {
  return TrialScopeApprovalV3Schema.parse({
    schemaVersion: "trial-scope-approval-v3",
    id: record.id,
    projectId: record.projectId,
    storyboardId: record.storyboardId,
    storyboardRevisionRef: {
      id: record.storyboardVersionId,
      version: record.storyboardVersionHash,
    },
    generationPlanRef: {
      id: record.generationPlanId,
      version: record.generationPlanVersion,
    },
    scopeDigest: record.scopeDigest,
    idempotencyKey: record.idempotencyKey,
    actorRef: record.actorRef,
    status: approvalStatus(record, now),
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    items: record.items.map((item) => ({
      shotId: item.shotId,
      generationSpecRef: { id: item.generationSpecId, version: item.generationSpecVersion },
      implementationRef: {
        id: item.implementationKey,
        version: item.implementationVersion,
      },
      runtimeRef: { id: item.runtimeKey, version: item.runtimeVersion },
      providerRef: { id: item.providerKey, version: item.providerVersion },
      modelRef: { id: item.modelKey, version: item.modelVersion },
      adapterRef: { id: item.adapterKey, version: item.adapterVersion },
      compilerRef: { id: item.compilerKey, version: item.compilerVersion },
      compiledRequestDigest: item.compiledRequestDigest,
      costPolicyDigest: item.costPolicyDigest,
      compositionDigest: item.compositionDigest,
    })),
    revocation: record.revocation
      ? {
          id: record.revocation.id,
          reasonCode: record.revocation.reasonCode,
          actorRef: record.revocation.actorRef,
          idempotencyKey: record.revocation.idempotencyKey,
          createdAt: record.revocation.createdAt.toISOString(),
        }
      : null,
    externalCalls: 0,
    generationAuthorized: false,
    executionAuthorized: false,
  });
}

export interface ActiveTrialScopeItem {
  approvalId: string;
  shotId: string;
  generationSpecRef: { id: string; version: string };
  implementationRef: { id: string; version: string };
  compiledRequestDigest: string;
  costPolicyDigest: string;
  compositionDigest: string;
}

export class TrialScopeApprovalService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly registryLoader = new CapabilityRegistryLoader(),
  ) {}

  async create(
    storyboardVersionId: string,
    rawRequest: unknown,
    rawIdempotencyKey: string | null,
    now = new Date(),
  ) {
    const request = TrialScopeApprovalCreateRequestV3Schema.parse(rawRequest);
    const idempotencyKey = requireIdempotencyKey(rawIdempotencyKey);
    const normalizedRequest = {
      generationPlanId: request.generationPlanId,
      selectedShotIds: [...request.selectedShotIds].sort(),
      expiresInSeconds: request.expiresInSeconds,
    };
    const requestHash = canonicalSha256(normalizedRequest);
    const version = await this.client.storyboardVersion.findUnique({
      where: { id: storyboardVersionId },
      include: { storyboard: true },
    });
    if (!version)
      throw new ProjectAssetError(
        "STORYBOARD_VERSION_NOT_FOUND",
        "Storyboard version was not found",
        404,
      );

    const existing = await this.client.trialScopeApproval.findUnique({
      where: {
        storyboardVersionId_idempotencyKey: { storyboardVersionId, idempotencyKey },
      },
      include: approvalInclude,
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ProjectAssetError(
          "TRIAL_SCOPE_IDEMPOTENCY_CONFLICT",
          "This approval key is already bound to a different trial scope",
          409,
        );
      return approvalDto(existing as ApprovalRecord, now);
    }

    if (version.storyboard.headVersionId !== version.id)
      throw new ProjectAssetError(
        "STORYBOARD_VERSION_STALE",
        "Trial scope requires the current saved Storyboard version",
        409,
      );
    const planRecord = await this.client.generationPlanV3Record.findUnique({
      where: { id: request.generationPlanId },
    });
    if (!planRecord || planRecord.projectId !== version.projectId)
      throw new ProjectAssetError(
        "TRIAL_SCOPE_PLAN_NOT_FOUND",
        "The reviewed zero-call plan was not found",
        404,
      );
    const plan = GenerationPlanV3Schema.parse(planRecord.payloadJson);
    const revisionMatches = plan.storyboardRevisionRefs.some(
      (reference) => reference.id === version.id && reference.version === version.contentHash,
    );
    if (!revisionMatches || plan.planDigest !== planRecord.planDigest)
      throw new ProjectAssetError(
        "TRIAL_SCOPE_PLAN_STALE",
        "The reviewed plan no longer matches this Storyboard version",
        409,
      );
    if (request.selectedShotIds.some((shotId) => !plan.shotIds.includes(shotId)))
      throw new ProjectAssetError(
        "TRIAL_SCOPE_SHOT_INVALID",
        "Every approved Shot must belong to the reviewed plan",
        422,
      );

    const planSpecRefs = new Map(plan.generationSpecRefs.map((item) => [item.id, item.version]));
    const specs = await this.client.generationSpecV3Record.findMany({
      where: {
        storyboardVersionId,
        shotId: { in: request.selectedShotIds },
      },
      orderBy: [{ shotId: "asc" }, { createdAt: "desc" }],
    });
    const specsByShot = new Map<string, (typeof specs)[number]>();
    for (const spec of specs) {
      if (specsByShot.has(spec.shotId)) continue;
      if (planSpecRefs.get(spec.id) !== spec.version) continue;
      specsByShot.set(spec.shotId, spec);
    }
    if (specsByShot.size !== request.selectedShotIds.length)
      throw new ProjectAssetError(
        "TRIAL_SCOPE_SPEC_MISMATCH",
        "The exact Generation Spec for each selected Shot is unavailable",
        409,
      );

    const registry = await this.registryLoader.load();
    const items: TrialScopeApprovalItemV3[] = normalizedRequest.selectedShotIds.map((shotId) => {
      const record = specsByShot.get(shotId)!;
      const spec = GenerationSpecV3Schema.parse(record.payloadJson);
      if (spec.id !== record.id || spec.version !== record.version)
        throw new ProjectAssetError(
          "TRIAL_SCOPE_SPEC_MISMATCH",
          "A selected Generation Spec changed",
          409,
        );
      const implementation = registry.implementationsByRef.get(refKey(spec.implementationRef));
      if (!implementation || implementation.lifecycle !== "TRIAL")
        throw new ProjectAssetError(
          "TRIAL_SCOPE_IMPLEMENTATION_NOT_TRIAL",
          "The selected implementation is not an exact first real trial",
          409,
        );
      const composition = trialImplementationComposition(implementation);
      if (
        refKey(spec.runtimeRef) !== refKey(implementation.runtimeRef) ||
        refKey(spec.providerRef) !== refKey(implementation.providerRef) ||
        refKey(spec.modelRef) !== refKey(implementation.modelRef) ||
        refKey(spec.adapterRef) !== refKey(implementation.adapterRef) ||
        refKey(spec.compilerRef) !== refKey(implementation.compilerRef)
      )
        throw new ProjectAssetError(
          "TRIAL_SCOPE_COMPOSITION_DRIFT",
          "The implementation composition changed after planning",
          409,
        );
      return {
        shotId,
        generationSpecRef: { id: spec.id, version: spec.version },
        implementationRef: spec.implementationRef,
        runtimeRef: spec.runtimeRef,
        providerRef: spec.providerRef,
        modelRef: spec.modelRef,
        adapterRef: spec.adapterRef,
        compilerRef: spec.compilerRef,
        compiledRequestDigest: spec.compiledRequestDigest,
        costPolicyDigest: composition.costPolicyDigest,
        compositionDigest: composition.compositionDigest,
      };
    });
    const expiresAt = new Date(now.getTime() + request.expiresInSeconds * 1_000);
    const scopeCore = {
      projectId: version.projectId,
      storyboardId: version.storyboardId,
      storyboardRevisionRef: { id: version.id, version: version.contentHash },
      generationPlanRef: { id: plan.id, version: plan.version },
      planDigest: plan.planDigest,
      items,
      expiresAt: expiresAt.toISOString(),
      actorRef: "owner-local",
    };
    const scopeDigest = canonicalSha256(scopeCore);

    try {
      const created = await this.client.trialScopeApproval.create({
        data: {
          id: randomUUID(),
          projectId: version.projectId,
          storyboardId: version.storyboardId,
          storyboardVersionId: version.id,
          storyboardVersionHash: version.contentHash,
          generationPlanId: plan.id,
          generationPlanVersion: plan.version,
          planDigest: plan.planDigest,
          requestHash,
          scopeDigest,
          idempotencyKey,
          actorRef: "owner-local",
          expiresAt,
          createdAt: now,
          items: {
            create: items.map((item) => ({
              id: randomUUID(),
              shotId: item.shotId,
              generationSpecId: item.generationSpecRef.id,
              generationSpecVersion: item.generationSpecRef.version,
              implementationKey: item.implementationRef.id,
              implementationVersion: item.implementationRef.version,
              runtimeKey: item.runtimeRef.id,
              runtimeVersion: item.runtimeRef.version,
              providerKey: item.providerRef.id,
              providerVersion: item.providerRef.version,
              modelKey: item.modelRef.id,
              modelVersion: item.modelRef.version,
              adapterKey: item.adapterRef.id,
              adapterVersion: item.adapterRef.version,
              compilerKey: item.compilerRef.id,
              compilerVersion: item.compilerRef.version,
              compiledRequestDigest: item.compiledRequestDigest,
              costPolicyDigest: item.costPolicyDigest,
              compositionDigest: item.compositionDigest,
              createdAt: now,
            })),
          },
        },
        include: approvalInclude,
      });
      return approvalDto(created as ApprovalRecord, now);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const winner = await this.client.trialScopeApproval.findUnique({
          where: {
            storyboardVersionId_idempotencyKey: { storyboardVersionId, idempotencyKey },
          },
          include: approvalInclude,
        });
        if (winner?.requestHash === requestHash) return approvalDto(winner as ApprovalRecord, now);
      }
      throw error;
    }
  }

  async list(storyboardVersionId: string, now = new Date()) {
    const version = await this.client.storyboardVersion.findUnique({
      where: { id: storyboardVersionId },
      select: { id: true, contentHash: true },
    });
    if (!version)
      throw new ProjectAssetError(
        "STORYBOARD_VERSION_NOT_FOUND",
        "Storyboard version was not found",
        404,
      );
    const approvals = await this.client.trialScopeApproval.findMany({
      where: { storyboardVersionId },
      include: approvalInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return TrialScopeApprovalHistoryV3Schema.parse({
      schemaVersion: "trial-scope-approval-history-v3",
      storyboardRevisionRef: { id: version.id, version: version.contentHash },
      approvals: approvals.map((record) => approvalDto(record as ApprovalRecord, now)),
      externalCalls: 0,
      generationAuthorized: false,
      executionAuthorized: false,
    });
  }

  async revoke(
    approvalId: string,
    rawRequest: unknown,
    rawIdempotencyKey: string | null,
    now = new Date(),
  ) {
    const request = TrialScopeRevocationRequestV3Schema.parse(rawRequest);
    const idempotencyKey = requireIdempotencyKey(rawIdempotencyKey);
    const approval = await this.client.trialScopeApproval.findUnique({
      where: { id: approvalId },
      include: approvalInclude,
    });
    if (!approval)
      throw new ProjectAssetError("TRIAL_SCOPE_NOT_FOUND", "Trial scope was not found", 404);
    if (approval.revocation) {
      if (
        approval.revocation.idempotencyKey !== idempotencyKey ||
        approval.revocation.reasonCode !== request.reasonCode
      )
        throw new ProjectAssetError(
          "TRIAL_SCOPE_ALREADY_REVOKED",
          "This trial scope is already revoked",
          409,
        );
      return approvalDto(approval as ApprovalRecord, now);
    }
    try {
      const revoked = await this.client.trialScopeApproval.update({
        where: { id: approvalId },
        data: {
          revocation: {
            create: {
              id: randomUUID(),
              reasonCode: request.reasonCode,
              actorRef: "owner-local",
              idempotencyKey,
              createdAt: now,
            },
          },
        },
        include: approvalInclude,
      });
      return approvalDto(revoked as ApprovalRecord, now);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const winner = await this.client.trialScopeApproval.findUnique({
          where: { id: approvalId },
          include: approvalInclude,
        });
        if (
          winner?.revocation?.idempotencyKey === idempotencyKey &&
          winner.revocation.reasonCode === request.reasonCode
        )
          return approvalDto(winner as ApprovalRecord, now);
      }
      throw error;
    }
  }

  async activeItemsByShot(
    storyboardVersionId: string,
    registry: LoadedCapabilityRegistry,
    now = new Date(),
  ): Promise<Map<string, Map<string, ActiveTrialScopeItem[]>>> {
    const approvals = await this.client.trialScopeApproval.findMany({
      where: { storyboardVersionId, expiresAt: { gt: now }, revocation: null },
      include: { items: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    const byShot = new Map<string, Map<string, ActiveTrialScopeItem[]>>();
    for (const approval of approvals) {
      for (const item of approval.items) {
        const implementationRef = {
          id: item.implementationKey,
          version: item.implementationVersion,
        };
        const implementation = registry.implementationsByRef.get(refKey(implementationRef));
        if (!implementation || implementation.lifecycle !== "TRIAL") continue;
        const composition = trialImplementationComposition(implementation);
        if (
          composition.costPolicyDigest !== item.costPolicyDigest ||
          composition.compositionDigest !== item.compositionDigest
        )
          continue;
        const refs = byShot.get(item.shotId) ?? new Map<string, ActiveTrialScopeItem[]>();
        const key = refKey(implementationRef);
        const candidates = refs.get(key) ?? [];
        candidates.push({
          approvalId: approval.id,
          shotId: item.shotId,
          generationSpecRef: {
            id: item.generationSpecId,
            version: item.generationSpecVersion,
          },
          implementationRef,
          compiledRequestDigest: item.compiledRequestDigest,
          costPolicyDigest: item.costPolicyDigest,
          compositionDigest: item.compositionDigest,
        });
        refs.set(key, candidates);
        byShot.set(item.shotId, refs);
      }
    }
    return byShot;
  }
}
