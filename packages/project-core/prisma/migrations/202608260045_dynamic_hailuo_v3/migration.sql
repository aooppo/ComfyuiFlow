CREATE TABLE "ReferencePlanV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "shotId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "referencePlanDigest" CHAR(64) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferencePlanV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterializedGraphSnapshotV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "referencePlanDigest" CHAR(64) NOT NULL,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "validatorKey" VARCHAR(160) NOT NULL,
  "validatorVersion" VARCHAR(80) NOT NULL,
  "materializedGraphSha256" CHAR(64) NOT NULL,
  "capabilityEnvelopeDigest" CHAR(64) NOT NULL,
  "runtimeContractDigest" CHAR(64) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterializedGraphSnapshotV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorizationConsumptionV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "authorizationId" UUID NOT NULL,
  "generationBatchTargetId" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "operation" VARCHAR(40) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "consumedCalls" INTEGER NOT NULL DEFAULT 1,
  "consumedCostMicros" BIGINT,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorizationConsumptionV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationAttemptV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "generationBatchTargetId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "authorizationConsumptionId" UUID NOT NULL,
  "referencePlanDigest" CHAR(64) NOT NULL,
  "materializedGraphSha256" CHAR(64) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "validatorKey" VARCHAR(160) NOT NULL,
  "validatorVersion" VARCHAR(80) NOT NULL,
  "capabilityEnvelopeDigest" CHAR(64) NOT NULL,
  "runtimeContractDigest" CHAR(64) NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "state" VARCHAR(40) NOT NULL,
  "providerTaskId" VARCHAR(500),
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "safeResultCode" VARCHAR(160),
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenerationAttemptV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationArtifactV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "storageKey" VARCHAR(500) NOT NULL,
  "mediaType" VARCHAR(120) NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "technicalStatus" VARCHAR(40) NOT NULL,
  "technicalResultCode" VARCHAR(160),
  "ffprobeJson" JSONB,
  "reviewFramesJson" JSONB,
  "aiQaStatus" VARCHAR(60) NOT NULL DEFAULT 'AI_QA_UNAVAILABLE',
  "aiQaResultJson" JSONB,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationArtifactV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationOwnerDecisionV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "artifactId" UUID NOT NULL,
  "decision" VARCHAR(40) NOT NULL,
  "reasonCode" VARCHAR(160),
  "notes" TEXT,
  "actorRef" VARCHAR(160) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationOwnerDecisionV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationRetryPreviewV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "failedAttemptId" UUID NOT NULL,
  "nextAttemptNumber" INTEGER NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "materializedGraphSha256" CHAR(64) NOT NULL,
  "expectedCalls" INTEGER NOT NULL DEFAULT 1,
  "maximumCalls" INTEGER NOT NULL DEFAULT 1,
  "maximumCostMicros" BIGINT,
  "previewDigest" CHAR(64) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationRetryPreviewV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationAssemblyV3Record" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "inputDigest" CHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "state" VARCHAR(40) NOT NULL,
  "outputStorageKey" VARCHAR(500),
  "outputSha256" CHAR(64),
  "outputByteSize" BIGINT,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenerationAssemblyV3Record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationAssemblySourceV3Record" (
  "id" UUID NOT NULL,
  "assemblyId" UUID NOT NULL,
  "artifactId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationAssemblySourceV3Record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferencePlanV3Record_generationSpecId_key" ON "ReferencePlanV3Record"("generationSpecId");
