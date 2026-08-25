import { StoryboardDirectorService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../lib/api";
const service = new StoryboardDirectorService();
type Context = { params: Promise<{ proposalId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.getProposal((await context.params).proposalId));
  } catch (error) {
    return apiError(error);
  }
}
