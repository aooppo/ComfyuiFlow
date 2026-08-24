import { ProductionAssetService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.publishVersion((await context.params).versionId));
  } catch (error) {
    return apiError(error);
  }
}
