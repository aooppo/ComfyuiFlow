import {
  GenerationImplementationV2Schema,
  ImplementationEvidenceV2Schema,
  type GenerationImplementationV2,
  type ImplementationEvidenceV2,
} from "@comfyuiflow/contracts";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { RegistryPublicationService } from "./registry-publication-service.js";

const sameRef = (left: { id: string; version: string }, right: { id: string; version: string }) =>
  left.id === right.id && left.version === right.version;

export function assessReadyPromotion(
  rawImplementation: GenerationImplementationV2,
  rawEvidence: ImplementationEvidenceV2[],
) {
  const implementation = GenerationImplementationV2Schema.parse(rawImplementation);
  const evidence = rawEvidence.map((item) => ImplementationEvidenceV2Schema.parse(item));
  if (implementation.lifecycle !== "TRIAL")
    return { ready: false as const, reasonCode: "IMPLEMENTATION_NOT_TRIAL" as const };
  const exactPass = (kind: ImplementationEvidenceV2["kind"]) =>
    evidence.some(
      (item) =>
        item.kind === kind &&
        item.outcome === "PASS" &&
        sameRef(item.implementationRef, implementation) &&
        sameRef(item.compilerRef, implementation.compilerRef),
    );
  if (!exactPass("CONTRACT"))
    return { ready: false as const, reasonCode: "CONTRACT_EVIDENCE_REQUIRED" as const };
  if (!exactPass("RUNTIME_READINESS"))
    return { ready: false as const, reasonCode: "RUNTIME_READINESS_EVIDENCE_REQUIRED" as const };
  if (implementation.evidencePolicy === "EXACT_VERSION_REAL_RESULT") {
    const exactReal = evidence.some(
      (item) =>
        item.kind === "AUTHORIZED_REAL_EXECUTION" &&
        item.outcome === "PASS" &&
        item.callCount > 0 &&
        (implementation.costPolicy.kind !== "MONETARY" || item.costDigest !== null) &&
        sameRef(item.implementationRef, implementation) &&
        sameRef(item.compilerRef, implementation.compilerRef),
    );
    if (!exactReal)
      return { ready: false as const, reasonCode: "REAL_EXECUTION_EVIDENCE_REQUIRED" as const };
  }
  return { ready: true as const, reasonCode: "EXACT_VERSION_EVIDENCE_ACCEPTED" as const };
}

export class ImplementationEvidenceService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async append(raw: ImplementationEvidenceV2) {
    return new RegistryPublicationService(this.client).appendEvidence(raw);
  }

  async promoteReady(implementationRef: { id: string; version: string }) {
    return this.client.$transaction(async (transaction) => {
      const implementationRow =
        await transaction.capabilityGenerationImplementation.findUniqueOrThrow({
          where: {
            implementationKey_version: {
              implementationKey: implementationRef.id,
              version: implementationRef.version,
            },
          },
        });
      const publication = await transaction.capabilityRegistryPublication.findFirst({
        where: {
          implementationKey: implementationRef.id,
          implementationVersion: implementationRef.version,
        },
      });
      if (!publication) throw new Error("REVIEWED_PUBLICATION_REQUIRED");
      const evidenceRows = await transaction.capabilityImplementationEvidence.findMany({
        where: {
          implementationKey: implementationRef.id,
          implementationVersion: implementationRef.version,
        },
      });
      const implementation = GenerationImplementationV2Schema.parse({
        id: implementationRow.implementationKey,
        version: implementationRow.version,
        runtimeRef: { id: implementationRow.runtimeKey, version: implementationRow.runtimeVersion },
        providerRef: {
          id: implementationRow.providerKey,
          version: implementationRow.providerVersion,
        },
        modelRef: { id: implementationRow.modelKey, version: implementationRow.modelVersion },
        adapterRef: { id: implementationRow.adapterKey, version: implementationRow.adapterVersion },
        compilerRef: {
          id: implementationRow.compilerKey,
          version: implementationRow.compilerVersion,
        },
        capabilityCodes: implementationRow.capabilityJson,
        costPolicy: implementationRow.costPolicyJson,
        lifecycle: implementationRow.lifecycle,
        evidencePolicy: implementationRow.evidencePolicy,
        testOnly: implementationRow.testOnly,
      });
      const assessment = assessReadyPromotion(
        implementation,
        evidenceRows.map((row) => ImplementationEvidenceV2Schema.parse(row.evidenceJson)),
      );
      if (!assessment.ready) throw new Error(assessment.reasonCode);
      return transaction.capabilityGenerationImplementation.update({
        where: { id: implementationRow.id },
        data: {
          lifecycle: "READY",
          lifecycleReasonCode: assessment.reasonCode,
          lifecycleUpdatedAt: new Date(),
        },
      });
    });
  }
}
