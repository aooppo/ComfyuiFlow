CREATE TYPE "GenerationPlanVersionSource" AS ENUM ('DETERMINISTIC_PLANNER', 'OWNER');
CREATE TYPE "GenerationPlanDecisionType" AS ENUM ('APPROVED', 'REVOKED');

CREATE TABLE "GenerationPlan" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "manifestId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "headVersionId" UUID,
  "approvedVersionId" UUID,
  "rowVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "GenerationPlan_idempotencyKey_key" ON "GenerationPlan"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationPlan_headVersionId_key" ON "GenerationPlan"("headVersionId");
CREATE UNIQUE INDEX "GenerationPlan_approvedVersionId_key" ON "GenerationPlan"("approvedVersionId");
CREATE UNIQUE INDEX "GenerationPlan_projectId_id_key" ON "GenerationPlan"("projectId", "id");
CREATE INDEX "GenerationPlan_storyboardId_createdAt_idx" ON "GenerationPlan"("storyboardId", "createdAt" DESC);
ALTER TABLE "GenerationPlan" ADD CONSTRAINT "GenerationPlan_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlan" ADD CONSTRAINT "GenerationPlan_project_storyboard_fkey" FOREIGN KEY ("projectId", "storyboardId") REFERENCES "Storyboard"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlan" ADD CONSTRAINT "GenerationPlan_project_storyboard_version_fkey" FOREIGN KEY ("projectId", "storyboardVersionId") REFERENCES "StoryboardVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlan" ADD CONSTRAINT "GenerationPlan_project_manifest_fkey" FOREIGN KEY ("projectId", "manifestId") REFERENCES "AssetResolutionManifest"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GenerationPlanVersion" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationPlanId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "parentVersionId" UUID,
  "source" "GenerationPlanVersionSource" NOT NULL,
  "plannerVersion" VARCHAR(80) NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "referencesHash" CHAR(64) NOT NULL,
  "outputHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GenerationPlanVersion_generationPlanId_versionNumber_key" ON "GenerationPlanVersion"("generationPlanId", "versionNumber");
CREATE UNIQUE INDEX "GenerationPlanVersion_generationPlanId_id_key" ON "GenerationPlanVersion"("generationPlanId", "id");
CREATE UNIQUE INDEX "GenerationPlanVersion_projectId_id_key" ON "GenerationPlanVersion"("projectId", "id");
CREATE INDEX "GenerationPlanVersion_generationPlanId_createdAt_idx" ON "GenerationPlanVersion"("generationPlanId", "createdAt" DESC);
ALTER TABLE "GenerationPlanVersion" ADD CONSTRAINT "GenerationPlanVersion_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanVersion" ADD CONSTRAINT "GenerationPlanVersion_project_plan_fkey" FOREIGN KEY ("projectId", "generationPlanId") REFERENCES "GenerationPlan"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanVersion" ADD CONSTRAINT "GenerationPlanVersion_parent_fkey" FOREIGN KEY ("generationPlanId", "parentVersionId") REFERENCES "GenerationPlanVersion"("generationPlanId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlan" ADD CONSTRAINT "GenerationPlan_head_fkey" FOREIGN KEY ("id", "headVersionId") REFERENCES "GenerationPlanVersion"("generationPlanId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlan" ADD CONSTRAINT "GenerationPlan_approved_fkey" FOREIGN KEY ("id", "approvedVersionId") REFERENCES "GenerationPlanVersion"("generationPlanId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GenerationSpec" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationPlanVersionId" UUID NOT NULL,
  "storyboardShotId" UUID NOT NULL,
  "shotKey" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "startState" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "endState" TEXT NOT NULL,
  "camera" TEXT NOT NULL,
  "composition" TEXT NOT NULL,
  "continuityRequirements" JSONB NOT NULL,
  "durationSeconds" DOUBLE PRECISION NOT NULL,
  "positivePrompt" TEXT NOT NULL,
  "capabilityRequirements" JSONB NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "referencesHash" CHAR(64) NOT NULL,
  "outputHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GenerationSpec_generationPlanVersionId_ordinal_key" ON "GenerationSpec"("generationPlanVersionId", "ordinal");
