CREATE TYPE "CapabilityImplementationLifecycle" AS ENUM ('DISCOVERED', 'TRIAL', 'READY', 'DEPRECATED', 'DISABLED');
CREATE TYPE "CapabilityDiscoveryStatus" AS ENUM ('DISCOVERED', 'REVIEW_REJECTED', 'PUBLISHED');
CREATE TYPE "CapabilityEvidenceKind" AS ENUM ('FIXTURE', 'CONTRACT', 'RUNTIME_READINESS', 'AUTHORIZED_REAL_EXECUTION');
CREATE TYPE "CapabilityEvidenceOutcome" AS ENUM ('PASS', 'FAIL', 'AMBIGUOUS');
CREATE TYPE "GenerationPlanV3State" AS ENUM ('DRAFT', 'VALID', 'BLOCKED', 'AUTHORIZED', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "GenerationAuthorizationV3State" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "CapabilityRuntimeProfile" (
  "id" UUID PRIMARY KEY,
  "profileKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityRuntimeProfile_profileKey_version_key" ON "CapabilityRuntimeProfile"("profileKey", "version");

CREATE TABLE "CapabilityProviderProfile" (
  "id" UUID PRIMARY KEY,
  "profileKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityProviderProfile_profileKey_version_key" ON "CapabilityProviderProfile"("profileKey", "version");

CREATE TABLE "CapabilityModelProfile" (
  "id" UUID PRIMARY KEY,
  "profileKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "providerKey" VARCHAR(160) NOT NULL,
  "providerVersion" VARCHAR(80) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityModelProfile_profileKey_version_key" ON "CapabilityModelProfile"("profileKey", "version");
CREATE INDEX "CapabilityModelProfile_providerKey_providerVersion_idx" ON "CapabilityModelProfile"("providerKey", "providerVersion");

CREATE TABLE "CapabilityAdapterProfile" (
  "id" UUID PRIMARY KEY,
  "profileKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "factoryKey" VARCHAR(160) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityAdapterProfile_profileKey_version_key" ON "CapabilityAdapterProfile"("profileKey", "version");
CREATE INDEX "CapabilityAdapterProfile_factoryKey_version_idx" ON "CapabilityAdapterProfile"("factoryKey", "version");

CREATE TABLE "CapabilityCompilerProfile" (
  "id" UUID PRIMARY KEY,
  "profileKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityCompilerProfile_profileKey_version_key" ON "CapabilityCompilerProfile"("profileKey", "version");
CREATE INDEX "CapabilityCompilerProfile_compilerKey_version_idx" ON "CapabilityCompilerProfile"("compilerKey", "version");

CREATE TABLE "CapabilityGenerationImplementation" (
  "id" UUID PRIMARY KEY,
  "implementationKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "runtimeKey" VARCHAR(160) NOT NULL,
  "runtimeVersion" VARCHAR(80) NOT NULL,
  "providerKey" VARCHAR(160) NOT NULL,
  "providerVersion" VARCHAR(80) NOT NULL,
  "modelKey" VARCHAR(160) NOT NULL,
  "modelVersion" VARCHAR(80) NOT NULL,
  "adapterKey" VARCHAR(160) NOT NULL,
  "adapterVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "capabilityJson" JSONB NOT NULL,
  "costPolicyJson" JSONB NOT NULL,
  "compositionHash" CHAR(64) NOT NULL,
  "lifecycle" "CapabilityImplementationLifecycle" NOT NULL,
  "lifecycleReasonCode" VARCHAR(160),
  "testOnly" BOOLEAN NOT NULL DEFAULT false,
  "lifecycleUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityGenerationImplementation_implementationKey_version_key" ON "CapabilityGenerationImplementation"("implementationKey", "version");
CREATE INDEX "CapabilityGenerationImplementation_lifecycle_lifecycleUpdatedAt_idx" ON "CapabilityGenerationImplementation"("lifecycle", "lifecycleUpdatedAt" DESC);

CREATE TABLE "CapabilityDiscoveryCandidate" (
  "id" UUID PRIMARY KEY,
  "candidateKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "runtimeKey" VARCHAR(160) NOT NULL,
  "runtimeVersion" VARCHAR(80) NOT NULL,
  "sourceDigest" CHAR(64) NOT NULL,
  "nodeIdentifier" VARCHAR(160) NOT NULL,
  "normalizedJson" JSONB NOT NULL,
  "rawSchemaRef" VARCHAR(160) NOT NULL,
  "status" "CapabilityDiscoveryStatus" NOT NULL DEFAULT 'DISCOVERED',
  "statusReason" VARCHAR(160),
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityDiscoveryCandidate_candidateKey_version_key" ON "CapabilityDiscoveryCandidate"("candidateKey", "version");
CREATE UNIQUE INDEX "CapabilityDiscoveryCandidate_runtime_source_node_key" ON "CapabilityDiscoveryCandidate"("runtimeKey", "runtimeVersion", "sourceDigest", "nodeIdentifier");
CREATE INDEX "CapabilityDiscoveryCandidate_status_discoveredAt_idx" ON "CapabilityDiscoveryCandidate"("status", "discoveredAt" DESC);

CREATE TABLE "CapabilityRegistryPublication" (
  "id" UUID PRIMARY KEY,
  "publicationKey" VARCHAR(160) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "candidateKey" VARCHAR(160) NOT NULL,
  "candidateVersion" VARCHAR(80) NOT NULL,
  "sourceDigest" CHAR(64) NOT NULL,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "reviewedCompositionJson" JSONB NOT NULL,
  "publicationHash" CHAR(64) NOT NULL,
  "reviewerRef" VARCHAR(160) NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CapabilityRegistryPublication_publicationKey_version_key" ON "CapabilityRegistryPublication"("publicationKey", "version");
CREATE UNIQUE INDEX "CapabilityRegistryPublication_candidateKey_candidateVersion_key" ON "CapabilityRegistryPublication"("candidateKey", "candidateVersion");
CREATE INDEX "CapabilityRegistryPublication_implementation_idx" ON "CapabilityRegistryPublication"("implementationKey", "implementationVersion");

CREATE TABLE "CapabilityImplementationEvidence" (
  "id" UUID PRIMARY KEY,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "kind" "CapabilityEvidenceKind" NOT NULL,
  "outcome" "CapabilityEvidenceOutcome" NOT NULL,
  "evidenceJson" JSONB NOT NULL,
  "evidenceHash" CHAR(64) NOT NULL,
  "callCount" INTEGER NOT NULL DEFAULT 0,
  "costDigest" CHAR(64),
  "reviewerRef" VARCHAR(160),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapabilityImplementationEvidence_callCount_check" CHECK ("callCount" >= 0)
);
CREATE UNIQUE INDEX "CapabilityImplementationEvidence_exact_source_key" ON "CapabilityImplementationEvidence"("implementationKey", "implementationVersion", "kind", "evidenceHash");
CREATE INDEX "CapabilityImplementationEvidence_implementation_recorded_idx" ON "CapabilityImplementationEvidence"("implementationKey", "implementationVersion", "recordedAt" DESC);

CREATE TABLE "ShotRequirementSpecV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "storyboardShotId" UUID NOT NULL,
  "shotId" UUID NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "requirementHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ShotRequirementSpecV3Record_shotId_version_key" ON "ShotRequirementSpecV3Record"("shotId", "version");
CREATE UNIQUE INDEX "ShotRequirementSpecV3Record_storyboardShotId_requirementHash_key" ON "ShotRequirementSpecV3Record"("storyboardShotId", "requirementHash");
CREATE INDEX "ShotRequirementSpecV3Record_project_storyboard_idx" ON "ShotRequirementSpecV3Record"("projectId", "storyboardVersionId");

CREATE TABLE "PlanningInputSnapshotV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "requirementSpecId" UUID NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "sourceDigest" CHAR(64) NOT NULL,
  "capabilityDigest" CHAR(64) NOT NULL,
  "snapshotHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PlanningInputSnapshotV3Record_requirementSpecId_version_key" ON "PlanningInputSnapshotV3Record"("requirementSpecId", "version");
CREATE UNIQUE INDEX "PlanningInputSnapshotV3Record_projectId_snapshotHash_key" ON "PlanningInputSnapshotV3Record"("projectId", "snapshotHash");

CREATE TABLE "GenerationSpecV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "shotId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "requirementSpecId" UUID NOT NULL,
  "planningInputSnapshotId" UUID NOT NULL,
  "implementationKey" VARCHAR(160) NOT NULL,
  "implementationVersion" VARCHAR(80) NOT NULL,
  "runtimeKey" VARCHAR(160) NOT NULL,
  "runtimeVersion" VARCHAR(80) NOT NULL,
  "providerKey" VARCHAR(160) NOT NULL,
  "providerVersion" VARCHAR(80) NOT NULL,
  "modelKey" VARCHAR(160) NOT NULL,
  "modelVersion" VARCHAR(80) NOT NULL,
  "adapterKey" VARCHAR(160) NOT NULL,
  "adapterVersion" VARCHAR(80) NOT NULL,
  "compilerKey" VARCHAR(160) NOT NULL,
  "compilerVersion" VARCHAR(80) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "compiledRequestDigest" CHAR(64) NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "dependencyHash" CHAR(64) NOT NULL,
  "outputHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GenerationSpecV3Record_shotId_version_key" ON "GenerationSpecV3Record"("shotId", "version");
CREATE UNIQUE INDEX "GenerationSpecV3Record_projectId_outputHash_key" ON "GenerationSpecV3Record"("projectId", "outputHash");
CREATE INDEX "GenerationSpecV3Record_planningInputSnapshotId_idx" ON "GenerationSpecV3Record"("planningInputSnapshotId");

CREATE TABLE "GenerationPlanV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "planDigest" CHAR(64) NOT NULL,
  "state" "GenerationPlanV3State" NOT NULL DEFAULT 'DRAFT',
  "stateReasonCode" VARCHAR(160),
  "stateUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GenerationPlanV3Record_projectId_planDigest_key" ON "GenerationPlanV3Record"("projectId", "planDigest");
CREATE INDEX "GenerationPlanV3Record_project_state_created_idx" ON "GenerationPlanV3Record"("projectId", "state", "createdAt" DESC);

CREATE TABLE "GenerationAuthorizationV3Record" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationPlanId" UUID NOT NULL,
  "planDigest" CHAR(64) NOT NULL,
  "scopeJson" JSONB NOT NULL,
  "scopeHash" CHAR(64) NOT NULL,
  "expectedCalls" INTEGER NOT NULL,
  "maximumCalls" INTEGER NOT NULL,
  "consumedCalls" INTEGER NOT NULL DEFAULT 0,
  "maximumCostMicros" BIGINT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "noRetry" BOOLEAN NOT NULL DEFAULT true,
  "noFallback" BOOLEAN NOT NULL DEFAULT true,
  "state" "GenerationAuthorizationV3State" NOT NULL DEFAULT 'ACTIVE',
  "stateUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationAuthorizationV3Record_call_caps_check" CHECK (
    "expectedCalls" >= 0 AND "maximumCalls" > 0 AND
    "expectedCalls" <= "maximumCalls" AND "consumedCalls" >= 0 AND
    "consumedCalls" <= "maximumCalls"
  ),
  CONSTRAINT "GenerationAuthorizationV3Record_cost_check" CHECK ("maximumCostMicros" IS NULL OR "maximumCostMicros" >= 0),
  CONSTRAINT "GenerationAuthorizationV3Record_no_retry_check" CHECK ("noRetry" AND "noFallback")
);
CREATE UNIQUE INDEX "GenerationAuthorizationV3Record_generationPlanId_scopeHash_key" ON "GenerationAuthorizationV3Record"("generationPlanId", "scopeHash");
CREATE INDEX "GenerationAuthorizationV3Record_project_state_expires_idx" ON "GenerationAuthorizationV3Record"("projectId", "state", "expiresAt");

CREATE FUNCTION "reject_capability_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'capability workflow record is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CapabilityRuntimeProfile_immutable" BEFORE UPDATE OR DELETE ON "CapabilityRuntimeProfile" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "CapabilityProviderProfile_immutable" BEFORE UPDATE OR DELETE ON "CapabilityProviderProfile" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "CapabilityModelProfile_immutable" BEFORE UPDATE OR DELETE ON "CapabilityModelProfile" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "CapabilityAdapterProfile_immutable" BEFORE UPDATE OR DELETE ON "CapabilityAdapterProfile" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "CapabilityCompilerProfile_immutable" BEFORE UPDATE OR DELETE ON "CapabilityCompilerProfile" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "CapabilityRegistryPublication_immutable" BEFORE UPDATE OR DELETE ON "CapabilityRegistryPublication" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "CapabilityImplementationEvidence_immutable" BEFORE UPDATE OR DELETE ON "CapabilityImplementationEvidence" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "ShotRequirementSpecV3Record_immutable" BEFORE UPDATE OR DELETE ON "ShotRequirementSpecV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "PlanningInputSnapshotV3Record_immutable" BEFORE UPDATE OR DELETE ON "PlanningInputSnapshotV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "GenerationSpecV3Record_immutable" BEFORE UPDATE OR DELETE ON "GenerationSpecV3Record" FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();

CREATE FUNCTION "guard_capability_implementation_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'capability implementation history is retained';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."implementationKey" IS DISTINCT FROM OLD."implementationKey"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."runtimeKey" IS DISTINCT FROM OLD."runtimeKey"
    OR NEW."runtimeVersion" IS DISTINCT FROM OLD."runtimeVersion"
    OR NEW."providerKey" IS DISTINCT FROM OLD."providerKey"
    OR NEW."providerVersion" IS DISTINCT FROM OLD."providerVersion"
    OR NEW."modelKey" IS DISTINCT FROM OLD."modelKey"
    OR NEW."modelVersion" IS DISTINCT FROM OLD."modelVersion"
    OR NEW."adapterKey" IS DISTINCT FROM OLD."adapterKey"
    OR NEW."adapterVersion" IS DISTINCT FROM OLD."adapterVersion"
    OR NEW."compilerKey" IS DISTINCT FROM OLD."compilerKey"
    OR NEW."compilerVersion" IS DISTINCT FROM OLD."compilerVersion"
    OR NEW."capabilityJson" IS DISTINCT FROM OLD."capabilityJson"
    OR NEW."costPolicyJson" IS DISTINCT FROM OLD."costPolicyJson"
    OR NEW."compositionHash" IS DISTINCT FROM OLD."compositionHash"
    OR NEW."testOnly" IS DISTINCT FROM OLD."testOnly"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'capability implementation identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CapabilityGenerationImplementation_guarded" BEFORE UPDATE OR DELETE ON "CapabilityGenerationImplementation" FOR EACH ROW EXECUTE FUNCTION "guard_capability_implementation_mutation"();

CREATE FUNCTION "guard_capability_discovery_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'capability discovery history is retained'; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."candidateKey" IS DISTINCT FROM OLD."candidateKey"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."runtimeKey" IS DISTINCT FROM OLD."runtimeKey"
    OR NEW."runtimeVersion" IS DISTINCT FROM OLD."runtimeVersion"
    OR NEW."sourceDigest" IS DISTINCT FROM OLD."sourceDigest"
    OR NEW."nodeIdentifier" IS DISTINCT FROM OLD."nodeIdentifier"
    OR NEW."normalizedJson" IS DISTINCT FROM OLD."normalizedJson"
    OR NEW."rawSchemaRef" IS DISTINCT FROM OLD."rawSchemaRef"
    OR NEW."discoveredAt" IS DISTINCT FROM OLD."discoveredAt"
  THEN RAISE EXCEPTION 'capability discovery identity is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CapabilityDiscoveryCandidate_guarded" BEFORE UPDATE OR DELETE ON "CapabilityDiscoveryCandidate" FOR EACH ROW EXECUTE FUNCTION "guard_capability_discovery_mutation"();

CREATE FUNCTION "guard_generation_plan_v3_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'generation plan v3 history is retained'; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."payloadJson" IS DISTINCT FROM OLD."payloadJson"
    OR NEW."planDigest" IS DISTINCT FROM OLD."planDigest"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN RAISE EXCEPTION 'generation plan v3 identity is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GenerationPlanV3Record_guarded" BEFORE UPDATE OR DELETE ON "GenerationPlanV3Record" FOR EACH ROW EXECUTE FUNCTION "guard_generation_plan_v3_mutation"();

CREATE FUNCTION "guard_generation_authorization_v3_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'generation authorization v3 history is retained'; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."generationPlanId" IS DISTINCT FROM OLD."generationPlanId"
    OR NEW."planDigest" IS DISTINCT FROM OLD."planDigest"
    OR NEW."scopeJson" IS DISTINCT FROM OLD."scopeJson"
    OR NEW."scopeHash" IS DISTINCT FROM OLD."scopeHash"
    OR NEW."expectedCalls" IS DISTINCT FROM OLD."expectedCalls"
    OR NEW."maximumCalls" IS DISTINCT FROM OLD."maximumCalls"
    OR NEW."maximumCostMicros" IS DISTINCT FROM OLD."maximumCostMicros"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."noRetry" IS DISTINCT FROM OLD."noRetry"
    OR NEW."noFallback" IS DISTINCT FROM OLD."noFallback"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN RAISE EXCEPTION 'generation authorization v3 scope is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GenerationAuthorizationV3Record_guarded" BEFORE UPDATE OR DELETE ON "GenerationAuthorizationV3Record" FOR EACH ROW EXECUTE FUNCTION "guard_generation_authorization_v3_mutation"();
