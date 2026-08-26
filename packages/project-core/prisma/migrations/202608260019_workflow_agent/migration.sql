CREATE TYPE "GenerationExecutorType" AS ENUM ('COMFYUI_GRAPH', 'DIRECT_PROVIDER_API');
CREATE TYPE "GenerationImplementationStatus" AS ENUM ('DISCOVERED', 'TRIAL', 'READY', 'BLOCKED', 'RETIRED');
CREATE TYPE "GenerationEvidenceSourceType" AS ENUM ('REAL_GENERATION_JOB', 'LEGACY_REAL_ARTIFACT', 'STATIC_VALIDATION', 'READINESS');
CREATE TYPE "GenerationTechnicalResult" AS ENUM ('TECHNICALLY_VALID', 'TECHNICAL_FAILED', 'AMBIGUOUS');
CREATE TYPE "ShotExecutionPlanLifecycle" AS ENUM ('DRAFT', 'FROZEN', 'INVALIDATED', 'SUPERSEDED');
CREATE TYPE "ShotPlanningOutcome" AS ENUM ('READY', 'TRIAL', 'BLOCKED', 'WAITING_FOR_UPSTREAM_REPAIR');
CREATE TYPE "GenerationExecutionDisposition" AS ENUM ('EXECUTE', 'REUSE_ARTIFACT');
CREATE TYPE "GenerationEngineVersion" AS ENUM ('LEGACY_V1', 'WORKFLOW_AGENT_V1');
CREATE TYPE "QaContinuationMode" AS ENUM ('AUTO_CONTINUE_AFTER_QA_PASS', 'PAUSE_AFTER_EACH_SHOT');
CREATE TYPE "StoryboardDirectorRunKind" AS ENUM ('STORYBOARD', 'SHOT_REPAIR');
CREATE TYPE "RepairAction" AS ENUM ('CHANGE_IMPLEMENTATION', 'RELAX_REQUIREMENT', 'REWRITE_SHOT', 'SPLIT_SHOT', 'REPLACE_ASSET');

ALTER TABLE "Project"
  ADD COLUMN "generationDefaultsJson" JSONB,
  ADD COLUMN "generationPolicyJson" JSONB,
  ADD COLUMN "continuationMode" "QaContinuationMode" NOT NULL DEFAULT 'AUTO_CONTINUE_AFTER_QA_PASS',
  ADD COLUMN "maximumGenerationCostMicros" BIGINT,
  ADD COLUMN "generationCostCurrency" CHAR(3);

ALTER TABLE "Storyboard" ADD COLUMN "generationDefaultsJson" JSONB;

ALTER TABLE "StoryboardDirectorRun"
  ADD COLUMN "runKind" "StoryboardDirectorRunKind" NOT NULL DEFAULT 'STORYBOARD',
  ADD COLUMN "sourceStoryboardVersionId" UUID,
  ADD COLUMN "blockedShotKey" UUID,
  ADD COLUMN "repairAction" "RepairAction",
  ADD COLUMN "impactHash" CHAR(64);

ALTER TABLE "StoryboardDirectorProposal"
  ADD COLUMN "proposalKind" "StoryboardDirectorRunKind" NOT NULL DEFAULT 'STORYBOARD',
  ADD COLUMN "affectedShotKeysJson" JSONB,
  ADD COLUMN "repairPayloadJson" JSONB,
  ADD COLUMN "impactHash" CHAR(64);

ALTER TABLE "GenerationPlanVersion"
  ADD COLUMN "planningPreferencesJson" JSONB,
  ADD COLUMN "planningPreferencesHash" CHAR(64),
  ADD COLUMN "planningPreferencesIdempotencyKey" VARCHAR(120);
CREATE UNIQUE INDEX "GenerationPlanVersion_planningPreferencesIdempotencyKey_key"
  ON "GenerationPlanVersion"("planningPreferencesIdempotencyKey");

ALTER TABLE "GenerationSpec"
  ADD COLUMN "contractVersion" VARCHAR(80) NOT NULL DEFAULT 'generation-spec-v1',
  ADD COLUMN "requirementSpecJson" JSONB,
  ADD COLUMN "requirementHash" CHAR(64),
  ALTER COLUMN "positivePrompt" DROP NOT NULL,
  ALTER COLUMN "capabilityRequirements" DROP NOT NULL;
