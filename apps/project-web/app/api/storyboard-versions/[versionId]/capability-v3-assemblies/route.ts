import { z } from "zod";
import { CapabilityReviewServiceV3 } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new CapabilityReviewServiceV3();
type Context = { params: Promise<{ versionId: string }> };
const requestSchema = z
  .object({ idempotencyKey: z.string().trim().min(8).max(160), confirmed: z.literal(true) })
  .strict();

export async function POST(request: Request, context: Context) {
  try {
    const body = requestSchema.parse(await jsonBody(request));
    return Response.json(
      await service.assemble((await context.params).versionId, body.idempotencyKey),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
