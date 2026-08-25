import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredStoryboardRowVersion } from "../../../../../lib/storyboard-http";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ proposalId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.adopt(
        (await context.params).proposalId,
        requiredStoryboardRowVersion(request),
        await jsonBody(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
