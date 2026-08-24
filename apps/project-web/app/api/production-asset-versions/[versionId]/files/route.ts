import { assetVersionFileInputSchema, ProductionAssetService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.bindFile(
        (await context.params).versionId,
        assetVersionFileInputSchema.parse(await jsonBody(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
