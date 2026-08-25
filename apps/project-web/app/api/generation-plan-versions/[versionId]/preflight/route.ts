import { GenerationPlanService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new GenerationPlanService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.preflight((await context.params).versionId));
  } catch (error) {
    return apiError(error);
  }
}