CREATE UNIQUE INDEX "ReferencePlanV3Record_referencePlanDigest_key" ON "ReferencePlanV3Record"("referencePlanDigest");
CREATE INDEX "ReferencePlanV3Record_projectId_storyboardVersionId_shotId_idx" ON "ReferencePlanV3Record"("projectId", "storyboardVersionId", "shotId");
CREATE UNIQUE INDEX "MaterializedGraphSnapshotV3Record_generationSpecId_key" ON "MaterializedGraphSnapshotV3Record"("generationSpecId");
CREATE UNIQUE INDEX "MaterializedGraphSnapshotV3Record_referencePlanDigest_key" ON "MaterializedGraphSnapshotV3Record"("referencePlanDigest");
CREATE UNIQUE INDEX "MaterializedGraphSnapshotV3Record_materializedGraphSha256_key" ON "MaterializedGraphSnapshotV3Record"("materializedGraphSha256");
CREATE INDEX "MaterializedGraphSnapshotV3Record_projectId_createdAt_idx" ON "MaterializedGraphSnapshotV3Record"("projectId", "createdAt" DESC);
CREATE UNIQUE INDEX "AuthorizationConsumptionV3Record_attemptId_key" ON "AuthorizationConsumptionV3Record"("attemptId");
CREATE UNIQUE INDEX "AuthorizationConsumptionV3Record_authorizationId_sequence_key" ON "AuthorizationConsumptionV3Record"("authorizationId", "sequence");
CREATE INDEX "AuthorizationConsumptionV3Record_projectId_authorizationId_createdAt_idx" ON "AuthorizationConsumptionV3Record"("projectId", "authorizationId", "createdAt");
CREATE UNIQUE INDEX "GenerationAttemptV3Record_authorizationConsumptionId_key" ON "GenerationAttemptV3Record"("authorizationConsumptionId");
CREATE UNIQUE INDEX "GenerationAttemptV3Record_idempotencyKey_key" ON "GenerationAttemptV3Record"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationAttemptV3Record_providerTaskId_key" ON "GenerationAttemptV3Record"("providerTaskId");
CREATE UNIQUE INDEX "GenerationAttemptV3Record_generationBatchTargetId_attemptNumber_key" ON "GenerationAttemptV3Record"("generationBatchTargetId", "attemptNumber");
CREATE INDEX "GenerationAttemptV3Record_projectId_state_createdAt_idx" ON "GenerationAttemptV3Record"("projectId", "state", "createdAt");
CREATE UNIQUE INDEX "GenerationArtifactV3Record_attemptId_key" ON "GenerationArtifactV3Record"("attemptId");
CREATE UNIQUE INDEX "GenerationArtifactV3Record_storageKey_key" ON "GenerationArtifactV3Record"("storageKey");
CREATE INDEX "GenerationArtifactV3Record_projectId_createdAt_idx" ON "GenerationArtifactV3Record"("projectId", "createdAt" DESC);
CREATE UNIQUE INDEX "GenerationOwnerDecisionV3Record_idempotencyKey_key" ON "GenerationOwnerDecisionV3Record"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationOwnerDecisionV3Record_artifactId_createdAt_key" ON "GenerationOwnerDecisionV3Record"("artifactId", "createdAt");
CREATE INDEX "GenerationOwnerDecisionV3Record_projectId_artifactId_createdAt_idx" ON "GenerationOwnerDecisionV3Record"("projectId", "artifactId", "createdAt" DESC);
CREATE UNIQUE INDEX "GenerationRetryPreviewV3Record_previewDigest_key" ON "GenerationRetryPreviewV3Record"("previewDigest");
CREATE UNIQUE INDEX "GenerationRetryPreviewV3Record_failedAttemptId_nextAttemptNumber_key" ON "GenerationRetryPreviewV3Record"("failedAttemptId", "nextAttemptNumber");
CREATE INDEX "GenerationRetryPreviewV3Record_projectId_createdAt_idx" ON "GenerationRetryPreviewV3Record"("projectId", "createdAt" DESC);
CREATE UNIQUE INDEX "GenerationAssemblyV3Record_inputDigest_key" ON "GenerationAssemblyV3Record"("inputDigest");
CREATE UNIQUE INDEX "GenerationAssemblyV3Record_idempotencyKey_key" ON "GenerationAssemblyV3Record"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationAssemblyV3Record_outputStorageKey_key" ON "GenerationAssemblyV3Record"("outputStorageKey");
CREATE INDEX "GenerationAssemblyV3Record_projectId_storyboardVersionId_createdAt_idx" ON "GenerationAssemblyV3Record"("projectId", "storyboardVersionId", "createdAt" DESC);
CREATE UNIQUE INDEX "GenerationAssemblySourceV3Record_assemblyId_ordinal_key" ON "GenerationAssemblySourceV3Record"("assemblyId", "ordinal");
CREATE UNIQUE INDEX "GenerationAssemblySourceV3Record_assemblyId_artifactId_key" ON "GenerationAssemblySourceV3Record"("assemblyId", "artifactId");

CREATE TRIGGER "ReferencePlanV3Record_immutable" BEFORE UPDATE OR DELETE ON "ReferencePlanV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "MaterializedGraphSnapshotV3Record_immutable" BEFORE UPDATE OR DELETE ON "MaterializedGraphSnapshotV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "AuthorizationConsumptionV3Record_immutable" BEFORE UPDATE OR DELETE ON "AuthorizationConsumptionV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "GenerationArtifactV3Record_immutable" BEFORE UPDATE OR DELETE ON "GenerationArtifactV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "GenerationOwnerDecisionV3Record_immutable" BEFORE UPDATE OR DELETE ON "GenerationOwnerDecisionV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "GenerationRetryPreviewV3Record_immutable" BEFORE UPDATE OR DELETE ON "GenerationRetryPreviewV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "GenerationAssemblySourceV3Record_immutable" BEFORE UPDATE OR DELETE ON "GenerationAssemblySourceV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
