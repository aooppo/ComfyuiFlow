import { ProjectService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new ProjectService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.restore((await context.params).projectId));
  } catch (error) {
    return apiError(error);
  }
}
