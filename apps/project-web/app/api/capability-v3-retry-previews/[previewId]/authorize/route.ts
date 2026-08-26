import { CapabilityReviewServiceV3 } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new CapabilityReviewServiceV3();
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
