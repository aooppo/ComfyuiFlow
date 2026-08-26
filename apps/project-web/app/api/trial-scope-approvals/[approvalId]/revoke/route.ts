import { TrialScopeApprovalService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new TrialScopeApprovalService();
type Context = { params: Promise<{ approvalId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.revoke(
        (await context.params).approvalId,
        await jsonBody(request),
        request.headers.get("Idempotency-Key"),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
