import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredStoryboardRowVersion } from "../../../../../lib/storyboard-http";

const service = new StoryboardDirectorService();
type Context = { params: Promise<{ planId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const body = await jsonBody(request);
    const planId = (await context.params).planId;
    if (typeof body === "object" && body !== null && "previewHash" in body) {
      return Response.json(
        await service.confirmRepair(planId, requiredStoryboardRowVersion(request), body as any),
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(await service.previewRepair(planId, body as any), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
