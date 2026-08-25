import { CharacterStateService, createCharacterVersionSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new CharacterStateService();
type Context = { params: Promise<{ characterProfileId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return Response.json({
      versions: await service.listCharacterVersions((await context.params).characterProfileId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const input = createCharacterVersionSchema.parse(await jsonBody(request));
    return Response.json(
      await service.createCharacterVersion(
        (await context.params).characterProfileId,
        input.productionAssetVersionId,
        input.basedOnCharacterVersionId,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
