import {
  createProductionAssetSchema,
  ProductionAssetService,
  productionAssetTypeSchema,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const search = new URL(request.url).searchParams;
    const typeValue = search.get("type") || undefined;
    const cursor = search.get("cursor") || undefined;
    const limitValue = search.get("limit");
    return Response.json(
      await service.list((await context.params).projectId, {
        ...(typeValue ? { type: productionAssetTypeSchema.parse(typeValue) } : {}),
        ...(cursor ? { cursor } : {}),
        ...(limitValue ? { limit: Number(limitValue) } : {}),
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.create(
        (await context.params).projectId,
        createProductionAssetSchema.parse(await jsonBody(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
