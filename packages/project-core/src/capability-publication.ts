import { canonicalSha256 } from "./canonical-json.js";
import { parseCapabilityPack, type ParsedCapabilityPack } from "./capability-pack.js";
import type {
  CapabilityRef,
  GenerationImplementation,
  RuntimeContract,
} from "./capability-registry.js";
import { builtInGraphCompilerProfileIds } from "./graph-intent.js";

export interface ServerOwnedCapabilityAssets {
  providerRef: CapabilityRef;
  adapterRef: CapabilityRef;
  validatorRef: CapabilityRef;
  compilerVersion: string;
}

export const defaultServerOwnedCapabilityAssets: Readonly<ServerOwnedCapabilityAssets> =
  Object.freeze({
    providerRef: { id: "provider.comfyui-mcp", version: "1.0.0" },
    adapterRef: { id: "adapter.comfyui-mcp", version: "1.0.0" },
    validatorRef: { id: "validator.zero-call-graph", version: "1.0.0" },
    compilerVersion: "1.0.0",
  });

export interface CapabilityPublicationRegistration {
  readonly pack: ParsedCapabilityPack;
  readonly capabilityRef: CapabilityRef;
  readonly runtimeContract: RuntimeContract;
  readonly implementation: GenerationImplementation & { readonly digest: string };
  readonly receiptDigest: string;
}

/**
 * Convert a verified Pack to the immutable registry records. The Pack chooses
 * the model, runtime target and reviewed compiler profile. Provider, adapter,
 * compiler version and validator are owned and frozen by the server.
 */
export function prepareCapabilityPublication(
  input: unknown,
  assets: ServerOwnedCapabilityAssets = defaultServerOwnedCapabilityAssets,
): CapabilityPublicationRegistration {
  const pack = parseCapabilityPack(input);
  if (!builtInGraphCompilerProfileIds.includes(pack.compilerProfile as "reference-video-v1"))
    throw new Error("CAPABILITY_PACK_COMPILER_PROFILE_NOT_REGISTERED");
  const capabilityRef = { id: `capability.${pack.packId}`, version: pack.packVersion };
  const runtimeRef = { id: `runtime-contract.${pack.packId}`, version: pack.packVersion };
  const compilerRef = { id: `compiler.${pack.compilerProfile}`, version: assets.compilerVersion };
  const runtimeContract: RuntimeContract = {
    ref: runtimeRef,
    capabilityRef,
    nodeClasses: pack.requiredNodes,
    digest: canonicalSha256({
      schemaVersion: 1,
      capabilityRef,
      runtimeRef,
      runtimeTargetRef: pack.runtimeTargetRef,
      nodeClasses: pack.requiredNodes,
    }),
  };
  const implementationBase: GenerationImplementation = {
    ref: { id: `implementation.${pack.packId}`, version: pack.packVersion },
    capabilityRef,
    runtimeRef,
    providerRef: assets.providerRef,
    modelRef: { id: pack.model.id, version: pack.model.version },
    adapterRef: assets.adapterRef,
    compilerRef,
    validatorRef: assets.validatorRef,
    lifecycle: "TRIAL",
  };
  const implementation = Object.freeze({
    ...implementationBase,
    digest: canonicalSha256({
      ...implementationBase,
      runtimeContractDigest: runtimeContract.digest,
    }),
  });
  return Object.freeze({
    pack,
    capabilityRef: Object.freeze(capabilityRef),
    runtimeContract: Object.freeze(runtimeContract),
    implementation,
    receiptDigest: canonicalSha256({
      manifestSha256: pack.manifestSha256,
      capabilityRef,
      runtimeContractDigest: runtimeContract.digest,
      implementationRef: implementation.ref,
      implementationDigest: implementation.digest,
      lifecycle: "TRIAL",
    }),
  });
}

export interface CapabilityPublicationStore {
  appendTrialPublication(input: {
    actorRef: string;
    registration: CapabilityPublicationRegistration;
  }): Promise<{ receiptId: string; createdAt: Date }>;
}

export interface CapabilityPublicationReceipt {
  receiptId: string;
  actorRef: string;
  manifestSha256: string;
  capabilityRef: CapabilityRef;
  implementationRef: CapabilityRef;
  lifecycle: "TRIAL";
  createdAt: string;
  externalCalls: 0;
}

export class CapabilityPublicationService {
  constructor(private readonly store: CapabilityPublicationStore) {}

  async publishTrial(input: unknown, actorRef: string): Promise<CapabilityPublicationReceipt> {
    if (!/^[a-z][a-z0-9._-]{1,159}$/i.test(actorRef)) throw new Error("INVALID_PUBLICATION_ACTOR");
    const registration = prepareCapabilityPublication(input);
    const stored = await this.store.appendTrialPublication({ actorRef, registration });
    return {
      receiptId: stored.receiptId,
      actorRef,
      manifestSha256: registration.pack.manifestSha256,
      capabilityRef: registration.capabilityRef,
      implementationRef: registration.implementation.ref,
      lifecycle: "TRIAL",
      createdAt: stored.createdAt.toISOString(),
      externalCalls: 0,
    };
  }
}
