import { GenerationPlanService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";
import { generationPlanResponse } from "../../../../lib/generation-plan-http";

const service = new GenerationPlanService();
type Context = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const plan = await service.get((await context.params).planId);
    return generationPlanResponse(plan, plan.rowVersion);
  } catch (error) {
    return apiError(error);
  }
}
