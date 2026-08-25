import { KeyframeService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new KeyframeService();
type Context = { params: Promise<{ planId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.execute((await context.params).planId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
