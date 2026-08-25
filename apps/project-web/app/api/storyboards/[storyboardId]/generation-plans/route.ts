import { GenerationPlanService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new GenerationPlanService();
type Context = { params: Promise<{ storyboardId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json({
      plans: await service.listForStoryboard((await context.params).storyboardId),
    });
  } catch (error) {
    return apiError(error);
  }
}
