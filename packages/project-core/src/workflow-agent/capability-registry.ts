import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  GenerationRegistryV2Schema,
  type GenerationRegistry,
  type GenerationImplementationV2,
  type GenerationRegistryV2,
  type VersionRefV2,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";

const refKey = (value: VersionRefV2) => `${value.id}@${value.version}`;

export interface HistoricalGenerationImplementationProjection {
  id: string;
  version: string;
  providerId: string;
  modelProfileId: string;
  adapterId: string;
  adapterVersion: string;
  lifecycle: "DEPRECATED";
  historical: true;
  sourceSchemaVersion: "generation-registry-v1";
}

export function projectLegacyGenerationRegistryV1(
  document: GenerationRegistry,
): HistoricalGenerationImplementationProjection[] {
  return [...document.implementations]
    .sort((left, right) =>
      `${left.implementationId}@${left.version}`.localeCompare(
        `${right.implementationId}@${right.version}`,
      ),
    )
    .map((implementation) => ({
      id: implementation.implementationId,
      version: implementation.version,
      providerId: implementation.providerId,
      modelProfileId: implementation.modelProfileId,
      adapterId: implementation.adapterId,
      adapterVersion: implementation.adapterVersion,
      lifecycle: "DEPRECATED" as const,
      historical: true as const,
      sourceSchemaVersion: "generation-registry-v1" as const,
    }));
}

export interface LoadedCapabilityRegistry {
  document: GenerationRegistryV2;
  registrySha256: string;
  runtimesByRef: ReadonlyMap<string, GenerationRegistryV2["runtimes"][number]>;
  providersByRef: ReadonlyMap<string, GenerationRegistryV2["providers"][number]>;
  modelsByRef: ReadonlyMap<string, GenerationRegistryV2["models"][number]>;
  adaptersByRef: ReadonlyMap<string, GenerationRegistryV2["adapters"][number]>;
  compilersByRef: ReadonlyMap<string, GenerationRegistryV2["compilers"][number]>;
  implementationsByRef: ReadonlyMap<string, GenerationImplementationV2>;
  resolveExact(reference: VersionRefV2): GenerationImplementationV2;
  resolveSelectable(options?: {
    production?: boolean;
    allowedTrialRefs?: ReadonlySet<string>;
  }): GenerationImplementationV2[];
  explainResolution(options?: { production?: boolean; allowedTrialRefs?: ReadonlySet<string> }): {
    selectable: GenerationImplementationV2[];
    rejected: Array<{
      reference: VersionRefV2;
      reasonCode:
        | "TEST_ONLY_IMPLEMENTATION"
        | "DISCOVERED_NOT_PUBLISHED"
        | "TRIAL_SCOPE_REQUIRED"
        | "IMPLEMENTATION_NOT_SELECTABLE";
    }>;
  };
}

function byRef<T extends VersionRefV2>(values: T[]): ReadonlyMap<string, T> {
  return new Map(values.map((value) => [refKey(value), value]));
}

function normalize(document: GenerationRegistryV2): GenerationRegistryV2 {
  const sort = <T extends VersionRefV2>(values: T[]) =>
    [...values].sort((left, right) => refKey(left).localeCompare(refKey(right)));
  return {
    ...document,
    runtimes: sort(document.runtimes),
    providers: sort(document.providers),
    models: sort(document.models).map((model) => ({
      ...model,
      capabilityCodes: [...model.capabilityCodes].sort(),
    })),
    adapters: sort(document.adapters).map((adapter) => ({
      ...adapter,
      operations: [...adapter.operations].sort(),
    })),
    compilers: sort(document.compilers),
    implementations: sort(document.implementations).map((implementation) => ({
      ...implementation,
      capabilityCodes: [...implementation.capabilityCodes].sort(),
    })),
  };
}

export class CapabilityRegistryLoader {
  constructor(readonly registryPath = resolveCapabilityRegistryPath()) {}

  async load(): Promise<LoadedCapabilityRegistry> {
    const document = normalize(
      GenerationRegistryV2Schema.parse(JSON.parse(await readFile(this.registryPath, "utf8"))),
    );
    const runtimesByRef = byRef(document.runtimes);
    const providersByRef = byRef(document.providers);
    const modelsByRef = byRef(document.models);
    const adaptersByRef = byRef(document.adapters);
    const compilersByRef = byRef(document.compilers);
    const implementationsByRef = byRef(document.implementations);
    const explainResolution: LoadedCapabilityRegistry["explainResolution"] = (options = {}) => {
      const production = options.production ?? true;
      const allowedTrials = options.allowedTrialRefs ?? new Set<string>();
      const selectable: GenerationImplementationV2[] = [];
      const rejected: ReturnType<LoadedCapabilityRegistry["explainResolution"]>["rejected"] = [];
      for (const implementation of document.implementations) {
        let reasonCode: (typeof rejected)[number]["reasonCode"] | null = null;
        if (
          production &&
          (implementation.testOnly || implementation.costPolicy.kind === "TEST_ZERO_CALL")
        )
          reasonCode = "TEST_ONLY_IMPLEMENTATION";
        else if (implementation.lifecycle === "READY") selectable.push(implementation);
        else if (implementation.lifecycle === "TRIAL") {
          if (allowedTrials.has(refKey(implementation))) selectable.push(implementation);
          else reasonCode = "TRIAL_SCOPE_REQUIRED";
        } else if (implementation.lifecycle === "DISCOVERED")
          reasonCode = "DISCOVERED_NOT_PUBLISHED";
        else reasonCode = "IMPLEMENTATION_NOT_SELECTABLE";
        if (reasonCode)
          rejected.push({
            reference: { id: implementation.id, version: implementation.version },
            reasonCode,
          });
      }
      return { selectable, rejected };
    };
    return {
      document,
      registrySha256: canonicalSha256(document),
      runtimesByRef,
      providersByRef,
      modelsByRef,
      adaptersByRef,
      compilersByRef,
      implementationsByRef,
      explainResolution,
      resolveExact(reference) {
        const implementation = implementationsByRef.get(refKey(reference));
        if (!implementation)
          throw new Error(`IMPLEMENTATION_VERSION_UNKNOWN: ${refKey(reference)}`);
        return implementation;
      },
      resolveSelectable(options = {}) {
        return explainResolution(options).selectable;
      },
    };
  }
}

function resolveCapabilityRegistryPath() {
  if (process.env.PROJECT_CAPABILITY_REGISTRY_PATH)
    return resolve(process.env.PROJECT_CAPABILITY_REGISTRY_PATH);
  const candidates = [
    resolve(process.cwd(), "generation/registry-v2.json"),
    resolve(process.cwd(), "../../generation/registry-v2.json"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}
