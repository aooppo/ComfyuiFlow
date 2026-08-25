import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new GenerationExecutionService();
type Context = { params: Promise<{ artifactId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.recordHumanQa(
        (await context.params).artifactId,
        request.headers.get("idempotency-key") ?? "",
        await jsonBody(request),
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
