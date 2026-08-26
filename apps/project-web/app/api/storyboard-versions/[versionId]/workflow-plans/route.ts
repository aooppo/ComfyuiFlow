import { CapabilityWorkflowPlanningApplicationService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new CapabilityWorkflowPlanningApplicationService();
type Context = { params: Promise<{ versionId: string }> };

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
