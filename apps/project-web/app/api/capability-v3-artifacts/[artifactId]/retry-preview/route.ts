import { CodexManagerLocalVideoQaProvider } from "@comfyuiflow/ai-providers";
import { CapabilityReviewServiceV3 } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const qaProvider = new CodexManagerLocalVideoQaProvider();
const service = new CapabilityReviewServiceV3(undefined, undefined, process.env, {
  v3QaReadiness: () => qaProvider.validateConfiguration(),
});
type Context = { params: Promise<{ artifactId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(await service.previewRetry((await context.params).artifactId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
