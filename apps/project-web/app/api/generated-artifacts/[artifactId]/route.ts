import { GeneratedArtifactService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";

const service = new GeneratedArtifactService();
type Context = { params: Promise<{ artifactId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.getArtifactView((await context.params).artifactId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
