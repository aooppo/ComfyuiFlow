import { WorkflowRepairService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new WorkflowRepairService();
type Context = { params: Promise<{ planId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.preview((await context.params).planId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
