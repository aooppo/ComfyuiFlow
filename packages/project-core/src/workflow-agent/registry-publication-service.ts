import { randomUUID } from "node:crypto";
import {
  CostPolicyV2Schema,
  DiscoveryCandidateV2Schema,
  ImplementationEvidenceV2Schema,
  RegistryPublicationV2Schema,
  type DiscoveryCandidateV2,
  type ImplementationEvidenceV2,
  type RegistryPublicationV2,
} from "@comfyuiflow/contracts";
import type { Prisma } from "../generated/client/index.js";
import { canonicalSha256 } from "../canonical-json.js";
import { ProjectAssetError } from "../contracts.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import type { LoadedCapabilityRegistry } from "./capability-registry.js";
import { CapabilityCompilerRegistry } from "./compiler-registry.js";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const refKey = (value: { id: string; version: string }) => `${value.id}@${value.version}`;

export class RegistryPublicationValidationError extends ProjectAssetError {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(code, message, 409);
    this.name = "RegistryPublicationValidationError";
  }
}

export function validateReviewedPublication(
  registry: LoadedCapabilityRegistry,
  rawCandidate: DiscoveryCandidateV2,
  rawPublication: RegistryPublicationV2,
) {
  const candidate = DiscoveryCandidateV2Schema.parse(rawCandidate);
  const publication = RegistryPublicationV2Schema.parse(rawPublication);
  const fail = (code: string): never => {
    throw new RegistryPublicationValidationError(code);
  };
  if (
    refKey(publication.candidateRef) !== refKey(candidate) ||
    publication.sourceDigest !== candidate.sourceDigest
  )
    fail("DISCOVERY_SOURCE_DIGEST_MISMATCH");
  if (candidate.status !== "DISCOVERED") fail("CANDIDATE_NOT_DISCOVERED");
  const foundImplementation = registry.document.implementations.find(
    (item) => refKey(item) === refKey(publication.implementationRef),
  );
  if (!foundImplementation) fail("IMPLEMENTATION_VERSION_CONFLICT");
  const implementation = foundImplementation as NonNullable<typeof foundImplementation>;
  if (implementation.lifecycle !== "DISCOVERED") fail("IMPLEMENTATION_VERSION_CONFLICT");
  if (
    refKey(implementation.providerRef) !== refKey(publication.providerRef) ||
    !registry.providersByRef.has(refKey(publication.providerRef))
  )
    fail("PROVIDER_IDENTITY_UNRESOLVED");
  if (
    refKey(implementation.modelRef) !== refKey(publication.modelRef) ||
    !registry.modelsByRef.has(refKey(publication.modelRef))
  )
    fail("MODEL_IDENTITY_UNRESOLVED");
  if (
    refKey(implementation.adapterRef) !== refKey(publication.adapterRef) ||
    !registry.adaptersByRef.has(refKey(publication.adapterRef))
  )
    fail("ADAPTER_IDENTITY_UNRESOLVED");
  const foundCompiler = registry.compilersByRef.get(refKey(publication.compilerRef));
  if (!foundCompiler) fail("INPUT_SEMANTICS_UNREVIEWED");
  const compiler = foundCompiler as NonNullable<typeof foundCompiler>;
  if (refKey(implementation.compilerRef) !== refKey(publication.compilerRef))
    fail("INPUT_SEMANTICS_UNREVIEWED");
  if (compiler.sourceDigest !== candidate.sourceDigest) fail("COMPILER_VALIDATION_FAILED");
  try {
    new CapabilityCompilerRegistry().resolveExact(compiler, publication.compilerRef);
  } catch {
    fail("COMPILER_VALIDATION_FAILED");
  }
  if (
    canonicalSha256(CostPolicyV2Schema.parse(publication.costPolicy)) !==
    canonicalSha256(implementation.costPolicy)
  )
    fail("COST_POLICY_UNRESOLVED");
  return { implementationLifecycle: "TRIAL" as const, publication };
}

