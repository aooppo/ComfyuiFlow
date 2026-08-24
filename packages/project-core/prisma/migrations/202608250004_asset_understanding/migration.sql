CREATE TYPE "AnalysisGrantStatus" AS ENUM ('CREATED','CONSUMED','EXPIRED');
CREATE TYPE "AnalysisRunStatus" AS ENUM ('QUEUED','RUNNING','COMPLETED','FAILED','AMBIGUOUS');
CREATE TYPE "ProviderAttemptStatus" AS ENUM ('STARTED','SUCCEEDED','FAILED','AMBIGUOUS');
CREATE TYPE "UnderstandingAuthorType" AS ENUM ('MACHINE','OWNER');
CREATE TYPE "UnderstandingReviewDecision" AS ENUM ('ACCEPTED','REJECTED');
CREATE TYPE "UnderstandingApplicationTarget" AS ENUM ('PRODUCTION_ASSET_DRAFT','ASSET_VERSION_FILE_DRAFT');
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'UNDERSTANDING_APPLIED';

CREATE TABLE "AssetUnderstandingManifest" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "manifestHash" CHAR(64) NOT NULL,
  "providerId" VARCHAR(80) NOT NULL, "modelId" VARCHAR(160) NOT NULL, "taskType" VARCHAR(80) NOT NULL,
  "promptVersion" VARCHAR(80) NOT NULL, "schemaVersion" VARCHAR(80) NOT NULL, "maxCalls" INTEGER NOT NULL DEFAULT 1,
  "assetCount" INTEGER NOT NULL, "totalByteSize" BIGINT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AssetUnderstandingManifest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetUnderstandingManifest_manifestHash_key" ON "AssetUnderstandingManifest"("manifestHash");
