import { GenerationPlanService, ProjectAssetError } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";
import { generationPlanResponse } from "../../../../../lib/generation-plan-http";

const service = new GenerationPlanService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      throw new ProjectAssetError("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    }
    const plan = await service.create((await context.params).versionId, idempotencyKey);
    return generationPlanResponse(plan, plan.rowVersion, 201);
  } catch (error) {
    return apiError(error);
  }
}
