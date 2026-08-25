import { appendStoryboardVersionSchema, StoryboardService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import {
  requiredStoryboardRowVersion,
  storyboardResponse,
} from "../../../../../lib/storyboard-http";

const service = new StoryboardService();
type Context = { params: Promise<{ storyboardId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json({
      versions: await service.listVersions((await context.params).storyboardId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const storyboard = await service.save(
      (await context.params).storyboardId,
      requiredStoryboardRowVersion(request),
      appendStoryboardVersionSchema.parse(await jsonBody(request)),
    );
    return storyboardResponse(storyboard, storyboard.rowVersion, 201);
  } catch (error) {
    return apiError(error);
  }
}
