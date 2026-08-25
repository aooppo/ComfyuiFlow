import { KeyframeService, authorizeKeyframePlanSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new KeyframeService();
type Context = { params: Promise<{ planId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = authorizeKeyframePlanSchema.parse(await jsonBody(request));
    return Response.json(await service.authorize((await context.params).planId, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
