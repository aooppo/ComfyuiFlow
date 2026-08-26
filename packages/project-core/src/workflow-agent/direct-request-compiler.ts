import type { GenerationImplementation } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";

export interface DirectEndpointProfile {
  endpointProfileVersion: string;
  adapterId: string;
  adapterVersion: string;
  allowedFields: readonly string[];
}

export interface CompiledDirectRequestTemplate {
  endpointProfileVersion: string;
  safeRequestSnapshot: Record<string, unknown>;
  safeRequestSnapshotHash: string;
}

const SECRET_FIELD = /(?:secret|token|password|authorization|api[_-]?key|endpoint|url)/i;

export function compileDirectRequestTemplate(input: {
  implementation: GenerationImplementation;
  endpointProfiles: ReadonlyMap<string, DirectEndpointProfile>;
  request: Record<string, unknown>;
}): CompiledDirectRequestTemplate {
  const implementation = input.implementation;
  if (implementation.executorType !== "DIRECT_PROVIDER_API")
    throw new Error("DIRECT_EXECUTOR_REQUIRED");
  const profile = input.endpointProfiles.get(
    `${implementation.adapterId}@${implementation.adapterVersion}`,
  );
  if (
    !profile ||
    profile.adapterId !== implementation.adapterId ||
    profile.adapterVersion !== implementation.adapterVersion
  )
    throw new Error("ADAPTER_NOT_IMPLEMENTED");
  if (!implementation.pricing) throw new Error("COST_UNAVAILABLE");
  const allowed = new Set(profile.allowedFields);
  const safeRequestSnapshot: Record<string, unknown> = {};
  for (const key of Object.keys(input.request).sort()) {
    if (!allowed.has(key) || SECRET_FIELD.test(key)) throw new Error("PRE_DISPATCH_BLOCKED");
    safeRequestSnapshot[key] = input.request[key];
  }
  return {
    endpointProfileVersion: profile.endpointProfileVersion,
    safeRequestSnapshot,
    safeRequestSnapshotHash: canonicalSha256({
      schemaVersion: "safe-direct-request-v1",
      adapterId: implementation.adapterId,
      adapterVersion: implementation.adapterVersion,
      endpointProfileVersion: profile.endpointProfileVersion,
      request: safeRequestSnapshot,
    }),
  };
}
