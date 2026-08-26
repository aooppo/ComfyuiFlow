import {
  GenerationImplementationV2Schema,
  ImplementationEvidenceV2Schema,
  type GenerationImplementationV2,
  type ImplementationEvidenceV2,
} from "@comfyuiflow/contracts";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { canonicalSha256 } from "../canonical-json.js";
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

  /** Derives, rather than accepts, evidence from one complete persisted V3 attempt. */
  async appendAuthorizedRealEvidence(input: {
    attemptId: string;
    artifactId: string;
    operatorRef: string;
  }) {
    const attempt = await this.client.generationAttemptV3Record.findUnique({
      where: { id: input.attemptId },
    });
    const artifact = await this.client.generationArtifactV3Record.findUnique({
      where: { id: input.artifactId },
    });
    if (
      !attempt ||
      !artifact ||
      artifact.attemptId !== attempt.id ||
      attempt.state !== "SUCCEEDED" ||
      artifact.technicalStatus !== "VERIFIED"
    )
      throw new Error("REAL_EVIDENCE_TECHNICAL_PASS_REQUIRED");
    const payload = artifact.payloadJson as { reviewFrames?: unknown[] };
    if (
      !Array.isArray(payload.reviewFrames) ||
      payload.reviewFrames.length !== 3 ||
      !artifact.ffprobeJson
    )
      throw new Error("REAL_EVIDENCE_ARTIFACT_FACTS_REQUIRED");
    const target = await this.client.generationBatchTargetV3Record.findUnique({
      where: { id: attempt.generationBatchTargetId },
      include: { generationBatch: { include: { authorization: true } } },
    });
    const submit = await this.client.authorizationConsumptionV3Record.findFirst({
      where: { attemptId: attempt.id, operation: "SUBMIT" },
    });
    const qa = await this.client.aiQaRunV3Record.findUnique({ where: { attemptId: attempt.id } });
    const qaResult = qa
      ? await this.client.aiQaResultV3Record.findUnique({ where: { aiQaRunId: qa.id } })
      : null;
    const owner = await this.client.generationOwnerDecisionV3Record.findFirst({
      where: { artifactId: artifact.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (
      !target ||
      !submit ||
      !qa ||
      qa.status !== "COMPLETED" ||
      !qaResult ||
      !owner ||
      owner.decision !== "PASS" ||
      !target.generationBatch.authorization.aiQaPricingJson
    )
      throw new Error("REAL_EVIDENCE_QA_OR_OWNER_PASS_REQUIRED");
    const evidence = {
      id: `authorized-real-evidence-${attempt.id}`,
      version: "1.0.0",
      implementationRef: { id: target.implementationKey, version: target.implementationVersion },
      compilerRef: { id: target.compilerKey, version: target.compilerVersion },
      kind: "AUTHORIZED_REAL_EXECUTION" as const,
      outcome: "PASS" as const,
      callCount: submit.consumedCalls + qa.providerCallCount,
      costDigest: canonicalSha256({
        video: target.generationBatch.maximumCostMicros?.toString() ?? null,
        qa: target.generationBatch.maximumAiQaCostMicros?.toString() ?? null,
        total: target.generationBatch.maximumTotalCostMicros?.toString() ?? null,
        pricing: target.generationBatch.authorization.aiQaPricingJson,
      }),
      artifactRefs: [{ id: "generation-artifact-v3", version: artifact.sha256 }],
      reviewerRef: input.operatorRef,
      recordedAt: new Date().toISOString(),
    } satisfies ImplementationEvidenceV2;
    return this.append(evidence);
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
