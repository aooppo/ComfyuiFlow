import { CodexManagerLocalVideoQaProvider } from "@comfyuiflow/ai-providers";
import { CapabilityReviewServiceV3 } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const qaProvider = new CodexManagerLocalVideoQaProvider();
const service = new CapabilityReviewServiceV3(undefined, undefined, process.env, {
  v3QaReadiness: () => qaProvider.validateConfiguration(),
});
type Context = { params: Promise<{ previewId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.authorizeRetry((await context.params).previewId, await jsonBody(request)),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
