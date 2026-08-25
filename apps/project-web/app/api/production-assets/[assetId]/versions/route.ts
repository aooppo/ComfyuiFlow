import {
  createProductionAssetVersionSchema,
  ifMatchRowVersionSchema,
  ProjectAssetError,
  ProductionAssetService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ assetId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const body = createProductionAssetVersionSchema.parse(await jsonBody(request));
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) throw new ProjectAssetError("PRECONDITION_REQUIRED", "If-Match is required", 428);
    return Response.json(
      await service.createVersion(
        (await context.params).assetId,
        body.basedOnVersionId,
        ifMatchRowVersionSchema.parse(ifMatch),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
