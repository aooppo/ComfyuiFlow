import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";

const service = new GenerationExecutionService();
type Context = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const batch = await service.getBatch((await context.params).batchId);
    return Response.json(batch, {
      headers: {
        "Cache-Control": "no-store",
        ETag: `"generation-batch-${batch.rowVersion}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
