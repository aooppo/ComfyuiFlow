import { AssetService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new AssetService();
type Context = { params: Promise<{ assetId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.remove((await context.params).assetId));
  } catch (error) {
    return apiError(error);
  }
}
