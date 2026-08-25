import { KeyframeService, previewKeyframePlanSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../../lib/api";

export const runtime = "nodejs";
const service = new KeyframeService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = previewKeyframePlanSchema.parse(await jsonBody(request));
    return Response.json(await service.preview((await context.params).versionId, input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
