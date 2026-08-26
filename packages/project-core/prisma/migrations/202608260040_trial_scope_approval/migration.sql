CREATE TABLE "TrialScopeApproval" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "storyboardId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "storyboardVersionHash" CHAR(64) NOT NULL,
  "generationPlanId" UUID NOT NULL,
  "generationPlanVersion" VARCHAR(80) NOT NULL,
  "planDigest" CHAR(64) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "scopeDigest" CHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "actorRef" VARCHAR(160) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrialScopeApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrialScopeApprovalItem" (
  "id" UUID NOT NULL,
  "approvalId" UUID NOT NULL,
  "shotId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "generationSpecVersion" VARCHAR(80) NOT NULL,
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
  "compiledRequestDigest" CHAR(64) NOT NULL,
  "costPolicyDigest" CHAR(64) NOT NULL,
  "compositionDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrialScopeApprovalItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrialScopeRevocation" (
  "id" UUID NOT NULL,
  "approvalId" UUID NOT NULL,
  "reasonCode" VARCHAR(80) NOT NULL,
  "actorRef" VARCHAR(160) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrialScopeRevocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialScopeApproval_storyboardVersionId_idempotencyKey_key"
  ON "TrialScopeApproval"("storyboardVersionId", "idempotencyKey");
CREATE INDEX "TrialScopeApproval_projectId_storyboardId_createdAt_idx"
  ON "TrialScopeApproval"("projectId", "storyboardId", "createdAt" DESC);
CREATE INDEX "TrialScopeApproval_storyboardVersionId_expiresAt_idx"
  ON "TrialScopeApproval"("storyboardVersionId", "expiresAt");
CREATE UNIQUE INDEX "TrialScopeApprovalItem_approvalId_shotId_key"
  ON "TrialScopeApprovalItem"("approvalId", "shotId");
CREATE INDEX "TrialScopeApprovalItem_shotId_implementationKey_implementationVersion_idx"
  ON "TrialScopeApprovalItem"("shotId", "implementationKey", "implementationVersion");
CREATE UNIQUE INDEX "TrialScopeRevocation_approvalId_key" ON "TrialScopeRevocation"("approvalId");
CREATE UNIQUE INDEX "TrialScopeRevocation_idempotencyKey_key"
  ON "TrialScopeRevocation"("idempotencyKey");
CREATE INDEX "TrialScopeRevocation_createdAt_idx" ON "TrialScopeRevocation"("createdAt" DESC);

ALTER TABLE "TrialScopeApproval"
  ADD CONSTRAINT "TrialScopeApproval_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrialScopeApproval"
  ADD CONSTRAINT "TrialScopeApproval_storyboardId_fkey"
  FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrialScopeApproval"
  ADD CONSTRAINT "TrialScopeApproval_storyboardVersionId_fkey"
  FOREIGN KEY ("storyboardVersionId") REFERENCES "StoryboardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrialScopeApproval"
  ADD CONSTRAINT "TrialScopeApproval_generationPlanId_fkey"
  FOREIGN KEY ("generationPlanId") REFERENCES "GenerationPlanV3Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialScopeApprovalItem"
  ADD CONSTRAINT "TrialScopeApprovalItem_approvalId_fkey"
  FOREIGN KEY ("approvalId") REFERENCES "TrialScopeApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrialScopeApprovalItem"
  ADD CONSTRAINT "TrialScopeApprovalItem_generationSpecId_fkey"
  FOREIGN KEY ("generationSpecId") REFERENCES "GenerationSpecV3Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialScopeRevocation"
  ADD CONSTRAINT "TrialScopeRevocation_approvalId_fkey"
  FOREIGN KEY ("approvalId") REFERENCES "TrialScopeApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "TrialScopeApproval_immutable"
  BEFORE UPDATE OR DELETE ON "TrialScopeApproval"
  FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "TrialScopeApprovalItem_immutable"
  BEFORE UPDATE OR DELETE ON "TrialScopeApprovalItem"
  FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
CREATE TRIGGER "TrialScopeRevocation_immutable"
  BEFORE UPDATE OR DELETE ON "TrialScopeRevocation"
  FOR EACH ROW EXECUTE FUNCTION "reject_capability_append_only_mutation"();
