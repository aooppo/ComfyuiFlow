import { canonicalSha256 } from "./canonical-json.js";

export interface CapabilityRef {
  id: string;
  version: string;
}

export interface RuntimeContract {
  ref: CapabilityRef;
  capabilityRef: CapabilityRef;
  nodeClasses: readonly string[];
  digest: string;
}

export interface GenerationImplementation {
  ref: CapabilityRef;
  capabilityRef: CapabilityRef;
  runtimeRef: CapabilityRef;
  providerRef: CapabilityRef;
  modelRef: CapabilityRef;
  adapterRef: CapabilityRef;
  compilerRef: CapabilityRef;
  validatorRef: CapabilityRef;
  lifecycle: "TRIAL" | "READY" | "RETIRED";
}

export interface CapabilityProfile {
  ref: CapabilityRef;
  schemaVersion: 1;
  runtimeContracts: readonly RuntimeContract[];
  implementations: readonly GenerationImplementation[];
}

const key = (ref: CapabilityRef) => `${ref.id}@${ref.version}`;

export class CapabilityRegistry {
  readonly digest: string;
  private readonly capabilities = new Map<string, CapabilityProfile>();
  private readonly runtimes = new Map<string, RuntimeContract>();
  private readonly implementations = new Map<string, GenerationImplementation>();

  constructor(profiles: readonly CapabilityProfile[]) {
    for (const profile of profiles) this.register(profile);
    this.digest = canonicalSha256({
      schemaVersion: 1,
      profiles: profiles.map((profile) => ({
        ref: profile.ref,
        runtimeContracts: profile.runtimeContracts,
        implementations: profile.implementations,
      })),
    });
  }

  resolveRuntime(ref: CapabilityRef) {
    const runtime = this.runtimes.get(key(ref));
    if (!runtime) throw new Error(`RUNTIME_CONTRACT_NOT_REGISTERED:${key(ref)}`);
    return runtime;
  }

  resolveImplementation(ref: CapabilityRef) {
    const implementation = this.implementations.get(key(ref));
    if (!implementation) throw new Error(`IMPLEMENTATION_NOT_REGISTERED:${key(ref)}`);
    return implementation;
  }

  selectable() {
    return [...this.implementations.values()].filter((item) => item.lifecycle !== "RETIRED");
  }

  private register(profile: CapabilityProfile) {
    const profileKey = key(profile.ref);
    if (this.capabilities.has(profileKey)) throw new Error(`DUPLICATE_CAPABILITY:${profileKey}`);
    this.capabilities.set(profileKey, profile);
    for (const runtime of profile.runtimeContracts) {
      if (key(runtime.capabilityRef) !== profileKey)
        throw new Error(`RUNTIME_CONTRACT_OWNERSHIP_MISMATCH:${key(runtime.ref)}`);
      if (!/^[a-f0-9]{64}$/.test(runtime.digest))
        throw new Error(`RUNTIME_CONTRACT_DIGEST_INVALID:${key(runtime.ref)}`);
      const runtimeKey = key(runtime.ref);
      if (this.runtimes.has(runtimeKey))
        throw new Error(`DUPLICATE_RUNTIME_CONTRACT:${runtimeKey}`);
      this.runtimes.set(runtimeKey, runtime);
    }
    for (const implementation of profile.implementations) {
      if (key(implementation.capabilityRef) !== profileKey)
        throw new Error(`IMPLEMENTATION_OWNERSHIP_MISMATCH:${key(implementation.ref)}`);
      const runtime = this.resolveRuntime(implementation.runtimeRef);
      if (key(runtime.capabilityRef) !== profileKey)
        throw new Error(`IMPLEMENTATION_RUNTIME_MISMATCH:${key(implementation.ref)}`);
      const implementationKey = key(implementation.ref);
      if (this.implementations.has(implementationKey))
        throw new Error(`DUPLICATE_IMPLEMENTATION:${implementationKey}`);
      this.implementations.set(implementationKey, implementation);
    }
  }
}
