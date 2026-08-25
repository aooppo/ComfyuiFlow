import { ContinuityService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new ContinuityService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.preflight((await context.params).versionId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
