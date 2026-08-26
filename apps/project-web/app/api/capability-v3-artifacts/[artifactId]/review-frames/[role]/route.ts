import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { CapabilityReviewServiceV3, ProjectAssetError } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../../lib/api";

export const runtime = "nodejs";
const service = new CapabilityReviewServiceV3();
type Context = { params: Promise<{ artifactId: string; role: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { artifactId, role } = await context.params;
    if (!(["FIRST", "MIDDLE", "LAST"] as string[]).includes(role))
      throw new ProjectAssetError("QA_NOT_READY", "Review frame role is invalid", 404);
    const absolutePath = await service.resolveReviewFramePath(
      artifactId,
      role as "FIRST" | "MIDDLE" | "LAST",
    );
    return new Response(Readable.toWeb(createReadStream(absolutePath)) as ReadableStream, {
      headers: {
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
