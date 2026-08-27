CREATE TYPE "GraphValidationOutcome" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "GraphValidationEvidence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "graphSnapshotId" UUID NOT NULL REFERENCES "MaterializedGraphSnapshot"("id") ON DELETE RESTRICT,
  "graphSha256" CHAR(64) NOT NULL,
  "runtimeContractDigest" CHAR(64) NOT NULL,
  "runtimeFingerprintSha256" CHAR(64),
  "nodeCatalogSha256" CHAR(64),
  "validatorRef" VARCHAR(160) NOT NULL,
  "validatorVersion" VARCHAR(80) NOT NULL,
  "outcome" "GraphValidationOutcome" NOT NULL,
  "diagnosticsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "GraphValidationEvidence_graphSnapshotId_outcome_createdAt_idx"
  ON "GraphValidationEvidence" ("graphSnapshotId", "outcome", "createdAt");
CREATE INDEX "GraphValidationEvidence_graphSha256_runtimeContractDigest_outcome_createdAt_idx"
  ON "GraphValidationEvidence" ("graphSha256", "runtimeContractDigest", "outcome", "createdAt");

ALTER TABLE "GenerationAttempt"
  ADD COLUMN "graphValidationEvidenceId" UUID REFERENCES "GraphValidationEvidence"("id") ON DELETE RESTRICT;

CREATE TRIGGER "GraphValidationEvidence_no_mutation"
  BEFORE UPDATE OR DELETE ON "GraphValidationEvidence"
  FOR EACH ROW EXECUTE FUNCTION "mainline_append_only"();
