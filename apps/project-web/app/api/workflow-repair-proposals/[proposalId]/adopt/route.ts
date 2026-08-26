import { StoryboardDirectorService, WorkflowRepairService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";
import { requiredGenerationPlanRowVersion } from "../../../../../lib/generation-plan-http";
import { requiredStoryboardRowVersion } from "../../../../../lib/storyboard-http";

const localService = new WorkflowRepairService();
const directorService = new StoryboardDirectorService();
type Context = { params: Promise<{ proposalId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { proposalId } = await context.params;
    const body = await jsonBody(request);
    if (/^[a-f0-9]{64}$/.test(proposalId)) {
      return Response.json(
        await localService.adoptLocal(proposalId, requiredGenerationPlanRowVersion(request), body),
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      await directorService.adoptRepair(
        proposalId,
        requiredStoryboardRowVersion(request),
        body as any,
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
