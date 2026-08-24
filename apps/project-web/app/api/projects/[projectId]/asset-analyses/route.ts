import { analysisConfirmSchema, AnalysisService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new AnalysisService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const body = await jsonBody(request);
    const input = analysisConfirmSchema.parse({
      ...body,
      idempotencyKey: request.headers.get("idempotency-key") ?? body.idempotencyKey,
    });
    return Response.json(await service.confirm((await context.params).projectId, input), {
      status: 202,
    });
  } catch (error) {
    return apiError(error);
  }
}
