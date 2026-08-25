import {
  appendGenerationPlanVersionSchema,
  GenerationPlanService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import {
  generationPlanResponse,
  requiredGenerationPlanRowVersion,
} from "../../../../../lib/generation-plan-http";

const service = new GenerationPlanService();
type Context = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json({ versions: await service.listVersions((await context.params).planId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const plan = await service.append(
      (await context.params).planId,
      requiredGenerationPlanRowVersion(request),
      appendGenerationPlanVersionSchema.parse(await jsonBody(request)),
    );
    return generationPlanResponse(plan, plan.rowVersion, 201);
  } catch (error) {
    return apiError(error);
  }
}
