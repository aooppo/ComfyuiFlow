import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { AssetService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";

export const runtime = "nodejs";
const service = new AssetService();
type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const content = await service.content((await context.params).assetId);
    const safeName = content.filename.replace(/["\\\r\n]/g, "_");
    return new Response(Readable.toWeb(createReadStream(content.absolutePath)) as ReadableStream, {
      headers: {
        "Content-Type": content.mimeType,
        "Content-Length": String(content.byteSize),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        ETag: `"sha256-${content.sha256}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
