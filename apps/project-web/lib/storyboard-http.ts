import { parseStoryboardEtag, ProjectAssetError, storyboardEtag } from "@comfyuiflow/project-core";

export function requiredStoryboardRowVersion(request: Request) {
  const value = parseStoryboardEtag(request.headers.get("if-match"));
  if (value === null) {
    throw new ProjectAssetError(
      "PRECONDITION_REQUIRED",
      "Reload the storyboard before saving",
      428,
    );
  }
  return value;
}

export function storyboardResponse(value: unknown, rowVersion: number, status = 200) {
  return Response.json(value, { status, headers: { ETag: storyboardEtag(rowVersion) } });
}
