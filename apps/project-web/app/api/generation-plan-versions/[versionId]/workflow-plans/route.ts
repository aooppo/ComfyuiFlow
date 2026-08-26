import {
  GenerationAdapterRegistry,
  WorkflowPlanningApplicationService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const planningAdapters = new GenerationAdapterRegistry().registerIdentity({
  adapterId: "comfyui-partner-h3-reference",
  adapterVersion: "1.0.0",
  executorType: "COMFYUI_GRAPH",
});
const service = new WorkflowPlanningApplicationService(undefined, undefined, planningAdapters);
type Context = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    return Response.json(
      await service.previewAndPersist((await context.params).versionId, await jsonBody(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
