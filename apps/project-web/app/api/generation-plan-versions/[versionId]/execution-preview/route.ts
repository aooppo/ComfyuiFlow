import { CodexManagerLocalVideoQaProvider } from "@comfyuiflow/ai-providers";
import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const qaProvider = new CodexManagerLocalVideoQaProvider();
const service = new GenerationExecutionService(undefined, undefined, process.env, {
  v3QaReadiness: () => qaProvider.validateConfiguration(),
});
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const body = await jsonBody(request);
    if (
      typeof body === "object" &&
      body !== null &&
      "schemaVersion" in body &&
      body.schemaVersion === "capability-generation-execution-preview-request-v3"
    ) {
      return Response.json(await service.previewV3((await context.params).versionId, body as any), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json(await service.preview((await context.params).versionId, body as any), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
