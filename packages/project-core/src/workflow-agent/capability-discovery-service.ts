import { randomUUID } from "node:crypto";
import { DiscoveryCandidateV2Schema, type DiscoveryCandidateV2 } from "@comfyuiflow/contracts";
import type { Prisma } from "../generated/client/index.js";
import { canonicalSha256 } from "../canonical-json.js";
import { prisma, type ProjectPrisma } from "../prisma.js";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export class CapabilityDiscoveryService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async persistCandidate(raw: DiscoveryCandidateV2) {
    const candidate = DiscoveryCandidateV2Schema.parse({ ...raw, status: "DISCOVERED" });
    const payloadHash = canonicalSha256(candidate);
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.capabilityDiscoveryCandidate.findUnique({
        where: {
          candidateKey_version: { candidateKey: candidate.id, version: candidate.version },
        },
      });
      if (existing) {
        if (canonicalSha256(existing.normalizedJson) !== payloadHash)
          throw new Error("DISCOVERY_VERSION_CONFLICT");
        return existing;
      }

      await transaction.capabilityDiscoveryCandidate.updateMany({
        where: {
          runtimeKey: candidate.runtimeRef.id,
          runtimeVersion: candidate.runtimeRef.version,
          nodeIdentifier: candidate.nodeIdentifier,
          sourceDigest: { not: candidate.sourceDigest },
          status: "DISCOVERED",
        },
        data: {
          status: "REVIEW_REJECTED",
          statusReason: "SCHEMA_SUPERSEDED",
          statusUpdatedAt: new Date(candidate.discoveredAt),
        },
      });

      return transaction.capabilityDiscoveryCandidate.create({
        data: {
          id: randomUUID(),
          candidateKey: candidate.id,
          version: candidate.version,
          runtimeKey: candidate.runtimeRef.id,
          runtimeVersion: candidate.runtimeRef.version,
          sourceDigest: candidate.sourceDigest,
          nodeIdentifier: candidate.nodeIdentifier,
          normalizedJson: json(candidate),
          rawSchemaRef: candidate.rawSchemaRef,
          status: "DISCOVERED",
          discoveredAt: new Date(candidate.discoveredAt),
          statusUpdatedAt: new Date(candidate.discoveredAt),
        },
      });
    });
  }

  async listCandidates() {
    return this.client.capabilityDiscoveryCandidate.findMany({
      orderBy: [{ discoveredAt: "desc" }, { candidateKey: "asc" }],
    });
  }
}
