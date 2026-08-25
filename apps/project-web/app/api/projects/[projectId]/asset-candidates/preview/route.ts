import {
  assetCandidateRequirementSchema,
  AssetCandidateService,
  ProjectAssetError,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../../lib/api";

const service = new AssetCandidateService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const projectId = (await context.params).projectId;
    const body = assetCandidateRequirementSchema.parse(await jsonBody(request));
    if (body.projectId !== projectId) {
      throw new ProjectAssetError(
        "CROSS_PROJECT",
        "Candidate requirement must match the route project",
        409,
      );
    }
    return Response.json(await service.preview(body));
  } catch (error) {
    return apiError(error);
  }
}
