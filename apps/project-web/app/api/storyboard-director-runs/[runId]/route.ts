import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ runId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.getRun((await context.params).runId));
  } catch (error) {
    return apiError(error);
  }
}
