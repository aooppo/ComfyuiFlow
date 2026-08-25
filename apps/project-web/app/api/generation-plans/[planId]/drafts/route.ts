import { GenerationPlanDraftService } from "@comfyuiflow/project-core";
import { z } from "zod";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new GenerationPlanDraftService();
type Context = { params: Promise<{ planId: string }> };
const createSchema = z.object({
  expectedSourceSetHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.getState((await context.params).planId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const body = createSchema.parse(await jsonBody(request));
    const result = await service.create({
      planId: (await context.params).planId,
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
      ...(body.expectedSourceSetHash ? { expectedSourceSetHash: body.expectedSourceSetHash } : {}),
    });
    return Response.json(result, {
      status: result.created ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
