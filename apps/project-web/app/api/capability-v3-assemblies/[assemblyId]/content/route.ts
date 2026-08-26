import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { CapabilityReviewServiceV3 } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

const service = new CapabilityReviewServiceV3();
type Context = { params: Promise<{ assemblyId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { assemblyId } = await context.params;
    const path = await service.resolveAssemblyPath(assemblyId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "X-Content-Type-Options": "nosniff",
        ...(download
          ? { "Content-Disposition": `attachment; filename="comfyuiflow-${assemblyId}.mp4"` }
          : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
