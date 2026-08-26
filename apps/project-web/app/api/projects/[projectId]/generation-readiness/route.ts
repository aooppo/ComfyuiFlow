import { WorkflowAgentReadinessService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new WorkflowAgentReadinessService();

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.get((await context.params).projectId));
  } catch (error) {
    return apiError(error);
  }
}
