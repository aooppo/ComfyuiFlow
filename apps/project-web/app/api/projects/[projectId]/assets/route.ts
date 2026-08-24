import { AssetService, projectAssetFilterSchema } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new AssetService();
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const search = new URL(request.url).searchParams;
    const filter = projectAssetFilterSchema.parse({
      mediaType: search.get("mediaType") || undefined,
      role: search.get("role") || undefined,
      status: search.get("status") || undefined,
      query: search.get("query") || undefined,
      cursor: search.get("cursor") || undefined,
      limit: search.get("limit") || undefined,
    });
    return Response.json(await service.listPage((await context.params).projectId, filter));
  } catch (error) {
    return apiError(error);
  }
}
