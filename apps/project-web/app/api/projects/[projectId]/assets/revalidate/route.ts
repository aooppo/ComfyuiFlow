import { AssetService, revalidateProjectAssetsSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../../lib/api";

const service = new AssetService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = revalidateProjectAssetsSchema.parse(await jsonBody(request));
    return Response.json(
      await service.revalidate((await context.params).projectId, input.assetIds),
    );
  } catch (error) {
    return apiError(error);
  }
}
