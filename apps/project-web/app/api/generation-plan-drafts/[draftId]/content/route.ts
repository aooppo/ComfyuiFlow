import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { GenerationPlanDraftService } from "@comfyuiflow/project-core";
import { apiError } from "../../../../../lib/api";
import { parseSingleByteRange } from "../../../../../lib/http-byte-range";

export const runtime = "nodejs";
const service = new GenerationPlanDraftService();
type Context = { params: Promise<{ draftId: string }> };

async function respond(request: Request, context: Context, includeBody: boolean) {
  try {
    const draftId = (await context.params).draftId;
    const draft = await service.getDraft(draftId);
    const absolutePath = await service.resolvePath(draftId);
    const size = Number(draft.byteSize);
    const requestedRange = request.headers.get("range");
    const range = requestedRange ? parseSingleByteRange(requestedRange, size) : null;
    const headers = {
      "Accept-Ranges": "bytes",
      "Content-Type": draft.detectedMimeType,
      "X-Content-Type-Options": "nosniff",
      ETag: `"sha256-${draft.sha256}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    };
    if (requestedRange && !range)
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    if (range) {
      const body = includeBody
        ? (Readable.toWeb(
            createReadStream(absolutePath, { start: range.start, end: range.end }),
          ) as ReadableStream)
        : null;
      return new Response(body, {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(range.end - range.start + 1),
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        },
      });
    }
    const body = includeBody
      ? (Readable.toWeb(createReadStream(absolutePath)) as ReadableStream)
      : null;
    return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request, context: Context) {
  return respond(request, context, true);
}

export async function HEAD(request: Request, context: Context) {
  return respond(request, context, false);
}
