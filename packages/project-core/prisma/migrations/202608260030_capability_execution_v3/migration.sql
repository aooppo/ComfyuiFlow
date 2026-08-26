CREATE TYPE "GenerationBatchV3State" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "GenerationBatchTargetV3State" AS ENUM ('QUEUED', 'RUNNING', 'SUBMITTED', 'COMPLETED', 'FAILED', 'AMBIGUOUS', 'CANCELLED');

CREATE TABLE "GenerationBatchV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationPlanId" UUID NOT NULL,
  "generationAuthorizationId" UUID NOT NULL,
  "planDigest" CHAR(64) NOT NULL,
  "previewHash" CHAR(64) NOT NULL,
  "scopeHash" CHAR(64) NOT NULL,
  "selectedShotIdsJson" JSONB NOT NULL,
  "expectedCalls" INTEGER NOT NULL,
  "maximumCalls" INTEGER NOT NULL,
  "maximumAiQaCalls" INTEGER NOT NULL,
  "costPolicyDigest" CHAR(64) NOT NULL,
  "maximumCostMicros" BIGINT,
  "currency" CHAR(3),
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "state" "GenerationBatchV3State" NOT NULL DEFAULT 'QUEUED',
  "safeResultCode" VARCHAR(160) NOT NULL DEFAULT 'QUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenerationBatchV3Record_call_caps_check" CHECK (
    "expectedCalls" >= 0 AND "maximumCalls" > 0 AND
    "expectedCalls" <= "maximumCalls" AND "maximumAiQaCalls" >= 0
  ),
  CONSTRAINT "GenerationBatchV3Record_cost_check" CHECK (
    "maximumCostMicros" IS NULL OR "maximumCostMicros" >= 0
  ),
  CONSTRAINT "GenerationBatchV3Record_plan_fkey" FOREIGN KEY ("generationPlanId")
    REFERENCES "GenerationPlanV3Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenerationBatchV3Record_authorization_fkey" FOREIGN KEY ("generationAuthorizationId")
    REFERENCES "GenerationAuthorizationV3Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GenerationBatchV3Record_generationAuthorizationId_key" ON "GenerationBatchV3Record"("generationAuthorizationId");
CREATE UNIQUE INDEX "GenerationBatchV3Record_idempotencyKey_key" ON "GenerationBatchV3Record"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationBatchV3Record_generationPlanId_scopeHash_key" ON "GenerationBatchV3Record"("generationPlanId", "scopeHash");
CREATE INDEX "GenerationBatchV3Record_project_state_created_idx" ON "GenerationBatchV3Record"("projectId", "state", "createdAt" DESC);

CREATE TABLE "GenerationBatchTargetV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationBatchId" UUID NOT NULL,
  "shotId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "targetDigest" CHAR(64) NOT NULL,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "adapterKey" VARCHAR(160) NOT NULL,
  "adapterVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "state" "GenerationBatchTargetV3State" NOT NULL DEFAULT 'QUEUED',
  "safeResultCode" VARCHAR(160) NOT NULL DEFAULT 'QUEUED',
  "providerTaskId" VARCHAR(255),
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "callConsumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenerationBatchTargetV3Record_call_count_check" CHECK ("providerCallCount" BETWEEN 0 AND 1),
  CONSTRAINT "GenerationBatchTargetV3Record_batch_fkey" FOREIGN KEY ("generationBatchId")
    REFERENCES "GenerationBatchV3Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenerationBatchTargetV3Record_spec_fkey" FOREIGN KEY ("generationSpecId")
    REFERENCES "GenerationSpecV3Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GenerationBatchTargetV3Record_providerTaskId_key" ON "GenerationBatchTargetV3Record"("providerTaskId");
CREATE UNIQUE INDEX "GenerationBatchTargetV3Record_batch_shot_key" ON "GenerationBatchTargetV3Record"("generationBatchId", "shotId");
CREATE UNIQUE INDEX "GenerationBatchTargetV3Record_batch_ordinal_key" ON "GenerationBatchTargetV3Record"("generationBatchId", "ordinal");
CREATE INDEX "GenerationBatchTargetV3Record_project_state_created_idx" ON "GenerationBatchTargetV3Record"("projectId", "state", "createdAt");
