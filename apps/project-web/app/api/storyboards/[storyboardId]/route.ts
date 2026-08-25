import { StoryboardService, storyboardEtag } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";
import { requiredStoryboardRowVersion } from "../../../../lib/storyboard-http";

const service = new StoryboardService();
type Context = { params: Promise<{ storyboardId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const storyboard = await service.get((await context.params).storyboardId);
    return Response.json(storyboard, { headers: { ETag: storyboardEtag(storyboard.rowVersion) } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    return Response.json(
      await service.deleteEmpty(
        (await context.params).storyboardId,
        requiredStoryboardRowVersion(request),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