CREATE UNIQUE INDEX "GenerationSpec_generationPlanVersionId_id_key"
  ON "GenerationSpec"("generationPlanVersionId", "id");

CREATE TABLE "GenerationImplementation" (
  "id" UUID PRIMARY KEY,
  "implementationKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(40) NOT NULL,
  "providerProfileId" VARCHAR(160) NOT NULL,
  "modelProfileId" VARCHAR(160) NOT NULL,
  "executorType" "GenerationExecutorType" NOT NULL,
  "adapterId" VARCHAR(160) NOT NULL,
  "adapterVersion" VARCHAR(40) NOT NULL,
  "registrySha256" CHAR(64) NOT NULL,
  "capabilitySnapshotHash" CHAR(64) NOT NULL,
  "constraintsSnapshotHash" CHAR(64) NOT NULL,
  "patternSnapshotHash" CHAR(64) NOT NULL,
  "runtimeSnapshotHash" CHAR(64) NOT NULL,
  "compilerSnapshotHash" CHAR(64) NOT NULL,
  "status" "GenerationImplementationStatus" NOT NULL,
  "statusReasonCode" VARCHAR(160),
  "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "GenerationImplementation_implementationKey_version_key"
  ON "GenerationImplementation"("implementationKey", "version");
CREATE INDEX "GenerationImplementation_status_statusUpdatedAt_idx"
  ON "GenerationImplementation"("status", "statusUpdatedAt" DESC);

CREATE TABLE "GenerationImplementationEvidence" (
  "id" UUID PRIMARY KEY,
  "implementationId" UUID NOT NULL,
  "sourceType" "GenerationEvidenceSourceType" NOT NULL,
  "sourceId" VARCHAR(255) NOT NULL,
  "jobId" UUID,
  "artifactId" UUID,
  "planTemplateSha256" CHAR(64),
  "runtimeSnapshotHash" CHAR(64) NOT NULL,
  "catalogSnapshotHash" CHAR(64) NOT NULL,
  "technicalResult" "GenerationTechnicalResult" NOT NULL,
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationImplementationEvidence_implementationId_fkey"
    FOREIGN KEY ("implementationId") REFERENCES "GenerationImplementation"("id") ON DELETE RESTRICT,
  CONSTRAINT "GenerationImplementationEvidence_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE RESTRICT,
  CONSTRAINT "GenerationImplementationEvidence_artifactId_fkey"
    FOREIGN KEY ("artifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT,
  CONSTRAINT "GenerationImplementationEvidence_call_count_check"
    CHECK ("providerCallCount" >= 0)
);
CREATE UNIQUE INDEX "GenerationImplementationEvidence_implementation_source_key"
  ON "GenerationImplementationEvidence"("implementationId", "sourceType", "sourceId");
CREATE INDEX "GenerationImplementationEvidence_implementation_recorded_idx"
  ON "GenerationImplementationEvidence"("implementationId", "recordedAt" DESC);
CREATE INDEX "GenerationImplementationEvidence_job_idx"
  ON "GenerationImplementationEvidence"("jobId");
CREATE INDEX "GenerationImplementationEvidence_artifact_idx"
  ON "GenerationImplementationEvidence"("artifactId");

CREATE TABLE "ShotExecutionPlan" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationPlanVersionId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "implementationId" UUID,
  "executorType" "GenerationExecutorType",
  "adapterId" VARCHAR(160),
  "adapterVersion" VARCHAR(40),
  "planningInputHash" CHAR(64) NOT NULL,
  "requirementsHash" CHAR(64) NOT NULL,
  "capabilitySnapshotHash" CHAR(64) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "planTemplateSha256" CHAR(64) NOT NULL,
  "estimatedCostMicros" BIGINT,
  "maximumCostMicros" BIGINT,
  "currency" CHAR(3),
  "estimatedGenerationCalls" INTEGER NOT NULL DEFAULT 0,
  "estimatedQaCalls" INTEGER NOT NULL DEFAULT 0,
  "lifecycleStatus" "ShotExecutionPlanLifecycle" NOT NULL DEFAULT 'DRAFT',
  "planningOutcome" "ShotPlanningOutcome" NOT NULL,
  "blockerCode" VARCHAR(160),
  "frozenAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "invalidationCode" VARCHAR(160),
  "supersededById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShotExecutionPlan_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT,
  CONSTRAINT "ShotExecutionPlan_project_version_fkey"
    FOREIGN KEY ("projectId", "generationPlanVersionId") REFERENCES "GenerationPlanVersion"("projectId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ShotExecutionPlan_version_spec_fkey"
    FOREIGN KEY ("generationPlanVersionId", "generationSpecId") REFERENCES "GenerationSpec"("generationPlanVersionId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ShotExecutionPlan_implementationId_fkey"
    FOREIGN KEY ("implementationId") REFERENCES "GenerationImplementation"("id") ON DELETE RESTRICT,
  CONSTRAINT "ShotExecutionPlan_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "ShotExecutionPlan"("id") ON DELETE RESTRICT,
  CONSTRAINT "ShotExecutionPlan_cost_check"
    CHECK (("estimatedCostMicros" IS NULL OR "estimatedCostMicros" >= 0)
       AND ("maximumCostMicros" IS NULL OR "maximumCostMicros" >= 0)
       AND ("estimatedCostMicros" IS NULL OR "maximumCostMicros" IS NULL OR "estimatedCostMicros" <= "maximumCostMicros")),
  CONSTRAINT "ShotExecutionPlan_implementation_shape_check"
    CHECK (("planningOutcome" IN ('READY', 'TRIAL')
      AND "implementationId" IS NOT NULL
      AND "executorType" IS NOT NULL
      AND "adapterId" IS NOT NULL
      AND "adapterVersion" IS NOT NULL)
      OR ("planningOutcome" IN ('BLOCKED', 'WAITING_FOR_UPSTREAM_REPAIR')))
);
CREATE UNIQUE INDEX "ShotExecutionPlan_version_spec_input_key"
  ON "ShotExecutionPlan"("generationPlanVersionId", "generationSpecId", "planningInputHash");
CREATE UNIQUE INDEX "ShotExecutionPlan_projectId_id_key" ON "ShotExecutionPlan"("projectId", "id");
CREATE UNIQUE INDEX "ShotExecutionPlan_supersededById_key" ON "ShotExecutionPlan"("supersededById");
CREATE INDEX "ShotExecutionPlan_project_template_idx" ON "ShotExecutionPlan"("projectId", "planTemplateSha256");
CREATE INDEX "ShotExecutionPlan_version_outcome_idx" ON "ShotExecutionPlan"("generationPlanVersionId", "planningOutcome");

ALTER TABLE "GenerationBatch"
  ADD COLUMN "engineVersion" "GenerationEngineVersion" NOT NULL DEFAULT 'LEGACY_V1',
  ADD COLUMN "estimatedCostMicros" BIGINT,
  ADD COLUMN "maximumCostMicros" BIGINT,
  ADD COLUMN "currency" CHAR(3),
  ADD COLUMN "pricingSnapshotHash" CHAR(64),
  ADD COLUMN "continuationPolicyHash" CHAR(64),
  ADD COLUMN "supersedesBatchId" UUID,
  ALTER COLUMN "providerProfileId" DROP NOT NULL,
  ALTER COLUMN "providerId" DROP NOT NULL,
  ALTER COLUMN "modelId" DROP NOT NULL,
  ALTER COLUMN "workflowId" DROP NOT NULL,
  ALTER COLUMN "workflowVersion" DROP NOT NULL,
  ALTER COLUMN "workflowSha256" DROP NOT NULL;
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_supersedesBatchId_fkey"
  FOREIGN KEY ("supersedesBatchId") REFERENCES "GenerationBatch"("id") ON DELETE RESTRICT;

ALTER TABLE "GenerationBatchTarget"
  ADD COLUMN "shotExecutionPlanId" UUID,
  ADD COLUMN "executionDisposition" "GenerationExecutionDisposition" NOT NULL DEFAULT 'EXECUTE',
  ADD COLUMN "sourceArtifactId" UUID,
  ADD COLUMN "executionInputSnapshotJson" JSONB,
  ADD COLUMN "materializedInputHash" CHAR(64),
  ADD COLUMN "materializedExecutionSha256" CHAR(64),
  ALTER COLUMN "promptHash" DROP NOT NULL,
  ALTER COLUMN "compiledPrompt" DROP NOT NULL,
  ALTER COLUMN "slotManifestJson" DROP NOT NULL;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_project_plan_fkey"
  FOREIGN KEY ("projectId", "shotExecutionPlanId") REFERENCES "ShotExecutionPlan"("projectId", "id") ON DELETE RESTRICT;
ALTER TABLE "GenerationBatchTarget" ADD CONSTRAINT "GenerationBatchTarget_sourceArtifactId_fkey"
  FOREIGN KEY ("sourceArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT;
CREATE INDEX "GenerationBatchTarget_shotExecutionPlanId_idx" ON "GenerationBatchTarget"("shotExecutionPlanId");
CREATE INDEX "GenerationBatchTarget_sourceArtifactId_idx" ON "GenerationBatchTarget"("sourceArtifactId");

ALTER TABLE "ExecutionAuthorization"
  ADD COLUMN "maximumCostMicros" BIGINT,
  ADD COLUMN "currency" CHAR(3),
  ADD COLUMN "pricingSnapshotHash" CHAR(64);

ALTER TABLE "AuthorizationConsumption"
  ADD COLUMN "reservedCostMicros" BIGINT,
  ADD COLUMN "materializedPlanSha256" CHAR(64);

ALTER TABLE "GenerationJob" ADD COLUMN "providerIdempotencyKey" VARCHAR(255);
CREATE UNIQUE INDEX "GenerationJob_providerIdempotencyKey_key" ON "GenerationJob"("providerIdempotencyKey");

ALTER TABLE "ArtifactReviewFrame"
  ADD COLUMN "frameIndex" BIGINT,
  ADD COLUMN "pts" BIGINT,
  ADD COLUMN "timeBaseNumerator" INTEGER,
  ADD COLUMN "timeBaseDenominator" INTEGER;

ALTER TABLE "AiQaResult"
  ADD COLUMN "continuationDecision" VARCHAR(80),
  ADD COLUMN "continuationPolicyVersion" VARCHAR(80),
  ADD COLUMN "continuationPolicyHash" CHAR(64);

CREATE FUNCTION "reject_workflow_agent_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'workflow agent evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GenerationImplementationEvidence_immutable"
  BEFORE UPDATE OR DELETE ON "GenerationImplementationEvidence"
  FOR EACH ROW EXECUTE FUNCTION "reject_workflow_agent_append_only_mutation"();

CREATE OR REPLACE FUNCTION "guard_generation_implementation_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'generation implementation history is retained';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."implementationKey" IS DISTINCT FROM OLD."implementationKey"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."providerProfileId" IS DISTINCT FROM OLD."providerProfileId"
    OR NEW."modelProfileId" IS DISTINCT FROM OLD."modelProfileId"
    OR NEW."executorType" IS DISTINCT FROM OLD."executorType"
    OR NEW."adapterId" IS DISTINCT FROM OLD."adapterId"
    OR NEW."adapterVersion" IS DISTINCT FROM OLD."adapterVersion"
    OR NEW."registrySha256" IS DISTINCT FROM OLD."registrySha256"
    OR NEW."capabilitySnapshotHash" IS DISTINCT FROM OLD."capabilitySnapshotHash"
    OR NEW."constraintsSnapshotHash" IS DISTINCT FROM OLD."constraintsSnapshotHash"
    OR NEW."patternSnapshotHash" IS DISTINCT FROM OLD."patternSnapshotHash"
    OR NEW."runtimeSnapshotHash" IS DISTINCT FROM OLD."runtimeSnapshotHash"
    OR NEW."compilerSnapshotHash" IS DISTINCT FROM OLD."compilerSnapshotHash"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'generation implementation identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GenerationImplementation_guarded"
  BEFORE UPDATE OR DELETE ON "GenerationImplementation"
  FOR EACH ROW EXECUTE FUNCTION "guard_generation_implementation_mutation"();

CREATE OR REPLACE FUNCTION "guard_shot_execution_plan_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'shot execution plan history is retained';
  END IF;
  IF OLD."lifecycleStatus" <> 'DRAFT'
    AND (NEW."projectId" IS DISTINCT FROM OLD."projectId"
      OR NEW."generationPlanVersionId" IS DISTINCT FROM OLD."generationPlanVersionId"
      OR NEW."generationSpecId" IS DISTINCT FROM OLD."generationSpecId"
      OR NEW."implementationId" IS DISTINCT FROM OLD."implementationId"
      OR NEW."executorType" IS DISTINCT FROM OLD."executorType"
      OR NEW."adapterId" IS DISTINCT FROM OLD."adapterId"
      OR NEW."adapterVersion" IS DISTINCT FROM OLD."adapterVersion"
      OR NEW."planningInputHash" IS DISTINCT FROM OLD."planningInputHash"
      OR NEW."requirementsHash" IS DISTINCT FROM OLD."requirementsHash"
      OR NEW."capabilitySnapshotHash" IS DISTINCT FROM OLD."capabilitySnapshotHash"
      OR NEW."payloadJson" IS DISTINCT FROM OLD."payloadJson"
      OR NEW."planTemplateSha256" IS DISTINCT FROM OLD."planTemplateSha256"
      OR NEW."estimatedCostMicros" IS DISTINCT FROM OLD."estimatedCostMicros"
      OR NEW."maximumCostMicros" IS DISTINCT FROM OLD."maximumCostMicros"
      OR NEW."currency" IS DISTINCT FROM OLD."currency")
  THEN
    RAISE EXCEPTION 'frozen shot execution plan payload is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShotExecutionPlan_guarded"
  BEFORE UPDATE OR DELETE ON "ShotExecutionPlan"
  FOR EACH ROW EXECUTE FUNCTION "guard_shot_execution_plan_mutation"();

CREATE OR REPLACE FUNCTION "guard_generation_target_materialization"() RETURNS trigger AS $$
BEGIN
  IF OLD."materializedExecutionSha256" IS NOT NULL
    AND (NEW."executionInputSnapshotJson" IS DISTINCT FROM OLD."executionInputSnapshotJson"
      OR NEW."materializedInputHash" IS DISTINCT FROM OLD."materializedInputHash"
      OR NEW."materializedExecutionSha256" IS DISTINCT FROM OLD."materializedExecutionSha256")
  THEN
    RAISE EXCEPTION 'generation target materialization is write-once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GenerationBatchTarget_materialization_guarded"
  BEFORE UPDATE ON "GenerationBatchTarget"
  FOR EACH ROW EXECUTE FUNCTION "guard_generation_target_materialization"();

DROP TRIGGER IF EXISTS "StoryboardDirectorRun_guarded" ON "StoryboardDirectorRun";
CREATE OR REPLACE FUNCTION "guard_storyboard_director_run_mutation"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storyboard history is append-only';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."storyboardId" IS DISTINCT FROM OLD."storyboardId"
    OR NEW."providerId" IS DISTINCT FROM OLD."providerId"
    OR NEW."requestedModelId" IS DISTINCT FROM OLD."requestedModelId"
    OR NEW."contractVersion" IS DISTINCT FROM OLD."contractVersion"
    OR NEW."promptTemplateVersion" IS DISTINCT FROM OLD."promptTemplateVersion"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."maxShotCount" IS DISTINCT FROM OLD."maxShotCount"
    OR NEW."headVersionId" IS DISTINCT FROM OLD."headVersionId"
    OR NEW."headContentHash" IS DISTINCT FROM OLD."headContentHash"
    OR NEW."scopeHash" IS DISTINCT FROM OLD."scopeHash"
    OR NEW."priceSnapshotHash" IS DISTINCT FROM OLD."priceSnapshotHash"
    OR NEW."billingChannel" IS DISTINCT FROM OLD."billingChannel"
    OR NEW."maxCostUsd" IS DISTINCT FROM OLD."maxCostUsd"
    OR NEW."priceEffectiveAt" IS DISTINCT FROM OLD."priceEffectiveAt"
    OR NEW."priceExpiresAt" IS DISTINCT FROM OLD."priceExpiresAt"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."runKind" IS DISTINCT FROM OLD."runKind"
    OR NEW."sourceStoryboardVersionId" IS DISTINCT FROM OLD."sourceStoryboardVersionId"
    OR NEW."blockedShotKey" IS DISTINCT FROM OLD."blockedShotKey"
    OR NEW."repairAction" IS DISTINCT FROM OLD."repairAction"
    OR NEW."impactHash" IS DISTINCT FROM OLD."impactHash"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'storyboard director run scope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StoryboardDirectorRun_guarded"
  BEFORE UPDATE OR DELETE ON "StoryboardDirectorRun"
  FOR EACH ROW EXECUTE FUNCTION "guard_storyboard_director_run_mutation"();
