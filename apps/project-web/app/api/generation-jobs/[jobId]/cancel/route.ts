import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new GenerationExecutionService();
type Context = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const match = _request.headers.get("if-match")?.match(/^"generation-batch-(\d+)"$/);
    return Response.json(
      await service.requestCancel(
        (await context.params).jobId,
        match ? Number(match[1]) : undefined,
      ),
      {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
