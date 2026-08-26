import {
  CapabilityWorkflowPlanningApplicationService,
  GenerationExecutionService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new CapabilityWorkflowPlanningApplicationService();
const execution = new GenerationExecutionService();
type Context = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(
      await execution.latestCapabilityBatchForStoryboardVersion((await context.params).versionId),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.previewAndPersistStoryboard(
        (await context.params).versionId,
        await jsonBody(request),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
