import { ContinuityService, createContinuityVersionSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new ContinuityService();
type Context = { params: Promise<{ profileId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = createContinuityVersionSchema.parse(await jsonBody(request));
    return Response.json(await service.save((await context.params).profileId, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
