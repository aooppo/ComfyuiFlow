import {
  productionAssetRelationInputSchema,
  ProductionAssetService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = productionAssetRelationInputSchema.parse(await jsonBody(request));
    return Response.json(
      await service.addRelation(
        (await context.params).versionId,
        input.toAssetVersionId,
        input.relationType,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
