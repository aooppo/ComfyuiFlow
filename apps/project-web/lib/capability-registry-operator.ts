import { ProjectAssetError } from "@comfyuiflow/project-core";

export function assertCapabilityRegistryOperator(request: Request) {
  if (process.env.PROJECT_CAPABILITY_REGISTRY_OPERATOR_ENABLED !== "true")
    throw new ProjectAssetError(
      "REGISTRY_OPERATOR_DISABLED",
      "Capability Registry operator actions are disabled",
      403,
    );
  if (request.method === "GET") return;
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin)
    throw new ProjectAssetError(
      "REGISTRY_OPERATOR_ORIGIN_REQUIRED",
      "Capability Registry mutations require the same application origin",
      403,
    );
}
