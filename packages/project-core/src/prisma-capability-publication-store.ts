import type { ProjectPrisma } from "./prisma.js";
import type { Prisma } from "./generated/client/index.js";
import type {
  CapabilityPublicationRegistration,
  CapabilityPublicationStore,
} from "./capability-publication.js";

/** PostgreSQL append-only importer. It writes no credentials and makes no runtime or provider call. */
export class PrismaCapabilityPublicationStore implements CapabilityPublicationStore {
  constructor(private readonly client: ProjectPrisma) {}

  async appendTrialPublication({
    actorRef,
    registration,
  }: {
    actorRef: string;
    registration: CapabilityPublicationRegistration;
  }): Promise<{ receiptId: string; createdAt: Date }> {
    return this.client.$transaction(async (tx) => {
      const profile = await tx.capabilityProfile.create({
        data: {
          ref: registration.capabilityRef.id,
          version: registration.capabilityRef.version,
          schemaVersion: 1,
          payloadJson: asJson(registration.pack),
          digest: registration.pack.manifestSha256,
        },
      });
      const runtime = await tx.runtimeContract.create({
        data: {
          capabilityProfileId: profile.id,
          ref: registration.runtimeContract.ref.id,
          version: registration.runtimeContract.ref.version,
          nodeClassesJson: asJson(registration.runtimeContract.nodeClasses),
          digest: registration.runtimeContract.digest,
        },
      });
      const implementation = await tx.generationImplementation.create({
        data: {
          capabilityProfileId: profile.id,
          runtimeContractId: runtime.id,
          ref: registration.implementation.ref.id,
          version: registration.implementation.ref.version,
          providerRef: asJson(registration.implementation.providerRef),
          modelRef: asJson(registration.implementation.modelRef),
          adapterRef: asJson(registration.implementation.adapterRef),
          compilerRef: asJson(registration.implementation.compilerRef),
          validatorRef: asJson(registration.implementation.validatorRef),
          lifecycle: "TRIAL",
          digest: registration.implementation.digest,
        },
      });
      const receipt = await tx.capabilityPublicationReceipt.create({
        data: {
          actorRef,
          manifestJson: asJson(registration.pack),
          manifestSha256: registration.pack.manifestSha256,
          capabilityProfileId: profile.id,
          implementationId: implementation.id,
          receiptDigest: registration.receiptDigest,
        },
      });
      return { receiptId: receipt.id, createdAt: receipt.createdAt };
    });
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
