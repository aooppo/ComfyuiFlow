import { Readable } from "node:stream";
import Busboy from "busboy";
import {
  AssetService,
  ProjectAssetError,
  assetRoleSchema,
  sanitizeFilename,
  type AssetRoleValue,
} from "@comfyuiflow/project-core";
import { apiError } from "../../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new AssetService();
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    if (!request.body) throw new ProjectAssetError("EMPTY_REQUEST", "Select at least one file");
    const contentType = request.headers.get("content-type");
    if (!contentType?.startsWith("multipart/form-data")) {
      throw new ProjectAssetError("MULTIPART_REQUIRED", "Asset import requires file data");
    }
    const projectId = (await context.params).projectId;
    const maxFiles = Number(process.env.PROJECT_ASSET_MAX_BATCH || 20);
    let role: AssetRoleValue | undefined = assetRoleSchema.safeParse(
      request.headers.get("x-asset-role") ?? undefined,
    ).data;
    const pending: Array<Promise<unknown>> = [];
    let fileCount = 0;

    const parser = Busboy({
      headers: Object.fromEntries(request.headers.entries()),
      limits: { files: maxFiles, fields: 4 },
    });
    parser.on("field", (name, value) => {
      if (name === "role") role = assetRoleSchema.parse(value);
    });
    parser.on("file", (_name, stream, info) => {
      fileCount += 1;
      const selectedRole = role;
      if (!selectedRole) {
        stream.resume();
        pending.push(
          Promise.resolve({
            filename: sanitizeFilename(info.filename),
            outcome: "REJECTED",
            code: "ROLE_REQUIRED",
          }),
        );
        return;
      }
      pending.push(
        service.importStream({
          projectId,
          filename: info.filename,
          role: selectedRole,
          stream,
        }),
      );
    });

    await new Promise<void>((resolve, reject) => {
      parser.once("finish", resolve);
      parser.once("error", reject);
      Readable.fromWeb(request.body as never)
        .once("error", reject)
        .pipe(parser);
    });
    if (fileCount === 0) throw new ProjectAssetError("FILES_REQUIRED", "Select at least one file");
    return Response.json({ results: await Promise.all(pending) });
  } catch (error) {
    return apiError(error);
  }
}
