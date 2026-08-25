ALTER TYPE "StoryboardVersionSource" ADD VALUE 'AI_DIRECTOR';
ALTER TYPE "StoryboardDirectorRunStatus" ADD VALUE 'QUEUED';
ALTER TYPE "StoryboardDirectorRunStatus" ADD VALUE 'RUNNING';
ALTER TYPE "StoryboardDirectorRunStatus" ADD VALUE 'AMBIGUOUS';

CREATE TYPE "StoryboardDirectorAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'AMBIGUOUS');
CREATE TYPE "StoryboardDirectorProposalDecisionType" AS ENUM ('REJECTED', 'ADOPTED');

ALTER TABLE "StoryboardDirectorRun"
  ADD COLUMN "maxShotCount" INTEGER,
  ADD COLUMN "headVersionId" UUID,
  ADD COLUMN "headContentHash" CHAR(64),
  ADD COLUMN "scopeHash" CHAR(64),
  ADD COLUMN "priceSnapshotHash" CHAR(64),
  ADD COLUMN "billingChannel" VARCHAR(120),
  ADD COLUMN "maxCostUsd" DECIMAL(12,6),
  ADD COLUMN "priceEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "priceExpiresAt" TIMESTAMP(3),
  ADD COLUMN "idempotencyKey" VARCHAR(160),
  ADD COLUMN "leaseOwner" VARCHAR(120),
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "StoryboardDirectorRun_storyboardId_idempotencyKey_key"
  ON "StoryboardDirectorRun"("storyboardId", "idempotencyKey");

CREATE TABLE "StoryboardDirectorInputReference" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "runId" UUID NOT NULL, "ordinal" INTEGER NOT NULL,
  "alias" VARCHAR(64) NOT NULL, "kind" VARCHAR(40) NOT NULL, "displayName" VARCHAR(120) NOT NULL,
  "productionAssetId" UUID NOT NULL, "productionAssetVersionId" UUID NOT NULL,
  "assetVersionFileId" UUID NOT NULL, "projectAssetId" UUID NOT NULL,
  "semanticFactsJson" JSONB NOT NULL, "sha256" CHAR(64) NOT NULL, "byteSize" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryboardDirectorInputReference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryboardDirectorInputReference_runId_ordinal_key" ON "StoryboardDirectorInputReference"("runId", "ordinal");
CREATE UNIQUE INDEX "StoryboardDirectorInputReference_runId_alias_key" ON "StoryboardDirectorInputReference"("runId", "alias");
CREATE INDEX "StoryboardDirectorInputReference_projectId_productionAssetVersionId_idx" ON "StoryboardDirectorInputReference"("projectId", "productionAssetVersionId");

CREATE TABLE "StoryboardDirectorAuthorization" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "runId" UUID NOT NULL, "maxCalls" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryboardDirectorAuthorization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryboardDirectorAuthorization_runId_key" ON "StoryboardDirectorAuthorization"("runId");

CREATE TABLE "StoryboardDirectorAttempt" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "runId" UUID NOT NULL, "ordinal" INTEGER NOT NULL,
  "status" "StoryboardDirectorAttemptStatus" NOT NULL, "actualModelId" VARCHAR(160), "responseId" VARCHAR(255),
  "safeResultCode" VARCHAR(80) NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3), CONSTRAINT "StoryboardDirectorAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryboardDirectorAttempt_runId_ordinal_key" ON "StoryboardDirectorAttempt"("runId", "ordinal");
CREATE INDEX "StoryboardDirectorAttempt_projectId_startedAt_idx" ON "StoryboardDirectorAttempt"("projectId", "startedAt" DESC);

CREATE TABLE "StoryboardDirectorProposal" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "storyboardId" UUID NOT NULL, "runId" UUID NOT NULL,
  "narrativeSummary" TEXT NOT NULL, "normalizedProposalJson" JSONB NOT NULL, "outputHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryboardDirectorProposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryboardDirectorProposal_runId_key" ON "StoryboardDirectorProposal"("runId");
CREATE UNIQUE INDEX "StoryboardDirectorProposal_projectId_id_key" ON "StoryboardDirectorProposal"("projectId", "id");
CREATE INDEX "StoryboardDirectorProposal_storyboardId_createdAt_idx" ON "StoryboardDirectorProposal"("storyboardId", "createdAt" DESC);

CREATE TABLE "StoryboardDirectorProposalDecision" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "proposalId" UUID NOT NULL,
  "type" "StoryboardDirectorProposalDecisionType" NOT NULL, "note" TEXT, "adoptedVersionId" UUID,
  "idempotencyKey" VARCHAR(160) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryboardDirectorProposalDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryboardDirectorProposalDecision_idempotencyKey_key" ON "StoryboardDirectorProposalDecision"("idempotencyKey");
CREATE INDEX "StoryboardDirectorProposalDecision_proposalId_createdAt_idx" ON "StoryboardDirectorProposalDecision"("proposalId", "createdAt" DESC);

ALTER TABLE "StoryboardVersion" ADD COLUMN "sourceProposalId" UUID;
CREATE UNIQUE INDEX "StoryboardVersion_sourceProposalId_key" ON "StoryboardVersion"("sourceProposalId");

ALTER TABLE "StoryboardDirectorInputReference" ADD CONSTRAINT "StoryboardDirectorInputReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorInputReference" ADD CONSTRAINT "StoryboardDirectorInputReference_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StoryboardDirectorRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorAuthorization" ADD CONSTRAINT "StoryboardDirectorAuthorization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorAuthorization" ADD CONSTRAINT "StoryboardDirectorAuthorization_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StoryboardDirectorRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorAttempt" ADD CONSTRAINT "StoryboardDirectorAttempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorAttempt" ADD CONSTRAINT "StoryboardDirectorAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StoryboardDirectorRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorProposal" ADD CONSTRAINT "StoryboardDirectorProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorProposal" ADD CONSTRAINT "StoryboardDirectorProposal_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorProposal" ADD CONSTRAINT "StoryboardDirectorProposal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StoryboardDirectorRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorProposalDecision" ADD CONSTRAINT "StoryboardDirectorProposalDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorProposalDecision" ADD CONSTRAINT "StoryboardDirectorProposalDecision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "StoryboardDirectorProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardVersion" ADD CONSTRAINT "StoryboardVersion_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "StoryboardDirectorProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
