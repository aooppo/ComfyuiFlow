import { CharacterStateService, createCharacterStateSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new CharacterStateService();
type Context = { params: Promise<{ characterVersionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.createState(
        (await context.params).characterVersionId,
        createCharacterStateSchema.parse(await jsonBody(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
