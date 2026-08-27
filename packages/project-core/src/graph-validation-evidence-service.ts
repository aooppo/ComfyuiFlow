import type { ProjectPrisma } from "./prisma.js";

export interface SafeGraphValidationDiagnostic {
  code: string;
  message: string;
  path?: string;
}

export interface GraphPreflightSnapshot {
  graphSnapshotId: string;
  graph: Record<string, unknown>;
  graphSha256: string;
  runtimeContractDigest: string;
  nodeClasses: string[];
  outputNodeId: string;
  outputMediaKey: string;
}

export interface GraphPreflightResult {
  outcome: "PASS" | "FAIL";
  runtimeFingerprintSha256: string | null;
  nodeCatalogSha256: string | null;
  validator: { ref: string; version: string };
  diagnostics: SafeGraphValidationDiagnostic[];
  generationCalls: 0;
}

export interface GraphValidationEvidenceView extends Omit<GraphPreflightResult, "generationCalls"> {
  id: string;
  graphSnapshotId: string;
  graphSha256: string;
  runtimeContractDigest: string;
  createdAt: string;
}

const safeDiagnosticCode = /^[A-Z][A-Z0-9_]{1,79}$/;
const safeText = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length <= maximum &&
  !/(?:secret|token|password|credential|api[_-]?key|https?:|file:|ssh:|\/Users\/|\\\\)/i.test(value)
    ? value
    : undefined;

function sanitizeDiagnostics(input: SafeGraphValidationDiagnostic[]) {
  return input.slice(0, 100).map((item): SafeGraphValidationDiagnostic => {
    const path = safeText(item.path, 320);
    return {
      code: safeDiagnosticCode.test(item.code) ? item.code : "VALIDATION_ERROR",
      message: safeText(item.message, 300) ?? "Graph technical validation failed.",
      ...(path ? { path } : {}),
    };
  });
}

function uuid(value: string, field: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new Error(`INVALID_${field}`);
}

/** Server-owned persistence for immutable, per-frozen-graph technical evidence. */
export class GraphValidationEvidenceService {
  constructor(private readonly prisma: ProjectPrisma) {}

  async loadPreflightSnapshot(graphSnapshotId: string): Promise<GraphPreflightSnapshot> {
    uuid(graphSnapshotId, "GRAPH_SNAPSHOT_ID");
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        graphJson: Record<string, unknown>;
        graphSha256: string;
        graphRuntimeContractDigest: string;
        runtimeContractDigest: string;
        nodeClassesJson: unknown;
        outputNodeId: string;
        outputMediaKey: string;
      }>
    >(
      `SELECT g."id", g."graphJson", g."graphSha256", g."runtimeContractDigest" AS "graphRuntimeContractDigest", r."digest" AS "runtimeContractDigest", r."nodeClassesJson", g."outputNodeId", g."outputMediaKey"
       FROM "MaterializedGraphSnapshot" g
       JOIN "GenerationSpec" s ON s."id" = g."generationSpecId"
       JOIN "RuntimeContract" r ON r."id" = s."runtimeContractId"
       WHERE g."id" = $1`,
      graphSnapshotId,
    );
    const row = rows[0];
    if (!row || row.graphRuntimeContractDigest !== row.runtimeContractDigest)
      throw new Error("FROZEN_GRAPH_OR_RUNTIME_CONTRACT_NOT_FOUND");
    const nodeClasses = Array.isArray(row.nodeClassesJson)
      ? row.nodeClassesJson.filter((item): item is string => typeof item === "string").slice(0, 100)
      : [];
    if (!nodeClasses.length) throw new Error("RUNTIME_CONTRACT_NODE_CLASSES_INVALID");
    return {
      graphSnapshotId: row.id,
      graph: row.graphJson,
      graphSha256: row.graphSha256,
      runtimeContractDigest: row.runtimeContractDigest,
      nodeClasses,
      outputNodeId: row.outputNodeId,
      outputMediaKey: row.outputMediaKey,
    };
  }

  async preflight(
    graphSnapshotId: string,
    runner: (snapshot: GraphPreflightSnapshot) => Promise<GraphPreflightResult>,
  ): Promise<GraphValidationEvidenceView> {
    const snapshot = await this.loadPreflightSnapshot(graphSnapshotId);
    const result = await runner(snapshot);
    if (result.generationCalls !== 0) throw new Error("GRAPH_PREFLIGHT_MUST_BE_ZERO_CALL");
    const diagnostics = sanitizeDiagnostics(result.diagnostics);
    const outcome = result.outcome === "PASS" && diagnostics.length === 0 ? "PASS" : "FAIL";
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        createdAt: Date;
      }>
    >(
      `INSERT INTO "GraphValidationEvidence" ("graphSnapshotId", "graphSha256", "runtimeContractDigest", "runtimeFingerprintSha256", "nodeCatalogSha256", "validatorRef", "validatorVersion", "outcome", "diagnosticsJson")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"GraphValidationOutcome", $9::jsonb)
       RETURNING "id", "createdAt"`,
      snapshot.graphSnapshotId,
      snapshot.graphSha256,
      snapshot.runtimeContractDigest,
      result.runtimeFingerprintSha256,
      result.nodeCatalogSha256,
      result.validator.ref,
      result.validator.version,
      outcome,
      JSON.stringify(diagnostics),
    );
    const row = rows[0];
    if (!row) throw new Error("GRAPH_VALIDATION_EVIDENCE_APPEND_FAILED");
    return {
      id: row.id,
      graphSnapshotId: snapshot.graphSnapshotId,
      graphSha256: snapshot.graphSha256,
      runtimeContractDigest: snapshot.runtimeContractDigest,
      runtimeFingerprintSha256: result.runtimeFingerprintSha256,
      nodeCatalogSha256: result.nodeCatalogSha256,
      validator: result.validator,
      outcome,
      diagnostics,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(graphSnapshotId: string): Promise<GraphValidationEvidenceView[]> {
    uuid(graphSnapshotId, "GRAPH_SNAPSHOT_ID");
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        graphSnapshotId: string;
        graphSha256: string;
        runtimeContractDigest: string;
        runtimeFingerprintSha256: string | null;
        nodeCatalogSha256: string | null;
        validatorRef: string;
        validatorVersion: string;
        outcome: "PASS" | "FAIL";
        diagnosticsJson: SafeGraphValidationDiagnostic[];
        createdAt: Date;
      }>
    >(
      `SELECT "id", "graphSnapshotId", "graphSha256", "runtimeContractDigest", "runtimeFingerprintSha256", "nodeCatalogSha256", "validatorRef", "validatorVersion", "outcome", "diagnosticsJson", "createdAt"
       FROM "GraphValidationEvidence" WHERE "graphSnapshotId" = $1 ORDER BY "createdAt" DESC, "id" DESC`,
      graphSnapshotId,
    );
    return rows.map((row) => ({
      id: row.id,
      graphSnapshotId: row.graphSnapshotId,
      graphSha256: row.graphSha256,
      runtimeContractDigest: row.runtimeContractDigest,
      runtimeFingerprintSha256: row.runtimeFingerprintSha256,
      nodeCatalogSha256: row.nodeCatalogSha256,
      validator: { ref: row.validatorRef, version: row.validatorVersion },
      outcome: row.outcome,
      diagnostics: sanitizeDiagnostics(
        Array.isArray(row.diagnosticsJson) ? row.diagnosticsJson : [],
      ),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
