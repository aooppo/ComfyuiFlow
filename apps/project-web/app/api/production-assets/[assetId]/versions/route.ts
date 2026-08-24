import {
  createProductionAssetVersionSchema,
  ProductionAssetService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ assetId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const body = createProductionAssetVersionSchema.parse(await jsonBody(request));
    return Response.json(
      await service.createVersion((await context.params).assetId, body.basedOnVersionId),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
