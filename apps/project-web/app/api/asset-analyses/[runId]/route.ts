import { AnalysisService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";

const service = new AnalysisService();
type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.getRun((await context.params).runId));
  } catch (error) {
    return apiError(error);
  }
}
