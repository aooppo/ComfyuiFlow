-- Phase 2A-0: preserve existing bytes, then require an explicit structural revalidation.
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PRESERVED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'INVALID';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'PRESERVED';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'INVALID';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'ASSET_REVALIDATED';

CREATE TYPE "ProbeStatus" AS ENUM ('PASS', 'FAIL');
CREATE TYPE "ImportAttemptStatus" AS ENUM ('PROCESSING', 'TERMINAL');
CREATE TYPE "ImportBatchStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

CREATE TABLE "MediaProbeResult" (
  "id" UUID NOT NULL,
  "storedObjectId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "probeVersion" VARCHAR(80) NOT NULL,
  "status" "ProbeStatus" NOT NULL,
  "mediaType" "MediaType" NOT NULL,
  "container" VARCHAR(80),
  "codecFactsJson" JSONB,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "streamCount" INTEGER,
  "safeResultCode" VARCHAR(80) NOT NULL,
  "probedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaProbeResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaProbeResult_storedObjectId_ordinal_key" ON "MediaProbeResult"("storedObjectId", "ordinal");
CREATE INDEX "MediaProbeResult_storedObjectId_probedAt_idx" ON "MediaProbeResult"("storedObjectId", "probedAt" DESC);
ALTER TABLE "MediaProbeResult" ADD CONSTRAINT "MediaProbeResult_storedObjectId_fkey"
  FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssetImportBatch" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestedItemCount" INTEGER NOT NULL,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'PROCESSING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AssetImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetImportBatch_projectId_idempotencyKey_key" ON "AssetImportBatch"("projectId", "idempotencyKey");
CREATE INDEX "AssetImportBatch_projectId_createdAt_idx" ON "AssetImportBatch"("projectId", "createdAt" DESC);
ALTER TABLE "AssetImportBatch" ADD CONSTRAINT "AssetImportBatch_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetImportAttempt" ADD COLUMN "batchId" UUID;
ALTER TABLE "AssetImportAttempt" ADD COLUMN "itemIndex" INTEGER;
ALTER TABLE "AssetImportAttempt" ADD COLUMN "status" "ImportAttemptStatus" NOT NULL DEFAULT 'TERMINAL';
ALTER TABLE "AssetImportAttempt" ADD COLUMN "completedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "AssetImportAttempt_batchId_itemIndex_key" ON "AssetImportAttempt"("batchId", "itemIndex");
ALTER TABLE "AssetImportAttempt" ADD CONSTRAINT "AssetImportAttempt_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AssetImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Asset_projectId_id_key" ON "Asset"("projectId", "id");
ALTER TABLE "AssetImportAttempt" ADD CONSTRAINT "AssetImportAttempt_project_asset_fkey"
  FOREIGN KEY ("projectId", "assetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_project_asset_fkey"
  FOREIGN KEY ("projectId", "assetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Asset_projectId_displayName_idx" ON "Asset"("projectId", "displayName");
