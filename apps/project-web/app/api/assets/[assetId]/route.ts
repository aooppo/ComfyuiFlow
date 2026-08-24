import { AssetService, assetPatchSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../lib/api";

const service = new AssetService();
type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.get((await context.params).assetId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const input = assetPatchSchema.parse(await jsonBody(request));
    return Response.json(await service.update((await context.params).assetId, input));
  } catch (error) {
    return apiError(error);
  }
}
