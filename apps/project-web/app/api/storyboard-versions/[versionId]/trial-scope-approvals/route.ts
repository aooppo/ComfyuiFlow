import { TrialScopeApprovalService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new TrialScopeApprovalService();
type Context = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.list((await context.params).versionId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.create(
        (await context.params).versionId,
        await jsonBody(request),
        request.headers.get("Idempotency-Key"),
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
