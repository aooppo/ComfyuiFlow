import { createStoryboardSchema, StoryboardService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new StoryboardService();
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const requestedStatus = new URL(request.url).searchParams.get("status");
    const status = requestedStatus === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
    return Response.json({
      storyboards: await service.list((await context.params).projectId, 50, status),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const storyboard = await service.create(
      (await context.params).projectId,
      createStoryboardSchema.parse(await jsonBody(request)),
    );
    return Response.json(storyboard, { status: 201, headers: { ETag: '"storyboard-0"' } });
  } catch (error) {
    return apiError(error);
  }
}
