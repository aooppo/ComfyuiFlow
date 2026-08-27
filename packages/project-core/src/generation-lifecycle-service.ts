import { canonicalSha256 } from "./canonical-json.js";
import type { ProjectPrisma } from "./prisma.js";

type Json = Record<string, unknown>;

function uuid(value: string, field: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new Error(`INVALID_${field}`);
  return value;
}

/** Server-owned canonical lifecycle. It has no provider, compiler, graph, or retry-selection
 * branch; the only executable material is already frozen in the referenced GenerationSpec. */
export class GenerationLifecycleService {
  constructor(private readonly prisma: ProjectPrisma) {}

  async createAuthorizedBatch(input: {
    projectId: string;
    planPayload: Json;
    targetSpecIds: string[];
    idempotencyKey: string;
    authorization: {
      scope: Json;
      generationLimit: number;
      aiQaLimit: number;
      generationPriceMicros?: bigint;
      aiQaPriceMicros?: bigint;
      expiresAt: Date;
    };
  }) {
    uuid(input.projectId, "PROJECT_ID");
    if (
      !input.targetSpecIds.length ||
      input.targetSpecIds.length > input.authorization.generationLimit
    )
      throw new Error("TARGET_LIMIT_INVALID");
    if (new Set(input.targetSpecIds).size !== input.targetSpecIds.length)
      throw new Error("DUPLICATE_TARGET_SPEC");
    if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    for (const specId of input.targetSpecIds) uuid(specId, "GENERATION_SPEC_ID");
    const digest = canonicalSha256(input.planPayload);
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.$queryRawUnsafe<
        Array<{
          generationSpecId: string;
          graphSha256: string;
          runtimeContractDigest: string;
          evidenceId: string | null;
        }>
      >(
        `SELECT s."id" AS "generationSpecId", g."graphSha256", r."digest" AS "runtimeContractDigest",
                (SELECT e."id" FROM "GraphValidationEvidence" e
                 WHERE e."graphSnapshotId" = g."id" AND e."graphSha256" = g."graphSha256"
                   AND e."runtimeContractDigest" = r."digest" AND e."outcome" = 'PASS'
                   AND e."nodeCatalogSha256" IS NOT NULL
                 ORDER BY e."createdAt" DESC, e."id" DESC LIMIT 1) AS "evidenceId"
         FROM "GenerationSpec" s
         JOIN "RuntimeContract" r ON r."id" = s."runtimeContractId"
         JOIN "MaterializedGraphSnapshot" g ON g."generationSpecId" = s."id"
         WHERE s."id" = ANY($1::uuid[]) AND g."runtimeContractDigest" = r."digest"`,
        input.targetSpecIds,
      );
      if (evidence.length !== input.targetSpecIds.length) throw new Error("FROZEN_SPEC_NOT_FOUND");
      if (evidence.some((row) => !row.evidenceId))
        throw new Error("GRAPH_TECHNICAL_EVIDENCE_REQUIRED");
      const insertedPlan = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "GenerationPlan" ("projectId", "payloadJson", "digest") VALUES ($1, $2::jsonb, $3)
         ON CONFLICT ("projectId", "digest") DO NOTHING RETURNING "id"`,
        input.projectId,
        JSON.stringify(input.planPayload),
        digest,
      );
      const planId =
        insertedPlan[0]?.id ??
        (
          await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "GenerationPlan" WHERE "projectId" = $1 AND "digest" = $2`,
            input.projectId,
            digest,
          )
        )[0]?.id;
      if (!planId) throw new Error("PLAN_IDEMPOTENCY_READ_FAILED");
      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "GenerationBatch" WHERE "idempotencyKey" = $1`,
        input.idempotencyKey,
      );
      if (existing[0]) return { planId, batchId: existing[0].id, reused: true };
      const authorization = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "GenerationAuthorization" ("generationPlanId", "scopeJson", "generationLimit", "aiQaLimit", "generationPriceMicros", "aiQaPriceMicros", "expiresAt")
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7) RETURNING "id"`,
        planId,
        JSON.stringify(input.authorization.scope),
        input.authorization.generationLimit,
        input.authorization.aiQaLimit,
        input.authorization.generationPriceMicros ?? null,
        input.authorization.aiQaPriceMicros ?? null,
        input.authorization.expiresAt,
      );
      const batch = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "GenerationBatch" ("generationPlanId", "authorizationId", "idempotencyKey") VALUES ($1, $2, $3) RETURNING "id"`,
        planId,
        authorization[0]!.id,
        input.idempotencyKey,
      );
      for (const [ordinal, specId] of input.targetSpecIds.entries()) {
        uuid(specId, "GENERATION_SPEC_ID");
        const target = await tx.$queryRawUnsafe<
          Array<{
            id: string;
            adapterRef: Json;
            runtimeRef: Json;
            runtimeContractDigest: string;
            graphSha256: string;
            graphValidationEvidenceId: string;
          }>
        >(
          `WITH target AS (
             INSERT INTO "GenerationTarget" ("generationBatchId", "generationSpecId", "ordinal") VALUES ($1, $2, $3) RETURNING "id"
           ) SELECT target."id", i."adapterRef", jsonb_build_object('id', r."ref", 'version', r."version") AS "runtimeRef", r."digest" AS "runtimeContractDigest", g."graphSha256", e."id" AS "graphValidationEvidenceId"
           FROM target JOIN "GenerationSpec" s ON s."id" = $2 JOIN "GenerationImplementation" i ON i."id" = s."implementationId"
           JOIN "RuntimeContract" r ON r."id" = s."runtimeContractId" JOIN "MaterializedGraphSnapshot" g ON g."generationSpecId" = s."id"
           JOIN LATERAL (SELECT "id" FROM "GraphValidationEvidence" WHERE "graphSnapshotId" = g."id" AND "graphSha256" = g."graphSha256" AND "runtimeContractDigest" = r."digest" AND "outcome" = 'PASS' AND "nodeCatalogSha256" IS NOT NULL ORDER BY "createdAt" DESC, "id" DESC LIMIT 1) e ON true`,
          batch[0]!.id,
          specId,
          ordinal + 1,
        );
        const row = target[0];
        if (!row) throw new Error("FROZEN_SPEC_NOT_FOUND");
        const attempt = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO "GenerationAttempt" ("generationTargetId", "adapterRef", "runtimeRef", "runtimeContractDigest", "graphSha256", "graphValidationEvidenceId")
           VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6) RETURNING "id"`,
          row.id,
          JSON.stringify(row.adapterRef),
          JSON.stringify(row.runtimeRef),
          row.runtimeContractDigest,
          row.graphSha256,
          row.graphValidationEvidenceId,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "GenerationAttemptEvent" ("attemptId", "state", "code") VALUES ($1, 'QUEUED', 'BATCH_CREATED')`,
          attempt[0]!.id,
        );
      }
      return { planId, batchId: batch[0]!.id, reused: false };
    });
  }

  async recordArtifact(input: {
    attemptId: string;
    storageKey: string;
    sha256: string;
    ffprobe: Json;
    frames: Json;
  }) {
    uuid(input.attemptId, "ATTEMPT_ID");
    if (
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !Array.isArray(input.frames) ||
      input.frames.length !== 3
    )
      throw new Error("ARTIFACT_EVIDENCE_INVALID");
    const created = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "GenerationArtifact" ("attemptId", "storageKey", "sha256", "ffprobeJson", "framesJson")
       SELECT $1, $2, $3, $4::jsonb, $5::jsonb WHERE EXISTS (
         SELECT 1 FROM "GenerationAttemptEvent" WHERE "attemptId" = $1 AND "state" = 'COMPLETED'
       ) ON CONFLICT ("attemptId") DO NOTHING RETURNING "id"`,
      input.attemptId,
      input.storageKey,
      input.sha256,
      JSON.stringify(input.ffprobe),
      JSON.stringify(input.frames),
    );
    if (!created[0]) throw new Error("ARTIFACT_NOT_DISPATCHABLE_OR_ALREADY_RETAINED");
    return created[0].id;
  }

  async startAiQa(artifactId: string) {
    uuid(artifactId, "ARTIFACT_ID");
    return this.prisma.$transaction(async (tx) => {
      const consumption = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `WITH candidate AS (
           SELECT z."id" AS "authorizationId", a."attemptId"
           FROM "GenerationArtifact" a JOIN "GenerationAttempt" e ON e."id" = a."attemptId"
           JOIN "GenerationTarget" t ON t."id" = e."generationTargetId"
           JOIN "GenerationBatch" b ON b."id" = t."generationBatchId"
           JOIN "GenerationAuthorization" z ON z."id" = b."authorizationId"
           WHERE a."id" = $1 AND z."state" = 'ACTIVE' AND z."expiresAt" > now()
             AND (SELECT count(*) FROM "AuthorizationConsumption" c WHERE c."authorizationId" = z."id" AND c."operation" = 'AI_QA') < z."aiQaLimit"
         ) INSERT INTO "AuthorizationConsumption" ("authorizationId", "attemptId", "operation")
           SELECT "authorizationId", "attemptId", 'AI_QA' FROM candidate
           ON CONFLICT ("attemptId", "operation") DO NOTHING RETURNING "id"`,
        artifactId,
      );
      if (!consumption[0]) throw new Error("AI_QA_AUTHORIZATION_REJECTED");
      const run = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "AiQaRun" ("artifactId", "authorizationConsumptionId", "state") VALUES ($1, $2, 'QUEUED') RETURNING "id"`,
        artifactId,
        consumption[0].id,
      );
      return run[0]!.id;
    });
  }

  async recordAiQaResult(input: { aiQaRunId: string; payload: Json }) {
    uuid(input.aiQaRunId, "AI_QA_RUN_ID");
    const digest = canonicalSha256(input.payload);
    const row = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "AiQaResult" ("aiQaRunId", "payloadJson", "digest")
       SELECT "id", $2::jsonb, $3 FROM "AiQaRun" WHERE "id" = $1 AND "state" = 'QUEUED'
       ON CONFLICT ("aiQaRunId") DO NOTHING RETURNING "id"`,
      input.aiQaRunId,
      JSON.stringify(input.payload),
      digest,
    );
    if (!row[0]) throw new Error("AI_QA_RESULT_NOT_DISPATCHABLE_OR_ALREADY_RECORDED");
    return row[0].id;
  }

  async recordOwnerDecision(input: {
    artifactId: string;
    decision: "PASS" | "FAIL" | "RISK_ACCEPTED";
    actorRef: string;
    idempotencyKey: string;
  }) {
    uuid(input.artifactId, "ARTIFACT_ID");
    const row = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "OwnerDecision" ("artifactId", "decision", "actorRef", "idempotencyKey") VALUES ($1, $2::"OwnerDecisionType", $3, $4)
       ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING "id"`,
      input.artifactId,
      input.decision,
      input.actorRef,
      input.idempotencyKey,
    );
    return (
      row[0]?.id ??
      (
        await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "OwnerDecision" WHERE "idempotencyKey" = $1`,
          input.idempotencyKey,
        )
      )[0]!.id
    );
  }

  async createRetryPreview(ownerDecisionId: string, payload: Json) {
    uuid(ownerDecisionId, "OWNER_DECISION_ID");
    const digest = canonicalSha256(payload);
    const row = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "RetryPreview" ("ownerDecisionId", "payloadJson", "digest")
       SELECT $1, $2::jsonb, $3 WHERE EXISTS (SELECT 1 FROM "OwnerDecision" WHERE "id" = $1 AND "decision" = 'FAIL')
       ON CONFLICT ("ownerDecisionId") DO NOTHING RETURNING "id"`,
      ownerDecisionId,
      JSON.stringify(payload),
      digest,
    );
    if (!row[0]) throw new Error("RETRY_REQUIRES_OWNER_FAIL_OR_ALREADY_EXISTS");
    return row[0].id;
  }

  async createAssembly(input: {
    projectId: string;
    artifactIds: string[];
    idempotencyKey: string;
  }) {
    uuid(input.projectId, "PROJECT_ID");
    if (!input.artifactIds.length) throw new Error("ASSEMBLY_INPUT_EMPTY");
    const inputDigest = canonicalSha256([...input.artifactIds].sort());
    const row = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "GenerationAssembly" ("projectId", "inputDigest", "idempotencyKey")
       SELECT $1, $2, $3 WHERE (SELECT count(*) FROM "OwnerDecision" d WHERE d."artifactId" = ANY($4::uuid[]) AND d."decision" IN ('PASS', 'RISK_ACCEPTED')) = cardinality($4::uuid[])
       ON CONFLICT ("inputDigest") DO NOTHING RETURNING "id"`,
      input.projectId,
      inputDigest,
      input.idempotencyKey,
      input.artifactIds,
    );
    if (row[0]) return row[0].id;
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "GenerationAssembly" WHERE "inputDigest" = $1`,
      inputDigest,
    );
    if (!existing[0]) throw new Error("ASSEMBLY_REQUIRES_OWNER_DECISIONS");
    return existing[0].id;
  }
}
