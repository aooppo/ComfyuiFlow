CREATE TYPE "GenerationBatchStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'AWAITING_HUMAN_QA', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUBMITTED', 'AMBIGUOUS', 'TECHNICAL_FAILED', 'AWAITING_HUMAN_QA', 'QA_PASS', 'QA_FAIL', 'CANCELLED');
CREATE TYPE "ExecutionOperation" AS ENUM ('GENERATION_SUBMIT', 'AI_QA_REVIEW');
CREATE TYPE "GeneratedArtifactStatus" AS ENUM ('RETAINED', 'TECHNICALLY_VALID', 'TECHNICALLY_INVALID');
CREATE TYPE "TechnicalCheckStatus" AS ENUM ('PASS', 'FAIL');
CREATE TYPE "ArtifactReviewFrameRole" AS ENUM ('FIRST', 'MIDDLE', 'FINAL');
CREATE TYPE "AiQaRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'AMBIGUOUS');
CREATE TYPE "QaAdvisoryStatus" AS ENUM ('PASS', 'WARN', 'FAIL', 'NOT_ASSESSABLE');
CREATE TYPE "HumanQaDecisionType" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "GenerationBatch" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationPlanVersionId" UUID NOT NULL,
  "providerProfileId" VARCHAR(80) NOT NULL,
  "providerId" VARCHAR(80) NOT NULL,
  "modelId" VARCHAR(160) NOT NULL,
  "workflowId" VARCHAR(120) NOT NULL,
  "workflowVersion" VARCHAR(80) NOT NULL,
  "workflowSha256" CHAR(64) NOT NULL,
  "previewHash" CHAR(64) NOT NULL,
  "scopeHash" CHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "status" "GenerationBatchStatus" NOT NULL DEFAULT 'QUEUED',
  "rowVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenerationBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationBatchTarget" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationBatchId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "targetHash" CHAR(64) NOT NULL,
  "promptHash" CHAR(64) NOT NULL,
  "referencesHash" CHAR(64) NOT NULL,
  "compiledPrompt" TEXT NOT NULL,
  "slotManifestJson" JSONB NOT NULL,
  "retryOfJobId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationBatchTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutionAuthorization" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationBatchId" UUID NOT NULL,
  "scopeHash" CHAR(64) NOT NULL,
  "maximumGenerationCalls" INTEGER NOT NULL DEFAULT 0,
  "maximumAiQaCalls" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationJob" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationBatchId" UUID NOT NULL,
  "generationBatchTargetId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "providerTaskId" VARCHAR(255),
  "safeResultCode" VARCHAR(80) NOT NULL DEFAULT 'QUEUED',
  "claimOwner" VARCHAR(160),
  "claimedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorizationConsumption" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "executionAuthorizationId" UUID NOT NULL,
  "generationBatchTargetId" UUID NOT NULL,
  "generationJobId" UUID,
  "operation" "ExecutionOperation" NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorizationConsumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationJobEvent" (
  "id" UUID NOT NULL,
  "generationJobId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventType" VARCHAR(80) NOT NULL,
  "safePayloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationJobEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedArtifact" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationJobId" UUID NOT NULL,
  "storageKey" VARCHAR(255) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "detectedMimeType" VARCHAR(120) NOT NULL,
  "providerReferenceJson" JSONB,
  "status" "GeneratedArtifactStatus" NOT NULL DEFAULT 'RETAINED',
  "retainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtifactTechnicalCheck" (
  "id" UUID NOT NULL,
  "generatedArtifactId" UUID NOT NULL,
  "checkerVersion" VARCHAR(80) NOT NULL,
  "status" "TechnicalCheckStatus" NOT NULL,
  "safeResultCode" VARCHAR(80) NOT NULL,
  "container" VARCHAR(80),
  "videoCodec" VARCHAR(80),
  "audioCodec" VARCHAR(80),
  "width" INTEGER,
  "height" INTEGER,
  "fps" DOUBLE PRECISION,
  "durationSeconds" DOUBLE PRECISION,
  "bitrate" BIGINT,
  "audioFactsJson" JSONB,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactTechnicalCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtifactReviewFrame" (
  "id" UUID NOT NULL,
  "generatedArtifactId" UUID NOT NULL,
  "role" "ArtifactReviewFrameRole" NOT NULL,
  "requestedTimestamp" DOUBLE PRECISION NOT NULL,
  "actualTimestamp" DOUBLE PRECISION NOT NULL,
  "extractorVersion" VARCHAR(80) NOT NULL,
  "storageKey" VARCHAR(255) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactReviewFrame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiQaRun" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generatedArtifactId" UUID NOT NULL,
  "providerId" VARCHAR(80) NOT NULL,
  "requestedModelId" VARCHAR(160) NOT NULL,
  "resolvedModelId" VARCHAR(160),
  "requestHash" CHAR(64) NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "responseId" VARCHAR(255),
  "status" "AiQaRunStatus" NOT NULL,
  "safeResultCode" VARCHAR(80) NOT NULL,
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "usageJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AiQaRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiQaResult" (
  "id" UUID NOT NULL,
  "aiQaRunId" UUID NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "promptVersion" VARCHAR(80) NOT NULL,
  "overallStatus" "QaAdvisoryStatus" NOT NULL,
  "summary" TEXT NOT NULL,
  "limitationsJson" JSONB NOT NULL,
  "criteriaJson" JSONB NOT NULL,
  "outputHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiQaResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanQaDecision" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generatedArtifactId" UUID NOT NULL,
  "decision" "HumanQaDecisionType" NOT NULL,
  "notes" TEXT,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanQaDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenerationBatch_idempotencyKey_key" ON "GenerationBatch"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationBatch_projectId_id_key" ON "GenerationBatch"("projectId", "id");
CREATE INDEX "GenerationBatch_projectId_status_createdAt_idx" ON "GenerationBatch"("projectId", "status", "createdAt" DESC);
CREATE UNIQUE INDEX "GenerationBatchTarget_generationBatchId_generationSpecId_key" ON "GenerationBatchTarget"("generationBatchId", "generationSpecId");
CREATE UNIQUE INDEX "GenerationBatchTarget_generationBatchId_ordinal_key" ON "GenerationBatchTarget"("generationBatchId", "ordinal");
CREATE UNIQUE INDEX "GenerationBatchTarget_projectId_id_key" ON "GenerationBatchTarget"("projectId", "id");
CREATE INDEX "GenerationBatchTarget_generationSpecId_idx" ON "GenerationBatchTarget"("generationSpecId");
CREATE UNIQUE INDEX "ExecutionAuthorization_generationBatchId_key" ON "ExecutionAuthorization"("generationBatchId");
CREATE UNIQUE INDEX "ExecutionAuthorization_projectId_id_key" ON "ExecutionAuthorization"("projectId", "id");
CREATE INDEX "ExecutionAuthorization_projectId_expiresAt_idx" ON "ExecutionAuthorization"("projectId", "expiresAt");
CREATE UNIQUE INDEX "ExecutionAuthorization_projectId_generationBatchId_key" ON "ExecutionAuthorization"("projectId", "generationBatchId");
CREATE UNIQUE INDEX "GenerationJob_generationBatchTargetId_key" ON "GenerationJob"("generationBatchTargetId");
CREATE UNIQUE INDEX "GenerationJob_providerTaskId_key" ON "GenerationJob"("providerTaskId");
CREATE UNIQUE INDEX "GenerationJob_projectId_id_key" ON "GenerationJob"("projectId", "id");
CREATE INDEX "GenerationJob_generationBatchId_status_idx" ON "GenerationJob"("generationBatchId", "status");
CREATE UNIQUE INDEX "GenerationJob_projectId_generationBatchTargetId_key" ON "GenerationJob"("projectId", "generationBatchTargetId");
CREATE INDEX "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");
CREATE UNIQUE INDEX "AuthorizationConsumption_executionAuthorizationId_generationBatchTargetId_operation_key" ON "AuthorizationConsumption"("executionAuthorizationId", "generationBatchTargetId", "operation");
CREATE UNIQUE INDEX "AuthorizationConsumption_projectId_id_key" ON "AuthorizationConsumption"("projectId", "id");
CREATE INDEX "AuthorizationConsumption_generationJobId_idx" ON "AuthorizationConsumption"("generationJobId");
CREATE UNIQUE INDEX "GenerationJobEvent_generationJobId_sequence_key" ON "GenerationJobEvent"("generationJobId", "sequence");
CREATE INDEX "GenerationJobEvent_generationJobId_createdAt_idx" ON "GenerationJobEvent"("generationJobId", "createdAt");
CREATE UNIQUE INDEX "GeneratedArtifact_storageKey_key" ON "GeneratedArtifact"("storageKey");
CREATE UNIQUE INDEX "GeneratedArtifact_projectId_id_key" ON "GeneratedArtifact"("projectId", "id");
CREATE INDEX "GeneratedArtifact_generationJobId_retainedAt_idx" ON "GeneratedArtifact"("generationJobId", "retainedAt");
CREATE UNIQUE INDEX "ArtifactTechnicalCheck_generatedArtifactId_checkerVersion_key" ON "ArtifactTechnicalCheck"("generatedArtifactId", "checkerVersion");
CREATE UNIQUE INDEX "ArtifactReviewFrame_generatedArtifactId_role_extractorVersion_key" ON "ArtifactReviewFrame"("generatedArtifactId", "role", "extractorVersion");
CREATE UNIQUE INDEX "AiQaRun_generatedArtifactId_requestHash_key" ON "AiQaRun"("generatedArtifactId", "requestHash");
CREATE UNIQUE INDEX "AiQaRun_projectId_id_key" ON "AiQaRun"("projectId", "id");
CREATE UNIQUE INDEX "AiQaResult_aiQaRunId_key" ON "AiQaResult"("aiQaRunId");
CREATE UNIQUE INDEX "HumanQaDecision_idempotencyKey_key" ON "HumanQaDecision"("idempotencyKey");
CREATE UNIQUE INDEX "HumanQaDecision_projectId_id_key" ON "HumanQaDecision"("projectId", "id");
CREATE INDEX "HumanQaDecision_generatedArtifactId_createdAt_idx" ON "HumanQaDecision"("generatedArtifactId", "createdAt" DESC);

ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_generationPlanVersionId_fkey" FOREIGN KEY ("generationPlanVersionId") REFERENCES "GenerationPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "GenerationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_generationSpecId_fkey" FOREIGN KEY ("generationSpecId") REFERENCES "GenerationSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_retryOfJobId_fkey" FOREIGN KEY ("retryOfJobId") REFERENCES "GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionAuthorization" ADD CONSTRAINT "ExecutionAuthorization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionAuthorization" ADD CONSTRAINT "ExecutionAuthorization_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "GenerationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "GenerationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_generationBatchTargetId_fkey" FOREIGN KEY ("generationBatchTargetId") REFERENCES "GenerationBatchTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationConsumption" ADD CONSTRAINT "AuthorizationConsumption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationConsumption" ADD CONSTRAINT "AuthorizationConsumption_executionAuthorizationId_fkey" FOREIGN KEY ("executionAuthorizationId") REFERENCES "ExecutionAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationConsumption" ADD CONSTRAINT "AuthorizationConsumption_generationBatchTargetId_fkey" FOREIGN KEY ("generationBatchTargetId") REFERENCES "GenerationBatchTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationConsumption" ADD CONSTRAINT "AuthorizationConsumption_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationJobEvent" ADD CONSTRAINT "GenerationJobEvent_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedArtifact" ADD CONSTRAINT "GeneratedArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedArtifact" ADD CONSTRAINT "GeneratedArtifact_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtifactTechnicalCheck" ADD CONSTRAINT "ArtifactTechnicalCheck_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtifactReviewFrame" ADD CONSTRAINT "ArtifactReviewFrame_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiQaRun" ADD CONSTRAINT "AiQaRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiQaRun" ADD CONSTRAINT "AiQaRun_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiQaResult" ADD CONSTRAINT "AiQaResult_aiQaRunId_fkey" FOREIGN KEY ("aiQaRunId") REFERENCES "AiQaRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HumanQaDecision" ADD CONSTRAINT "HumanQaDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HumanQaDecision" ADD CONSTRAINT "HumanQaDecision_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Project identity is part of every cross-aggregate execution reference.
ALTER TABLE "GenerationBatch" DROP CONSTRAINT "GenerationBatch_generationPlanVersionId_fkey";
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_project_generationPlanVersion_fkey" FOREIGN KEY ("projectId", "generationPlanVersionId") REFERENCES "GenerationPlanVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatchTarget" DROP CONSTRAINT "GenerationBatchTarget_generationBatchId_fkey";
ALTER TABLE "GenerationBatchTarget" DROP CONSTRAINT "GenerationBatchTarget_generationSpecId_fkey";
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_project_batch_fkey" FOREIGN KEY ("projectId", "generationBatchId") REFERENCES "GenerationBatch"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_project_spec_fkey" FOREIGN KEY ("projectId", "generationSpecId") REFERENCES "GenerationSpec"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionAuthorization" DROP CONSTRAINT "ExecutionAuthorization_generationBatchId_fkey";
ALTER TABLE "ExecutionAuthorization" ADD CONSTRAINT "ExecutionAuthorization_project_batch_fkey" FOREIGN KEY ("projectId", "generationBatchId") REFERENCES "GenerationBatch"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationConsumption" DROP CONSTRAINT "AuthorizationConsumption_executionAuthorizationId_fkey";
ALTER TABLE "AuthorizationConsumption" DROP CONSTRAINT "AuthorizationConsumption_generationBatchTargetId_fkey";
ALTER TABLE "AuthorizationConsumption" ADD CONSTRAINT "AuthorizationConsumption_project_authorization_fkey" FOREIGN KEY ("projectId", "executionAuthorizationId") REFERENCES "ExecutionAuthorization"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationConsumption" ADD CONSTRAINT "AuthorizationConsumption_project_target_fkey" FOREIGN KEY ("projectId", "generationBatchTargetId") REFERENCES "GenerationBatchTarget"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" DROP CONSTRAINT "GenerationJob_generationBatchId_fkey";
ALTER TABLE "GenerationJob" DROP CONSTRAINT "GenerationJob_generationBatchTargetId_fkey";
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_project_batch_fkey" FOREIGN KEY ("projectId", "generationBatchId") REFERENCES "GenerationBatch"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_project_target_fkey" FOREIGN KEY ("projectId", "generationBatchTargetId") REFERENCES "GenerationBatchTarget"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedArtifact" DROP CONSTRAINT "GeneratedArtifact_generationJobId_fkey";
ALTER TABLE "GeneratedArtifact" ADD CONSTRAINT "GeneratedArtifact_project_job_fkey" FOREIGN KEY ("projectId", "generationJobId") REFERENCES "GenerationJob"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiQaRun" DROP CONSTRAINT "AiQaRun_generatedArtifactId_fkey";
ALTER TABLE "AiQaRun" ADD CONSTRAINT "AiQaRun_project_artifact_fkey" FOREIGN KEY ("projectId", "generatedArtifactId") REFERENCES "GeneratedArtifact"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HumanQaDecision" DROP CONSTRAINT "HumanQaDecision_generatedArtifactId_fkey";
ALTER TABLE "HumanQaDecision" ADD CONSTRAINT "HumanQaDecision_project_artifact_fkey" FOREIGN KEY ("projectId", "generatedArtifactId") REFERENCES "GeneratedArtifact"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
