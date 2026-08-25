import {
  ProjectAssetError,
  storyboardDecisionSchema,
  StoryboardService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredStoryboardRowVersion } from "../../../../../lib/storyboard-http";

const service = new StoryboardService();
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      throw new ProjectAssetError("PRECONDITION_REQUIRED", "Idempotency-Key is required", 428);
    }
    return Response.json(
      await service.decide(
        (await context.params).versionId,
        requiredStoryboardRowVersion(request),
        idempotencyKey,
        storyboardDecisionSchema.parse(await jsonBody(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
