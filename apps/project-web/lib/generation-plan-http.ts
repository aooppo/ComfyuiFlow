import {
  generationPlanEtag,
  parseGenerationPlanEtag,
  ProjectAssetError,
} from "@comfyuiflow/project-core";

export function requiredGenerationPlanRowVersion(request: Request) {
  const value = parseGenerationPlanEtag(request.headers.get("if-match"));
  if (value === null) {
    throw new ProjectAssetError(
      "PRECONDITION_REQUIRED",
      "Reload the shot plan before continuing",
      428,
    );
  }
  return value;
}

export function generationPlanResponse(value: unknown, rowVersion: number, status = 200) {
  return Response.json(value, {
    status,
    headers: { ETag: generationPlanEtag(rowVersion) },
  });
}
