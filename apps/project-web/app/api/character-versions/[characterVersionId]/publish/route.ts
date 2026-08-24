import { CharacterStateService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new CharacterStateService();
type Context = { params: Promise<{ characterVersionId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return Response.json(
      await service.publishCharacterVersion((await context.params).characterVersionId),
    );
  } catch (error) {
    return apiError(error);
  }
}
