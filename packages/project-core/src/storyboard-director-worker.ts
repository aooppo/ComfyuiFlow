import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  FakeStoryboardProvider,
  TerraStoryboardProvider,
  type AiModelProvider,
} from "@comfyuiflow/ai-providers";
import {
  validateStoryboardProposalV2,
  type StoryboardGenerationRequestV2,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";
import { LocalContentStorage, type StorageProvider } from "./local-storage.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export class StoryboardDirectorWorker {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly providers: Record<string, AiModelProvider> = {
      fake: new FakeStoryboardProvider(),
      "codexmanager-local": new TerraStoryboardProvider("codexmanager-local"),
      openai: new TerraStoryboardProvider("openai"),
    },
    private readonly storage: StorageProvider = new LocalContentStorage(),
  ) {}

  async processNext(workerId = "storyboard-director-worker") {
    const now = new Date();
    await this.client.$transaction(async (tx) => {
      const expired = await tx.storyboardDirectorRun.findMany({
        where: { status: "RUNNING", leaseExpiresAt: { lt: now } },
        select: { id: true },
      });
      for (const run of expired) {
        await tx.storyboardDirectorAttempt.updateMany({
          where: { runId: run.id, status: "STARTED" },
          data: { status: "AMBIGUOUS", safeResultCode: "DIRECTOR_WORKER_LOST", finishedAt: now },
        });
        await tx.storyboardDirectorRun.update({
          where: { id: run.id },
          data: {
            status: "AMBIGUOUS",
            safeResultCode: "DIRECTOR_WORKER_LOST",
            finishedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      }
    });
    const leased = await this.client.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "StoryboardDirectorRun" WHERE status = 'QUEUED'
        ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1`;
      const id = candidates[0]?.id;
      if (!id) return null;
      await tx.storyboardDirectorRun.update({
        where: { id },
        data: {
          status: "RUNNING",
          safeResultCode: "DIRECTOR_RUNNING",
          leaseOwner: workerId,
          leaseExpiresAt: new Date(now.valueOf() + 60_000),
        },
      });
      const run = await tx.storyboardDirectorRun.findUniqueOrThrow({
        where: { id },
        include: {
          storyboard: true,
          inputReferences: { orderBy: { ordinal: "asc" } },
          authorization: true,
        },
      });
      if (!run.authorization || run.authorization.consumedAt || run.authorization.expiresAt <= now)
        throw new Error("DIRECTOR_AUTHORIZATION_UNAVAILABLE");
      await tx.storyboardDirectorAuthorization.update({
        where: { runId: id },
        data: { consumedAt: now },
      });
      const attempt = await tx.storyboardDirectorAttempt.create({
        data: {
          projectId: run.projectId,
          runId: id,
          ordinal: 1,
          status: "STARTED",
          safeResultCode: "DIRECTOR_ATTEMPT_STARTED",
        },
      });
      await tx.storyboardDirectorRun.update({
        where: { id },
        data: { providerCallCount: run.providerId === "fake" ? 0 : 1 },
      });
      return { run, attemptId: attempt.id };
    });
    if (!leased) return null;
    const { run, attemptId } = leased;
    try {
      const head = await this.client.storyboardVersion.findUniqueOrThrow({
        where: { id: run.headVersionId! },
        include: { shots: { orderBy: { ordinal: "asc" } } },
      });
      const requestReferences = await Promise.all(
        run.inputReferences.map(async (reference) => {
          const file = await this.client.assetVersionFile.findUniqueOrThrow({
            where: { id: reference.assetVersionFileId },
            include: { projectAsset: { include: { storedObject: true } } },
          });
          const absolutePath = await this.storage.resolveVerified(
            file.projectAsset.storedObject.storageKey,
            reference.sha256,
            Number(reference.byteSize),
          );
          return {
            alias: reference.alias,
            kind: reference.kind,
            displayName: reference.displayName,
            semanticFacts: reference.semanticFactsJson,
            imageDataUrl: `data:${file.projectAsset.storedObject.detectedMimeType};base64,${(await readFile(absolutePath)).toString("base64")}`,
          };
        }),
      );
      const blockedIndex =
        run.runKind === "SHOT_REPAIR"
          ? head.shots.findIndex((shot) => shot.shotKey === run.blockedShotKey)
          : -1;
      if (run.runKind === "SHOT_REPAIR" && blockedIndex < 0)
        throw new Error("DIRECTOR_REPAIR_SOURCE_INVALID");
      const blocked = blockedIndex >= 0 ? head.shots[blockedIndex] : null;
      const previous = blockedIndex > 0 ? head.shots[blockedIndex - 1] : null;
      const next = blockedIndex >= 0 ? head.shots[blockedIndex + 1] : null;
      const repairBrief = blocked
        ? [
            run.storyboard.creativeBrief,
            `SHOT_REPAIR ${run.repairAction}: replace only Shot ${blocked.ordinal} (${blocked.shotKey}).`,
            `Preserve incoming state: ${previous?.endState ?? blocked.startState}`,
            `Blocked Shot: start=${blocked.startState}; action=${blocked.action}; end=${blocked.endState}; camera=${blocked.camera}; composition=${blocked.composition}.`,
            `Preserve outgoing state: ${next?.startState ?? blocked.endState}`,
            run.repairAction === "REWRITE_SHOT"
              ? "Return exactly one replacement Shot."
              : "Return exactly two contiguous replacement Shots whose first start and final end preserve the boundary states.",
          ].join("\n")
        : run.storyboard.creativeBrief;
      const request: StoryboardGenerationRequestV2 = {
        taskType: "STORYBOARD_GENERATION_V2",
        contractVersion: "storyboard-generation-v2",
        promptTemplateVersion: "storyboard-director-v2",
        modelRef: { providerId: run.providerId, modelId: run.requestedModelId },
        creativeBrief: repairBrief,
        maxShotCount: run.maxShotCount ?? 3,
        currentHead: {
          versionNumber: head.versionNumber,
          contentHash: run.headContentHash!,
        },
        references: requestReferences as StoryboardGenerationRequestV2["references"],
      };
      const provider = this.providers[run.providerId];
      if (!provider?.generateStoryboardV2) throw new Error("DIRECTOR_PROVIDER_UNAVAILABLE");
      const raw = await provider.generateStoryboardV2(request);
      const proposal = validateStoryboardProposalV2(raw, request);
      if (
        (run.runKind === "SHOT_REPAIR" &&
          run.repairAction === "REWRITE_SHOT" &&
          proposal.shots.length !== 1) ||
        (run.runKind === "SHOT_REPAIR" &&
          run.repairAction === "SPLIT_SHOT" &&
          proposal.shots.length !== 2)
      )
        throw new Error("DIRECTOR_REPAIR_SHOT_COUNT_INVALID");
      const normalizedBase = { narrativeSummary: proposal.narrativeSummary, shots: proposal.shots };
      const outputHash = canonicalSha256(normalizedBase);
      const normalized = {
        narrativeSummary: proposal.narrativeSummary,
        shots: proposal.shots.map((shot) => ({
          ...shot,
          shotKey:
            run.runKind === "SHOT_REPAIR" && run.repairAction === "REWRITE_SHOT"
              ? run.blockedShotKey!
              : run.runKind === "SHOT_REPAIR"
                ? stableUuid(`${run.impactHash}:${outputHash}:${shot.ordinal}`)
                : stableUuid(`${outputHash}:${shot.ordinal}`),
        })),
      };
      return await this.client.$transaction(async (tx) => {
        const saved = await tx.storyboardDirectorProposal.create({
          data: {
            projectId: run.projectId,
            storyboardId: run.storyboardId,
            runId: run.id,
            narrativeSummary: proposal.narrativeSummary,
            normalizedProposalJson: normalized as never,
            outputHash,
            proposalKind: run.runKind,
            ...(run.runKind === "SHOT_REPAIR"
              ? {
                  affectedShotKeysJson: [run.blockedShotKey!] as never,
                  repairPayloadJson: {
                    sourceStoryboardVersionId: run.sourceStoryboardVersionId,
                    blockedShotKey: run.blockedShotKey,
                    action: run.repairAction,
                    replacementShotKeys: normalized.shots.map((shot) => shot.shotKey),
                  } as never,
                  impactHash: run.impactHash,
                }
              : {}),
          },
        });
        await tx.storyboardDirectorAttempt.update({
          where: { id: attemptId },
          data: {
            status: "SUCCEEDED",
            actualModelId: proposal.resolvedModelId,
            responseId: proposal.responseId,
            safeResultCode: "DIRECTOR_PROPOSAL_CREATED",
            finishedAt: new Date(),
          },
        });
        await tx.storyboardDirectorRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            resolvedModelId: proposal.resolvedModelId,
            responseId: proposal.responseId,
            safeResultCode: "DIRECTOR_COMPLETED",
            finishedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        return saved;
      });
    } catch (cause) {
      const ambiguous =
        cause instanceof Error && /timeout|network|fetch|ambiguous/i.test(cause.message);
      await this.client.$transaction(async (tx) => {
        await tx.storyboardDirectorAttempt.update({
          where: { id: attemptId },
          data: {
            status: ambiguous ? "AMBIGUOUS" : "FAILED",
            safeResultCode: ambiguous ? "DIRECTOR_RESULT_AMBIGUOUS" : "DIRECTOR_ATTEMPT_FAILED",
            finishedAt: new Date(),
          },
        });
        await tx.storyboardDirectorRun.update({
          where: { id: run.id },
          data: {
            status: ambiguous ? "AMBIGUOUS" : "FAILED",
            safeResultCode: ambiguous ? "DIRECTOR_RESULT_AMBIGUOUS" : "DIRECTOR_ATTEMPT_FAILED",
            finishedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      });
      return null;
    }
  }
}

function stableUuid(input: string) {
  const bytes = Buffer.from(createHash("sha256").update(input).digest("hex").slice(0, 32), "hex");
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
