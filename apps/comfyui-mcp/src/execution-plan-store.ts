import type { ComfyUiMainlineExecutionStore } from "@comfyuiflow/comfyui-bridge";
import type { ProjectPrisma, StorageProvider } from "@comfyuiflow/project-core";

export function createPrismaMainlineExecutionStore(input: {
  prisma: ProjectPrisma;
  sourceStorage: StorageProvider;
  generatedStorage: StorageProvider;
}): ComfyUiMainlineExecutionStore {
  type Row = {
    id: string;
    adapterRef: { id: string; version: string };
    runtimeRef: { id: string; version: string };
    runtimeContractDigest: string;
    graphSha256: string;
    graphValidationEvidenceId: string;
    evidenceGraphSha256: string;
    evidenceRuntimeContractDigest: string;
    evidenceRuntimeFingerprintSha256: string;
    evidenceNodeCatalogSha256: string;
    runtimeNodeClasses: unknown;
    graphJson: Record<string, unknown>;
    outputNodeId: string;
    outputMediaKey: string;
    state: "SUBMITTING" | "SUBMITTED" | "RECONCILING";
    taskId: string | null;
    inputs: unknown;
  };
  const load = async (attemptId: string) => {
    const rows = await input.prisma.$queryRawUnsafe<Row[]>(
      `SELECT a."id", a."adapterRef", a."runtimeRef", a."runtimeContractDigest", a."graphSha256", a."graphValidationEvidenceId", v."graphSha256" AS "evidenceGraphSha256", v."runtimeContractDigest" AS "evidenceRuntimeContractDigest", v."runtimeFingerprintSha256" AS "evidenceRuntimeFingerprintSha256", v."nodeCatalogSha256" AS "evidenceNodeCatalogSha256", c."nodeClassesJson" AS "runtimeNodeClasses", g."graphJson", g."outputNodeId", g."outputMediaKey", e."state", e."taskId", r."payloadJson"->'inputs' AS "inputs"
       FROM "GenerationAttempt" a
       JOIN "GenerationTarget" t ON t."id" = a."generationTargetId"
       JOIN "MaterializedGraphSnapshot" g ON g."generationSpecId" = t."generationSpecId"
       JOIN "GenerationSpec" s ON s."id" = t."generationSpecId"
       JOIN "RuntimeContract" c ON c."id" = s."runtimeContractId" AND c."digest" = a."runtimeContractDigest"
       JOIN "GraphValidationEvidence" v ON v."id" = a."graphValidationEvidenceId" AND v."graphSnapshotId" = g."id" AND v."outcome" = 'PASS' AND v."runtimeFingerprintSha256" IS NOT NULL AND v."nodeCatalogSha256" IS NOT NULL
       JOIN "ReferencePlan" r ON r."id" = g."referencePlanId"
       JOIN LATERAL (SELECT "state", "taskId" FROM "GenerationAttemptEvent" WHERE "attemptId" = a."id" ORDER BY "createdAt" DESC LIMIT 1) e ON true
       WHERE a."id" = $1`,
      attemptId,
    );
    const row = rows[0];
    if (!row || !["SUBMITTING", "SUBMITTED", "RECONCILING"].includes(row.state)) return null;
    const values = Array.isArray(row.inputs) ? row.inputs : [];
    return {
      attemptId: row.id,
      attemptState: row.state,
      providerTaskId: row.taskId ?? row.id,
      adapterRef: row.adapterRef,
      runtimeRef: row.runtimeRef,
      runtimeContractDigest: row.runtimeContractDigest,
      graphSha256: row.graphSha256,
      graphValidationEvidence: {
        id: row.graphValidationEvidenceId,
        outcome: "PASS" as const,
        graphSha256: row.evidenceGraphSha256,
        runtimeContractDigest: row.evidenceRuntimeContractDigest,
        runtimeFingerprintSha256: row.evidenceRuntimeFingerprintSha256,
        nodeCatalogSha256: row.evidenceNodeCatalogSha256,
      },
      runtimeNodeClasses: Array.isArray(row.runtimeNodeClasses)
        ? row.runtimeNodeClasses.filter((value): value is string => typeof value === "string")
        : [],
      graph: row.graphJson,
      outputNodeId: row.outputNodeId,
      outputMediaKey: row.outputMediaKey,
      inputs: await Promise.all(
        values.map(async (value) => {
          const item = value as {
            storage: "SOURCE" | "GENERATED";
            storageKey: string;
            sha256: string;
            byteSize: number;
            stagedInputName: string;
          };
          const storage =
            item.storage === "GENERATED" ? input.generatedStorage : input.sourceStorage;
          return {
            localPath: await storage.resolveVerified(item.storageKey, item.sha256, item.byteSize),
            sha256: item.sha256,
            stagedInputName: item.stagedInputName,
          };
        }),
      ),
    };
  };
  return { loadForSubmission: (identity) => load(identity.attemptId), loadSubmitted: load };
}
