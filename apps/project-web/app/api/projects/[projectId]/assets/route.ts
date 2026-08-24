import { AssetService, assetFilterSchema } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new AssetService();
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const search = new URL(request.url).searchParams;
    const filter = assetFilterSchema.parse({
      mediaType: search.get("mediaType") || undefined,
      role: search.get("role") || undefined,
    });
    return Response.json(await service.list((await context.params).projectId, filter));
  } catch (error) {
    return apiError(error);
  }
}
