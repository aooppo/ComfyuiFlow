import { NextResponse } from "next/server";
import { prisma } from "@comfyuiflow/project-core";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ batchId: string }> }) {
  const batchId = (await context.params).batchId;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT b."id", b."idempotencyKey", b."createdAt", z."generationLimit", z."aiQaLimit", z."generationPriceMicros", z."aiQaPriceMicros", z."expiresAt",
       COALESCE(jsonb_agg(jsonb_build_object('id', t."id", 'ordinal', t."ordinal", 'attemptId', a."id", 'state', e."state", 'taskId', e."taskId") ORDER BY t."ordinal") FILTER (WHERE t."id" IS NOT NULL), '[]'::jsonb) AS "targets"
     FROM "GenerationBatch" b JOIN "GenerationAuthorization" z ON z."id" = b."authorizationId"
     LEFT JOIN "GenerationTarget" t ON t."generationBatchId" = b."id" LEFT JOIN "GenerationAttempt" a ON a."generationTargetId" = t."id"
     LEFT JOIN LATERAL (SELECT "state", "taskId" FROM "GenerationAttemptEvent" WHERE "attemptId" = a."id" ORDER BY "createdAt" DESC LIMIT 1) e ON true
     WHERE b."id" = $1 GROUP BY b."id", z."id"`,
    batchId,
  );
  if (!rows[0]) return NextResponse.json({ error: "BATCH_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ batch: rows[0], externalCalls: 0 });
}
