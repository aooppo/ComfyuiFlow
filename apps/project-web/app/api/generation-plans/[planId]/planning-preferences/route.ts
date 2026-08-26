import { PlanningPreferenceService, ProjectAssetError } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredGenerationPlanRowVersion } from "../../../../../lib/generation-plan-http";

const service = new PlanningPreferenceService();
type Context = { params: Promise<{ planId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey)
      throw new ProjectAssetError("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    return Response.json(
      await service.update(
        (await context.params).planId,
        requiredGenerationPlanRowVersion(request),
        idempotencyKey,
        await jsonBody(request),
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
