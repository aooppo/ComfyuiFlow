import { ProjectService, projectPatchSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../lib/api";

export const runtime = "nodejs";
const service = new ProjectService();

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(await service.get((await context.params).projectId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const input = projectPatchSchema.parse(await jsonBody(request));
    return Response.json(await service.update((await context.params).projectId, input));
  } catch (error) {
    return apiError(error);
  }
}
