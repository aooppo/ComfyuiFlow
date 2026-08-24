import { understandingApplicationSchema, UnderstandingService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new UnderstandingService();
type Context = { params: Promise<{ revisionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const body = await jsonBody(request);
    const input = understandingApplicationSchema.parse({
      ...body,
      idempotencyKey: request.headers.get("idempotency-key") ?? body.idempotencyKey,
    });
    return Response.json(await service.apply((await context.params).revisionId, input), {
      status: 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