CREATE INDEX "AssetUnderstandingManifest_project_created_idx" ON "AssetUnderstandingManifest"("projectId","createdAt" DESC);
ALTER TABLE "AssetUnderstandingManifest" ADD CONSTRAINT "AssetUnderstandingManifest_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssetUnderstandingManifestItem" (
  "id" UUID NOT NULL, "manifestId" UUID NOT NULL, "position" INTEGER NOT NULL, "slot" VARCHAR(4) NOT NULL,
  "assetId" UUID NOT NULL, "sha256" CHAR(64) NOT NULL, "byteSize" BIGINT NOT NULL, "mediaType" "MediaType" NOT NULL,
  CONSTRAINT "AssetUnderstandingManifestItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetUnderstandingManifestItem_position_key" ON "AssetUnderstandingManifestItem"("manifestId","position");
CREATE UNIQUE INDEX "AssetUnderstandingManifestItem_slot_key" ON "AssetUnderstandingManifestItem"("manifestId","slot");
CREATE UNIQUE INDEX "AssetUnderstandingManifestItem_asset_key" ON "AssetUnderstandingManifestItem"("manifestId","assetId");
ALTER TABLE "AssetUnderstandingManifestItem" ADD CONSTRAINT "AssetUnderstandingManifestItem_manifest_fkey" FOREIGN KEY ("manifestId") REFERENCES "AssetUnderstandingManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetUnderstandingManifestItem" ADD CONSTRAINT "AssetUnderstandingManifestItem_asset_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiCallGrant" (
  "id" UUID NOT NULL, "manifestId" UUID NOT NULL, "operation" VARCHAR(80) NOT NULL,
  "providerId" VARCHAR(80) NOT NULL, "modelId" VARCHAR(160) NOT NULL, "maxCalls" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" VARCHAR(120) NOT NULL, "status" "AnalysisGrantStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "consumedAt" TIMESTAMP(3),
  CONSTRAINT "AiCallGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiCallGrant_idempotencyKey_key" ON "AiCallGrant"("idempotencyKey");
CREATE INDEX "AiCallGrant_status_expiresAt_idx" ON "AiCallGrant"("status","expiresAt");
ALTER TABLE "AiCallGrant" ADD CONSTRAINT "AiCallGrant_manifest_fkey" FOREIGN KEY ("manifestId") REFERENCES "AssetUnderstandingManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssetUnderstandingRun" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "manifestId" UUID NOT NULL, "grantId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL, "status" "AnalysisRunStatus" NOT NULL DEFAULT 'QUEUED',
  "resultCode" VARCHAR(80), "claimedBy" VARCHAR(120), "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetUnderstandingRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetUnderstandingRun_grantId_key" ON "AssetUnderstandingRun"("grantId");
CREATE UNIQUE INDEX "AssetUnderstandingRun_project_idempotency_key" ON "AssetUnderstandingRun"("projectId","idempotencyKey");
CREATE INDEX "AssetUnderstandingRun_status_created_idx" ON "AssetUnderstandingRun"("status","createdAt");
CREATE INDEX "AssetUnderstandingRun_status_lease_idx" ON "AssetUnderstandingRun"("status","leaseExpiresAt");
ALTER TABLE "AssetUnderstandingRun" ADD CONSTRAINT "AssetUnderstandingRun_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetUnderstandingRun" ADD CONSTRAINT "AssetUnderstandingRun_manifest_fkey" FOREIGN KEY ("manifestId") REFERENCES "AssetUnderstandingManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetUnderstandingRun" ADD CONSTRAINT "AssetUnderstandingRun_grant_fkey" FOREIGN KEY ("grantId") REFERENCES "AiCallGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiProviderAttempt" (
  "id" UUID NOT NULL, "runId" UUID NOT NULL, "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "providerId" VARCHAR(80) NOT NULL, "requestedModelId" VARCHAR(160) NOT NULL, "resolvedModelId" VARCHAR(160),
  "status" "ProviderAttemptStatus" NOT NULL DEFAULT 'STARTED', "requestHash" CHAR(64) NOT NULL,
  "responseId" VARCHAR(255), "usageJson" JSONB, "safeErrorCode" VARCHAR(80),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AiProviderAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiProviderAttempt_runId_key" ON "AiProviderAttempt"("runId");
ALTER TABLE "AiProviderAttempt" ADD CONSTRAINT "AiProviderAttempt_run_fkey" FOREIGN KEY ("runId") REFERENCES "AssetUnderstandingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssetUnderstandingRevision" (
  "id" UUID NOT NULL, "projectAssetId" UUID NOT NULL, "runId" UUID, "attemptId" UUID, "sourceRevisionId" UUID,
  "ordinal" INTEGER NOT NULL, "authorType" "UnderstandingAuthorType" NOT NULL, "schemaVersion" VARCHAR(80) NOT NULL,
  "factsJson" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetUnderstandingRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetUnderstandingRevision_asset_ordinal_key" ON "AssetUnderstandingRevision"("projectAssetId","ordinal");
CREATE UNIQUE INDEX "AssetUnderstandingRevision_run_asset_key" ON "AssetUnderstandingRevision"("runId","projectAssetId");
CREATE INDEX "AssetUnderstandingRevision_asset_ordinal_desc_idx" ON "AssetUnderstandingRevision"("projectAssetId","ordinal" DESC);
ALTER TABLE "AssetUnderstandingRevision" ADD CONSTRAINT "AssetUnderstandingRevision_asset_fkey" FOREIGN KEY ("projectAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetUnderstandingRevision" ADD CONSTRAINT "AssetUnderstandingRevision_run_fkey" FOREIGN KEY ("runId") REFERENCES "AssetUnderstandingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetUnderstandingRevision" ADD CONSTRAINT "AssetUnderstandingRevision_attempt_fkey" FOREIGN KEY ("attemptId") REFERENCES "AiProviderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UnderstandingReview" (
  "id" UUID NOT NULL, "revisionId" UUID NOT NULL, "decision" "UnderstandingReviewDecision" NOT NULL,
  "notes" TEXT, "idempotencyKey" VARCHAR(120) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnderstandingReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UnderstandingReview_idempotencyKey_key" ON "UnderstandingReview"("idempotencyKey");
CREATE INDEX "UnderstandingReview_revision_created_idx" ON "UnderstandingReview"("revisionId","createdAt" DESC);
ALTER TABLE "UnderstandingReview" ADD CONSTRAINT "UnderstandingReview_revision_fkey" FOREIGN KEY ("revisionId") REFERENCES "AssetUnderstandingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UnderstandingApplication" (
  "id" UUID NOT NULL, "revisionId" UUID NOT NULL, "targetType" "UnderstandingApplicationTarget" NOT NULL,
  "targetId" UUID NOT NULL, "fieldMappings" JSONB NOT NULL, "idempotencyKey" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UnderstandingApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UnderstandingApplication_idempotencyKey_key" ON "UnderstandingApplication"("idempotencyKey");
CREATE INDEX "UnderstandingApplication_revision_created_idx" ON "UnderstandingApplication"("revisionId","createdAt" DESC);
ALTER TABLE "UnderstandingApplication" ADD CONSTRAINT "UnderstandingApplication_revision_fkey" FOREIGN KEY ("revisionId") REFERENCES "AssetUnderstandingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
