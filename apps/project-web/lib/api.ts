import { ProjectAssetError, operationLog } from "@comfyuiflow/project-core";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ProjectAssetError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: { code: "INVALID_REQUEST", message: error.issues[0]?.message ?? "Invalid request" },
      },
      { status: 400 },
    );
  }
  operationLog({ operation: "project_asset_api", result: "UNEXPECTED_ERROR" }, console.error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } },
    { status: 500 },
  );
}

export async function jsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ProjectAssetError("INVALID_JSON", "Request body must be valid JSON");
  }
}
