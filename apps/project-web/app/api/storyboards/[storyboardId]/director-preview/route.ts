import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ storyboardId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.preview((await context.params).storyboardId, await jsonBody(request)),
    );
  } catch (error) {
    return apiError(error);
  }
}
