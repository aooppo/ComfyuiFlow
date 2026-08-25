import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ storyboardId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.listProposals((await context.params).storyboardId));
  } catch (error) {
    return apiError(error);
  }
}
