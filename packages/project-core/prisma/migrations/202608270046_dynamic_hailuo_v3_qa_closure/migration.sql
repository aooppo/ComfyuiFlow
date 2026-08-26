-- Feature 016 V3 closure: independent AI-QA authority/projection and retry lineage.
DROP INDEX "AuthorizationConsumptionV3Record_attemptId_key";
CREATE UNIQUE INDEX "AuthorizationConsumptionV3Record_attemptId_operation_key"
  ON "AuthorizationConsumptionV3Record"("attemptId", "operation");

ALTER TABLE "GenerationAuthorizationV3Record"
  ADD COLUMN "maximumAiQaCalls" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "consumedAiQaCalls" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maximumAiQaCostMicros" BIGINT,
  ADD COLUMN "maximumTotalCostMicros" BIGINT,
  ADD COLUMN "aiQaProviderId" VARCHAR(160),
  ADD COLUMN "aiQaModelId" VARCHAR(160),
  ADD COLUMN "aiQaPricingJson" JSONB;

ALTER TABLE "GenerationBatchV3Record"
  ADD COLUMN "consumedAiQaCalls" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maximumAiQaCostMicros" BIGINT,
  ADD COLUMN "maximumTotalCostMicros" BIGINT,
  ADD COLUMN "aiQaProviderId" VARCHAR(160),
  ADD COLUMN "aiQaModelId" VARCHAR(160),
  ADD COLUMN "aiQaPricingJson" JSONB;

ALTER TABLE "GenerationRetryPreviewV3Record"
  ADD COLUMN "maximumAiQaCalls" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "maximumAiQaCostMicros" BIGINT,
  ADD COLUMN "maximumTotalCostMicros" BIGINT;

ALTER TABLE "GenerationAttemptV3Record"
  ADD COLUMN "retryOfAttemptId" UUID;
ALTER TABLE "GenerationBatchTargetV3Record"
  ADD COLUMN "retryOfAttemptId" UUID;
CREATE INDEX "GenerationAttemptV3Record_projectId_generationSpecId_attemptNumber_idx"
  ON "GenerationAttemptV3Record"("projectId", "generationSpecId", "attemptNumber");

CREATE TABLE "AiQaRunV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "artifactId" UUID NOT NULL,
  "authorizationConsumptionId" UUID NOT NULL,
  "providerId" VARCHAR(160) NOT NULL,
  "requestedModelId" VARCHAR(160) NOT NULL,
  "resolvedModelId" VARCHAR(160),
  "requestHash" CHAR(64) NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "responseId" VARCHAR(255),
  "status" VARCHAR(40) NOT NULL,
  "safeResultCode" VARCHAR(160) NOT NULL,
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "usageJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AiQaRunV3Record_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiQaRunV3Record_attemptId_key" ON "AiQaRunV3Record"("attemptId");
CREATE UNIQUE INDEX "AiQaRunV3Record_authorizationConsumptionId_key"
  ON "AiQaRunV3Record"("authorizationConsumptionId");
CREATE UNIQUE INDEX "AiQaRunV3Record_artifactId_requestHash_key"
  ON "AiQaRunV3Record"("artifactId", "requestHash");
CREATE INDEX "AiQaRunV3Record_projectId_attemptId_createdAt_idx"
  ON "AiQaRunV3Record"("projectId", "attemptId", "createdAt" DESC);

CREATE TABLE "AiQaResultV3Record" (
  "id" UUID NOT NULL,
  "aiQaRunId" UUID NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "overallStatus" VARCHAR(40) NOT NULL,
  "summary" TEXT NOT NULL,
  "limitationsJson" JSONB NOT NULL,
  "criteriaJson" JSONB NOT NULL,
  "outputHash" CHAR(64) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiQaResultV3Record_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiQaResultV3Record_aiQaRunId_key" ON "AiQaResultV3Record"("aiQaRunId");
CREATE INDEX "AiQaResultV3Record_createdAt_idx" ON "AiQaResultV3Record"("createdAt" DESC);

CREATE TRIGGER "AiQaRunV3Record_immutable" BEFORE DELETE ON "AiQaRunV3Record"
  FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "AiQaResultV3Record_immutable" BEFORE UPDATE OR DELETE ON "AiQaResultV3Record"
  FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
