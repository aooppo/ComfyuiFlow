import { CodexManagerLocalVideoQaProvider } from "@comfyuiflow/ai-providers";
import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../lib/api";
import { requiredGenerationPlanRowVersion } from "../../../lib/generation-plan-http";
import { z } from "zod";

const qaProvider = new CodexManagerLocalVideoQaProvider();
const service = new GenerationExecutionService(undefined, undefined, process.env, {
  v3QaReadiness: () => qaProvider.validateConfiguration(),
});

export async function GET(request: Request) {
  try {
    const generationPlanVersionId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("generationPlanVersionId"));
    const batches = await service.listBatchesForPlanVersion(generationPlanVersionId);
    return Response.json({ batch: batches[0] ?? null, batches });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const key = request.headers.get("idempotency-key") ?? "";
    const body = await jsonBody(request);
    const expectedRowVersion =
      typeof body === "object" &&
      body !== null &&
      "engineVersion" in body &&
      body.engineVersion === "WORKFLOW_AGENT_V1"
        ? requiredGenerationPlanRowVersion(request)
        : undefined;
    return Response.json(await service.createBatch(body as any, key, expectedRowVersion), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
