import { KeyframeService, keyframeDecisionSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new KeyframeService();
type Context = { params: Promise<{ artifactId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = keyframeDecisionSchema.parse(await jsonBody(request));
    return Response.json(await service.decideArtifact((await context.params).artifactId, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
