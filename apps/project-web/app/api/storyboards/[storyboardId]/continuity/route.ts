import { ContinuityService, continuitySuggestionSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new ContinuityService();
type Context = { params: Promise<{ storyboardId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.getForStoryboard((await context.params).storyboardId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const input = continuitySuggestionSchema.parse(await jsonBody(request));
    return Response.json(await service.suggest((await context.params).storyboardId, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
