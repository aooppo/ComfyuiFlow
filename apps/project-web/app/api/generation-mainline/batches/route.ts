import { NextResponse } from "next/server";
import { GenerationLifecycleService, prisma } from "@comfyuiflow/project-core";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Creates only persisted frozen work. The unique worker remains separately controlled and an
 * external call still requires its consumed, non-expired authorization. */
export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const authorization = body.authorization as Record<string, unknown> | undefined;
  if (
    !authorization ||
    !Array.isArray(body.targetSpecIds) ||
    typeof body.planPayload !== "object" ||
    body.planPayload === null
  )
    return NextResponse.json({ error: "INVALID_BATCH_REQUEST" }, { status: 400 });
  try {
    const batch = await new GenerationLifecycleService(prisma).createAuthorizedBatch({
      projectId: text(body.projectId),
      planPayload: body.planPayload as Record<string, unknown>,
      targetSpecIds: body.targetSpecIds.map(String),
      idempotencyKey: text(body.idempotencyKey),
      authorization: {
        scope: (authorization.scope ?? {}) as Record<string, unknown>,
        generationLimit: Number(authorization.generationLimit),
        aiQaLimit: Number(authorization.aiQaLimit),
        ...(authorization.generationPriceMicros === undefined
          ? {}
          : { generationPriceMicros: BigInt(String(authorization.generationPriceMicros)) }),
        ...(authorization.aiQaPriceMicros === undefined
          ? {}
          : { aiQaPriceMicros: BigInt(String(authorization.aiQaPriceMicros)) }),
        expiresAt: new Date(text(authorization.expiresAt)),
      },
    });
    return NextResponse.json({ ...batch, externalCalls: 0 }, { status: batch.reused ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "BATCH_REJECTED" },
      { status: 422 },
    );
  }
}