export class RegistryPublicationService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async syncRegistry(registry: LoadedCapabilityRegistry) {
    return this.client.$transaction(async (transaction) => {
      for (const item of registry.document.runtimes) {
        const payloadHash = canonicalSha256(item);
        const existing = await transaction.capabilityRuntimeProfile.findUnique({
          where: { profileKey_version: { profileKey: item.id, version: item.version } },
        });
        if (existing && existing.payloadHash !== payloadHash)
          throw new Error(`RUNTIME_VERSION_CONFLICT:${item.id}@${item.version}`);
        if (!existing)
          await transaction.capabilityRuntimeProfile.create({
            data: {
              id: randomUUID(),
              profileKey: item.id,
              version: item.version,
              kind: item.kind,
              payloadJson: json(item),
              payloadHash,
            },
          });
      }
      for (const item of registry.document.providers) {
        const payloadHash = canonicalSha256(item);
        const existing = await transaction.capabilityProviderProfile.findUnique({
          where: { profileKey_version: { profileKey: item.id, version: item.version } },
        });
        if (existing && existing.payloadHash !== payloadHash)
          throw new Error(`PROVIDER_VERSION_CONFLICT:${item.id}@${item.version}`);
        if (!existing)
          await transaction.capabilityProviderProfile.create({
            data: {
              id: randomUUID(),
              profileKey: item.id,
              version: item.version,
              kind: item.kind,
              payloadJson: json(item),
              payloadHash,
            },
          });
      }
      for (const item of registry.document.models) {
        const payloadHash = canonicalSha256(item);
        const existing = await transaction.capabilityModelProfile.findUnique({
          where: { profileKey_version: { profileKey: item.id, version: item.version } },
        });
        if (existing && existing.payloadHash !== payloadHash)
          throw new Error(`MODEL_VERSION_CONFLICT:${item.id}@${item.version}`);
        if (!existing)
          await transaction.capabilityModelProfile.create({
            data: {
              id: randomUUID(),
              profileKey: item.id,
              version: item.version,
              providerKey: item.providerRef.id,
              providerVersion: item.providerRef.version,
              payloadJson: json(item),
              payloadHash,
            },
          });
      }
      for (const item of registry.document.adapters) {
        const payloadHash = canonicalSha256(item);
        const existing = await transaction.capabilityAdapterProfile.findUnique({
          where: { profileKey_version: { profileKey: item.id, version: item.version } },
        });
        if (existing && existing.payloadHash !== payloadHash)
          throw new Error(`ADAPTER_VERSION_CONFLICT:${item.id}@${item.version}`);
        if (!existing)
          await transaction.capabilityAdapterProfile.create({
            data: {
              id: randomUUID(),
              profileKey: item.id,
              version: item.version,
              factoryKey: item.factoryKey,
              payloadJson: json(item),
              payloadHash,
            },
          });
      }
      for (const item of registry.document.compilers) {
        const payloadHash = canonicalSha256(item);
        const existing = await transaction.capabilityCompilerProfile.findUnique({
          where: { profileKey_version: { profileKey: item.id, version: item.version } },
        });
        if (existing && existing.payloadHash !== payloadHash)
          throw new Error(`COMPILER_VERSION_CONFLICT:${item.id}@${item.version}`);
        if (!existing)
          await transaction.capabilityCompilerProfile.create({
            data: {
              id: randomUUID(),
              profileKey: item.id,
              version: item.version,
              compilerKey: item.compilerKey,
              payloadJson: json(item),
              payloadHash,
            },
          });
      }
      for (const item of registry.document.implementations) {
        const compositionHash = canonicalSha256(item);
        const existing = await transaction.capabilityGenerationImplementation.findUnique({
          where: {
            implementationKey_version: { implementationKey: item.id, version: item.version },
          },
        });
        if (existing && existing.compositionHash !== compositionHash)
          throw new Error(`IMPLEMENTATION_VERSION_CONFLICT:${item.id}@${item.version}`);
        if (!existing)
          await transaction.capabilityGenerationImplementation.create({
            data: {
              id: randomUUID(),
              implementationKey: item.id,
              version: item.version,
              runtimeKey: item.runtimeRef.id,
              runtimeVersion: item.runtimeRef.version,
              providerKey: item.providerRef.id,
              providerVersion: item.providerRef.version,
              modelKey: item.modelRef.id,
              modelVersion: item.modelRef.version,
              adapterKey: item.adapterRef.id,
              adapterVersion: item.adapterRef.version,
              compilerKey: item.compilerRef.id,
              compilerVersion: item.compilerRef.version,
              capabilityJson: json(item.capabilityCodes),
              costPolicyJson: json(item.costPolicy),
              compositionHash,
              lifecycle: item.lifecycle,
              evidencePolicy: item.evidencePolicy,
              testOnly: item.testOnly,
            },
          });
      }
      return { registrySha256: registry.registrySha256 };
    });
  }

  async persistPublication(raw: RegistryPublicationV2, registry?: LoadedCapabilityRegistry) {
    const publication = RegistryPublicationV2Schema.parse(raw);
    return this.client.$transaction(async (transaction) => {
      const candidate = await transaction.capabilityDiscoveryCandidate.findUniqueOrThrow({
        where: {
          candidateKey_version: {
            candidateKey: publication.candidateRef.id,
            version: publication.candidateRef.version,
          },
        },
      });
      if (candidate.sourceDigest !== publication.sourceDigest)
        throw new Error("DISCOVERY_SOURCE_DIGEST_MISMATCH");
      const implementation = await transaction.capabilityGenerationImplementation.findUniqueOrThrow(
        {
          where: {
            implementationKey_version: {
              implementationKey: publication.implementationRef.id,
              version: publication.implementationRef.version,
            },
          },
        },
      );
      if (registry) {
        const rawCandidate = DiscoveryCandidateV2Schema.parse(candidate.normalizedJson);
        validateReviewedPublication(registry, rawCandidate, publication);
      }
      const publicationHash = canonicalSha256(publication);
      const existing = await transaction.capabilityRegistryPublication.findUnique({
        where: {
          publicationKey_version: { publicationKey: publication.id, version: publication.version },
        },
      });
      if (existing) {
        if (existing.publicationHash !== publicationHash)
          throw new Error("PUBLICATION_VERSION_CONFLICT");
        return existing;
      }
      const created = await transaction.capabilityRegistryPublication.create({
        data: {
          id: randomUUID(),
          publicationKey: publication.id,
          version: publication.version,
          candidateKey: publication.candidateRef.id,
          candidateVersion: publication.candidateRef.version,
          sourceDigest: publication.sourceDigest,
          implementationKey: publication.implementationRef.id,
          implementationVersion: publication.implementationRef.version,
          reviewedCompositionJson: json(publication),
          publicationHash,
          reviewerRef: publication.reviewerRef,
          reviewedAt: new Date(publication.reviewedAt),
        },
      });
      await transaction.capabilityDiscoveryCandidate.update({
        where: { id: candidate.id },
        data: { status: "PUBLISHED", statusUpdatedAt: new Date() },
      });
      if (implementation.lifecycle === "DISCOVERED")
        await transaction.capabilityGenerationImplementation.update({
          where: { id: implementation.id },
          data: {
            lifecycle: "TRIAL",
            lifecycleReasonCode: "REVIEWED_PUBLICATION",
            lifecycleUpdatedAt: new Date(publication.reviewedAt),
          },
        });
      return created;
    });
  }

  async appendEvidence(raw: ImplementationEvidenceV2) {
    const evidence = ImplementationEvidenceV2Schema.parse(raw);
    const evidenceHash = canonicalSha256(evidence);
    const unique = {
      implementationKey_implementationVersion_kind_evidenceHash: {
        implementationKey: evidence.implementationRef.id,
        implementationVersion: evidence.implementationRef.version,
        kind: evidence.kind,
        evidenceHash,
      },
    };
    const existing = await this.client.capabilityImplementationEvidence.findUnique({
      where: unique,
    });
    if (existing) return existing;
    return this.client.capabilityImplementationEvidence.create({
      data: {
        id: randomUUID(),
        implementationKey: evidence.implementationRef.id,
        implementationVersion: evidence.implementationRef.version,
        compilerKey: evidence.compilerRef.id,
        compilerVersion: evidence.compilerRef.version,
        kind: evidence.kind,
        outcome: evidence.outcome,
        evidenceJson: json(evidence),
        evidenceHash,
        callCount: evidence.callCount,
        costDigest: evidence.costDigest,
        reviewerRef: evidence.reviewerRef,
        recordedAt: new Date(evidence.recordedAt),
      },
    });
  }
}
