import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredStoryboardRowVersion } from "../../../../../lib/storyboard-http";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ storyboardId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.confirm(
        (await context.params).storyboardId,
        requiredStoryboardRowVersion(request),
        await jsonBody(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
