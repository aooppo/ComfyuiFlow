import { StoryboardService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";
import {
  requiredStoryboardRowVersion,
  storyboardResponse,
} from "../../../../../lib/storyboard-http";

const service = new StoryboardService();
type Context = { params: Promise<{ storyboardId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const storyboard = await service.archive(
      (await context.params).storyboardId,
      requiredStoryboardRowVersion(request),
    );
    return storyboardResponse(storyboard, storyboard.rowVersion);
  } catch (error) {
    return apiError(error);
  }
}
