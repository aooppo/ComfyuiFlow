import { analysisPreviewSchema, AnalysisService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../../lib/api";

const service = new AnalysisService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.preview(
        (await context.params).projectId,
        analysisPreviewSchema.parse(await jsonBody(request)),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