CREATE UNIQUE INDEX "GenerationSpec_generationPlanVersionId_shotKey_key" ON "GenerationSpec"("generationPlanVersionId", "shotKey");
CREATE UNIQUE INDEX "GenerationSpec_projectId_id_key" ON "GenerationSpec"("projectId", "id");
CREATE INDEX "GenerationSpec_generationPlanVersionId_ordinal_idx" ON "GenerationSpec"("generationPlanVersionId", "ordinal");
ALTER TABLE "GenerationSpec" ADD CONSTRAINT "GenerationSpec_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpec" ADD CONSTRAINT "GenerationSpec_project_version_fkey" FOREIGN KEY ("projectId", "generationPlanVersionId") REFERENCES "GenerationPlanVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpec" ADD CONSTRAINT "GenerationSpec_project_shot_fkey" FOREIGN KEY ("projectId", "storyboardShotId") REFERENCES "StoryboardShot"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GenerationSpecReference" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationSpecId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "productionAssetVersionId" UUID NOT NULL,
  "characterStateVersionId" UUID,
  "assetVersionFileId" UUID NOT NULL,
  "projectAssetId" UUID NOT NULL,
  "expectedSha256" CHAR(64) NOT NULL,
  "referenceUsage" "ReferenceUsage" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GenerationSpecReference_generationSpec_requirement_file_key" ON "GenerationSpecReference"("generationSpecId", "requirementId", "assetVersionFileId");
CREATE UNIQUE INDEX "GenerationSpecReference_projectId_id_key" ON "GenerationSpecReference"("projectId", "id");
CREATE INDEX "GenerationSpecReference_generationSpecId_idx" ON "GenerationSpecReference"("generationSpecId");
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_spec_fkey" FOREIGN KEY ("projectId", "generationSpecId") REFERENCES "GenerationSpec"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_requirement_fkey" FOREIGN KEY ("projectId", "requirementId") REFERENCES "ShotAssetRequirement"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_production_version_fkey" FOREIGN KEY ("projectId", "productionAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_character_state_fkey" FOREIGN KEY ("projectId", "characterStateVersionId") REFERENCES "CharacterStateVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_file_fkey" FOREIGN KEY ("projectId", "assetVersionFileId") REFERENCES "AssetVersionFile"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationSpecReference" ADD CONSTRAINT "GenerationSpecReference_project_asset_fkey" FOREIGN KEY ("projectId", "projectAssetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GenerationPlanDecision" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "generationPlanId" UUID NOT NULL,
  "generationPlanVersionId" UUID NOT NULL,
  "decision" "GenerationPlanDecisionType" NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GenerationPlanDecision_idempotencyKey_key" ON "GenerationPlanDecision"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationPlanDecision_projectId_id_key" ON "GenerationPlanDecision"("projectId", "id");
CREATE INDEX "GenerationPlanDecision_generationPlanId_createdAt_idx" ON "GenerationPlanDecision"("generationPlanId", "createdAt" DESC);
ALTER TABLE "GenerationPlanDecision" ADD CONSTRAINT "GenerationPlanDecision_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanDecision" ADD CONSTRAINT "GenerationPlanDecision_project_plan_fkey" FOREIGN KEY ("projectId", "generationPlanId") REFERENCES "GenerationPlan"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanDecision" ADD CONSTRAINT "GenerationPlanDecision_project_version_fkey" FOREIGN KEY ("projectId", "generationPlanVersionId") REFERENCES "GenerationPlanVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_generation_plan_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'generation plan history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GenerationPlanVersion_immutable" BEFORE UPDATE OR DELETE ON "GenerationPlanVersion" FOR EACH ROW EXECUTE FUNCTION "reject_generation_plan_history_mutation"();
CREATE TRIGGER "GenerationSpec_immutable" BEFORE UPDATE OR DELETE ON "GenerationSpec" FOR EACH ROW EXECUTE FUNCTION "reject_generation_plan_history_mutation"();
CREATE TRIGGER "GenerationSpecReference_immutable" BEFORE UPDATE OR DELETE ON "GenerationSpecReference" FOR EACH ROW EXECUTE FUNCTION "reject_generation_plan_history_mutation"();
CREATE TRIGGER "GenerationPlanDecision_immutable" BEFORE UPDATE OR DELETE ON "GenerationPlanDecision" FOR EACH ROW EXECUTE FUNCTION "reject_generation_plan_history_mutation"();
