import {
  directorCreatePreviewInputSchema,
  StoryboardDirectorService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../../lib/api";

const service = new StoryboardDirectorService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const preview = await service.previewCreate(
      (await context.params).projectId,
      directorCreatePreviewInputSchema.parse(await jsonBody(request)),
    );
    if (preview.externalCalls !== 0) throw new Error("DIRECTOR_PREVIEW_MUST_BE_ZERO_CALL");
    return Response.json(preview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
