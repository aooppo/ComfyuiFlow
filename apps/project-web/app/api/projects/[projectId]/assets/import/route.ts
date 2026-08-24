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
    const parsedRole = assetRoleSchema.safeParse(request.headers.get("x-asset-role") ?? undefined);
    let role: AssetRoleValue | undefined = parsedRole.success ? parsedRole.data : undefined;
    const pending: Array<Promise<unknown>> = [];
    let fileCount = 0;
    const batch = await service.createImportBatch(
      projectId,
      request.headers.get("idempotency-key") ?? crypto.randomUUID(),
      0,
    );

    const parser = Busboy({
      headers: Object.fromEntries(request.headers.entries()),
      limits: { files: maxFiles, fields: 4 },
    });
    parser.on("field", (name, value) => {
      if (name === "role") role = assetRoleSchema.parse(value);
    });
    parser.on("file", (_name, stream, info) => {
      fileCount += 1;
      const itemIndex = fileCount - 1;
      const selectedRole = role;
      if (!selectedRole) {
        stream.resume();
        pending.push(
          service.recordRejectedImport({
            projectId,
            filename: sanitizeFilename(info.filename),
            role: "OTHER",
            code: "ROLE_REQUIRED",
            batchId: batch.id,
            itemIndex,
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
          batchId: batch.id,
          itemIndex,
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
    if (fileCount === 0) {
      await service.recordRejectedImport({
        projectId,
        filename: "Import",
        role: "OTHER",
        code: "FILES_REQUIRED",
        batchId: batch.id,
        itemIndex: 0,
      });
      await service.completeImportBatch(batch.id);
      throw new ProjectAssetError("FILES_REQUIRED", "Select at least one file");
    }
    const results = await Promise.all(pending);
    await service.completeImportBatch(batch.id);
    return Response.json({ results });
  } catch (error) {
    return apiError(error);
  }
}
