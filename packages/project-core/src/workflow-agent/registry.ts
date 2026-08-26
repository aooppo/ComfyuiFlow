import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  GenerationRegistrySchema,
  type GenerationImplementation,
  type GenerationRegistry,
} from "@comfyuiflow/contracts";
import { canonicalSha256 } from "../canonical-json.js";

export interface LoadedGenerationRegistry {
  document: GenerationRegistry;
  registrySha256: string;
  providersById: ReadonlyMap<string, GenerationRegistry["providers"][number]>;
  modelsById: ReadonlyMap<string, GenerationRegistry["models"][number]>;
  implementationsById: ReadonlyMap<string, GenerationImplementation>;
}

function normalizeRegistry(document: GenerationRegistry): GenerationRegistry {
  return {
    ...document,
    providers: [...document.providers].sort((a, b) => a.providerId.localeCompare(b.providerId)),
    models: [...document.models].sort((a, b) => a.modelProfileId.localeCompare(b.modelProfileId)),
    implementations: [...document.implementations]
      .map((implementation) => ({
        ...implementation,
        capabilities: [...implementation.capabilities].sort(),
        referenceSlots: [...implementation.referenceSlots].sort(),
        referenceWorkflowIds: [...implementation.referenceWorkflowIds].sort(),
        patternIds: [...implementation.patternIds].sort(),
        nodeClasses: [...implementation.nodeClasses].sort(),
      }))
      .sort((a, b) =>
        `${a.implementationId}@${a.version}`.localeCompare(`${b.implementationId}@${b.version}`),
      ),
  };
}

export class GenerationRegistryLoader {
  constructor(readonly registryPath = resolveRegistryPath()) {}

  async load(): Promise<LoadedGenerationRegistry> {
    const parsed = GenerationRegistrySchema.parse(
      JSON.parse(await readFile(this.registryPath, "utf8")),
    );
    const document = normalizeRegistry(parsed);
    return {
      document,
      registrySha256: canonicalSha256(document),
      providersById: new Map(document.providers.map((item) => [item.providerId, item])),
      modelsById: new Map(document.models.map((item) => [item.modelProfileId, item])),
      implementationsById: new Map(
        document.implementations.map((item) => [item.implementationId, item]),
      ),
    };
  }
}

function resolveRegistryPath() {
  if (process.env.PROJECT_GENERATION_REGISTRY_PATH)
    return resolve(process.env.PROJECT_GENERATION_REGISTRY_PATH);
  const candidates = [
    resolve(process.cwd(), "generation/registry.json"),
    resolve(process.cwd(), "../../generation/registry.json"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}
