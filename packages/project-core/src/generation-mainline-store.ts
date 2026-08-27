import type { ProjectPrisma } from "./prisma.js";
import type { GenerationAttemptWork, GenerationWorkStore } from "./generation-worker.js";

type AttemptRow = {
  id: string;
  adapterRef: { id: string; version: string };
  runtimeRef: { id: string; version: string };
  runtimeContractDigest: string;
  graphSha256: string;
  state: "QUEUED" | "SUBMITTED" | "RECONCILING";
  providerTaskId: string | null;
};

/** PostgreSQL implementation of the Feature 017 Worker boundary. Every externally relevant state
 * change is represented by an inserted GenerationAttemptEvent or AuthorizationConsumption row. */
export class PrismaGenerationMainlineStore implements GenerationWorkStore {
  constructor(private readonly client: ProjectPrisma) {}

  async claimReconciliation() {
    return this.claim("SUBMITTED");
  }

  async claimNext() {
    return (await this.claim("QUEUED")) ?? this.claim("LEASED");
  }

  async consumeBeforeSubmit(attemptId: string) {
    const rows = await this.client.$queryRawUnsafe<Array<{ id: string }>>(
      `WITH candidate AS (
         SELECT a."id", b."authorizationId"
         FROM "GenerationAttempt" a
         JOIN "GenerationTarget" t ON t."id" = a."generationTargetId"
         JOIN "GenerationBatch" b ON b."id" = t."generationBatchId"
         JOIN "GenerationAuthorization" z ON z."id" = b."authorizationId"
         WHERE a."id" = $1 AND z."state" = 'ACTIVE' AND z."expiresAt" > now()
           AND (SELECT count(*) FROM "AuthorizationConsumption" c WHERE c."authorizationId" = z."id" AND c."operation" = 'GENERATION') < z."generationLimit"
       ), consumed AS (
       INSERT INTO "AuthorizationConsumption" ("id", "authorizationId", "attemptId", "operation")
       SELECT gen_random_uuid(), "authorizationId", "id", 'GENERATION' FROM candidate
       ON CONFLICT ("attemptId", "operation") DO NOTHING
       RETURNING "id", "attemptId"
       ), state_event AS (
         INSERT INTO "GenerationAttemptEvent" ("id", "attemptId", "state", "code")
         SELECT gen_random_uuid(), "attemptId", 'SUBMITTING', 'AUTHORIZATION_CONSUMED' FROM consumed
       )
       SELECT "id" FROM consumed`,
      attemptId,
    );
    return rows.length === 1;
  }

  async markSubmitted(attemptId: string, taskId: string) {
    await this.event(attemptId, "SUBMITTED", taskId, "SUBMITTED");
  }

  async markTerminal(attemptId: string, code: string) {
    await this.event(attemptId, "AMBIGUOUS", null, code);
  }

  async markReconciled(attemptId: string, state: string) {
    if (!["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"].includes(state))
      throw new Error(`INVALID_RECONCILIATION_STATE:${state}`);
    await this.event(
      attemptId,
      state === "PENDING" || state === "RUNNING" ? "RECONCILING" : state,
      null,
      `RECONCILED_${state}`,
    );
  }

  private async claim(expected: "QUEUED" | "LEASED" | "SUBMITTED") {
    return this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<AttemptRow[]>(
        `SELECT a."id", a."adapterRef", a."runtimeRef", a."runtimeContractDigest", a."graphSha256", e."state", e."taskId" AS "providerTaskId"
         FROM "GenerationAttempt" a
         JOIN LATERAL (SELECT "state", "taskId" FROM "GenerationAttemptEvent" WHERE "attemptId" = a."id" ORDER BY "createdAt" DESC LIMIT 1) e ON true
         WHERE e."state" = $1
         ORDER BY a."createdAt", a."id"
         FOR UPDATE OF a SKIP LOCKED
         LIMIT 1`,
        expected,
      );
      const row = rows[0];
      if (!row) return null;
      const nextState = expected === "SUBMITTED" ? "RECONCILING" : "LEASED";
      await tx.$executeRawUnsafe(
        `INSERT INTO "GenerationAttemptEvent" ("id", "attemptId", "state", "code") VALUES (gen_random_uuid(), $1, $2::"GenerationAttemptState", 'WORKER_CLAIMED')`,
        row.id,
        nextState,
      );
      return this.work(row);
    });
  }

  private async event(attemptId: string, state: string, taskId: string | null, code: string) {
    await this.client.$executeRawUnsafe(
      `INSERT INTO "GenerationAttemptEvent" ("id", "attemptId", "state", "taskId", "code") VALUES (gen_random_uuid(), $1, $2::"GenerationAttemptState", $3, $4)`,
      attemptId,
      state,
      taskId,
      code,
    );
  }

  private work(row: AttemptRow): GenerationAttemptWork {
    return {
      attemptId: row.id,
      adapterRef: row.adapterRef,
      runtimeRef: row.runtimeRef,
      runtimeContractDigest: row.runtimeContractDigest,
      graphSha256: row.graphSha256,
      state: row.state === "SUBMITTED" ? "SUBMITTED" : "QUEUED",
      ...(row.providerTaskId ? { taskId: row.providerTaskId } : {}),
    };
  }
}
