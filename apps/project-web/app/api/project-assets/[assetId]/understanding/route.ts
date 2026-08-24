import { UnderstandingService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new UnderstandingService();
type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.history((await context.params).assetId));
  } catch (error) {
    return apiError(error);
  }
}
