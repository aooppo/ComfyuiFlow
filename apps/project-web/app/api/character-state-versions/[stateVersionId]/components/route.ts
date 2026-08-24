import { characterStateComponentSchema, CharacterStateService } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new CharacterStateService();
type Context = { params: Promise<{ stateVersionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = characterStateComponentSchema.parse(await jsonBody(request));
    return Response.json(
      await service.bindComponent({
        stateVersionId: (await context.params).stateVersionId,
        ...input,
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
