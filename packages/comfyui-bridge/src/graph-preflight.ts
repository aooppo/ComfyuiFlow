import { hashCanonical } from "@comfyuiflow/spike-core";
import type { ComfyUiClient } from "./comfyui-client.js";
import { captureNodeCatalog } from "./node-catalog.js";
import {
  zeroCallGraphValidatorIdentity,
  validateZeroCallComfyUiGraph,
  type GraphValidationDiagnostic,
} from "./zero-call-graph-validator.js";

export interface ZeroCallGraphPreflightInput {
  graph: Readonly<Record<string, unknown>>;
  graphSha256: string;
  runtimeContractDigest: string;
  nodeClasses: string[];
  outputNodeId: string;
  outputMediaKey: string;
}

export interface ZeroCallGraphPreflightResult {
  outcome: "PASS" | "FAIL";
  runtimeFingerprintSha256: string | null;
  nodeCatalogSha256: string | null;
  validator: typeof zeroCallGraphValidatorIdentity;
  diagnostics: GraphValidationDiagnostic[];
  generationCalls: 0;
}

function safeRuntimeFacts(value: Record<string, unknown>) {
  const system =
    value.system && typeof value.system === "object" && !Array.isArray(value.system)
      ? (value.system as Record<string, unknown>)
      : {};
  const devices = Array.isArray(value.devices)
    ? value.devices.slice(0, 32).map((device) => {
        const source =
          device && typeof device === "object" && !Array.isArray(device)
            ? (device as Record<string, unknown>)
            : {};
        return {
          name: typeof source.name === "string" ? source.name.slice(0, 160) : "",
          type: typeof source.type === "string" ? source.type.slice(0, 80) : "",
          vramTotal: typeof source.vram_total === "number" ? source.vram_total : null,
        };
      })
    : [];
  return {
    os: typeof system.os === "string" ? system.os.slice(0, 80) : "",
    pythonVersion:
      typeof system.python_version === "string" ? system.python_version.slice(0, 80) : "",
    devices,
  };
}

export function runtimeFingerprintForSystemStats(value: Record<string, unknown>) {
  return hashCanonical(safeRuntimeFacts(value));
}

/** Performs only GET /system_stats and GET /object_info then validates in memory. */
export async function preflightZeroCallGraph(
  client: ComfyUiClient,
  input: ZeroCallGraphPreflightInput,
): Promise<ZeroCallGraphPreflightResult> {
  let runtimeFingerprintSha256: string | null = null;
  try {
    runtimeFingerprintSha256 = runtimeFingerprintForSystemStats(await client.getSystemStats());
  } catch {
    return {
      outcome: "FAIL",
      runtimeFingerprintSha256: null,
      nodeCatalogSha256: null,
      validator: zeroCallGraphValidatorIdentity,
      diagnostics: [
        { code: "RUNTIME_UNREACHABLE", message: "ComfyUI runtime facts could not be read." },
      ],
      generationCalls: 0,
    };
  }
  try {
    const catalog = await captureNodeCatalog(client, input.nodeClasses);
    const validation = validateZeroCallComfyUiGraph(input.graph, catalog, {
      expectedGraphSha256: input.graphSha256,
      outputNodeId: input.outputNodeId,
      outputMediaKey: input.outputMediaKey,
    });
    return {
      outcome: validation.valid ? "PASS" : "FAIL",
      runtimeFingerprintSha256,
      nodeCatalogSha256: catalog.catalogSha256,
      validator: zeroCallGraphValidatorIdentity,
      diagnostics: validation.diagnostics,
      generationCalls: 0,
    };
  } catch {
    return {
      outcome: "FAIL",
      runtimeFingerprintSha256,
      nodeCatalogSha256: null,
      validator: zeroCallGraphValidatorIdentity,
      diagnostics: [
        { code: "NODE_CATALOG_UNAVAILABLE", message: "ComfyUI node catalog could not be read." },
      ],
      generationCalls: 0,
    };
  }
}
