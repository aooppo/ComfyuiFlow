import { GenerationExecutionService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../lib/api";
import { z } from "zod";

const service = new GenerationExecutionService();

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
    return Response.json(await service.createBatch(await jsonBody(request), key), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
