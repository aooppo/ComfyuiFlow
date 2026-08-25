import { storyboardResolutionSchema, StoryboardService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new StoryboardService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.resolveAssets(
        (await context.params).versionId,
        storyboardResolutionSchema.parse(await jsonBody(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
