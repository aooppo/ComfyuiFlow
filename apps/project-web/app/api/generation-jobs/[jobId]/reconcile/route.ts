import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new GenerationExecutionService();
type Context = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.requestReconcile((await context.params).jobId), {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
