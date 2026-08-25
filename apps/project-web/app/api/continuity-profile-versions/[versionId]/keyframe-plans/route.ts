import { KeyframeService, createKeyframePlanSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new KeyframeService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = createKeyframePlanSchema.parse(await jsonBody(request));
    return Response.json(await service.create((await context.params).versionId, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
