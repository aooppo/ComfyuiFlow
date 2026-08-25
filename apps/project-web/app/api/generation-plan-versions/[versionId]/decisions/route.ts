import {
  generationPlanDecisionSchema,
  GenerationPlanService,
  ProjectAssetError,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredGenerationPlanRowVersion } from "../../../../../lib/generation-plan-http";

const service = new GenerationPlanService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      throw new ProjectAssetError("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    }
    return Response.json(
      await service.decide(
        (await context.params).versionId,
        requiredGenerationPlanRowVersion(request),
        idempotencyKey,
        generationPlanDecisionSchema.parse(await jsonBody(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
