import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ proposalId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.reject((await context.params).proposalId, await jsonBody(request)),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
