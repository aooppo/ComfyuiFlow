import {
  ifMatchRowVersionSchema,
  ProductionAssetService,
  ProjectAssetError,
} from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new ProductionAssetService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) throw new ProjectAssetError("PRECONDITION_REQUIRED", "If-Match is required", 428);
    return Response.json(
      await service.publishVersion(
        (await context.params).versionId,
        ifMatchRowVersionSchema.parse(ifMatch),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
