CREATE TYPE "StoryboardVersionSource" AS ENUM ('OWNER', 'FAKE_DIRECTOR');
CREATE TYPE "StoryboardDirectorRunStatus" AS ENUM ('COMPLETED', 'FAILED');
CREATE TYPE "StoryboardDecisionType" AS ENUM ('APPROVED', 'REVOKED');

CREATE TABLE "Storyboard" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "creativeBrief" TEXT NOT NULL,
  "headVersionId" UUID,
  "approvedVersionId" UUID,
  "rowVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Storyboard_projectId_id_key" ON "Storyboard"("projectId", "id");
CREATE UNIQUE INDEX "Storyboard_headVersionId_key" ON "Storyboard"("headVersionId");
CREATE UNIQUE INDEX "Storyboard_approvedVersionId_key" ON "Storyboard"("approvedVersionId");
CREATE INDEX "Storyboard_projectId_updatedAt_idx" ON "Storyboard"("projectId", "updatedAt" DESC);
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoryboardVersion" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "parentVersionId" UUID,
  "source" "StoryboardVersionSource" NOT NULL,
  "creativeBrief" TEXT NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StoryboardVersion_storyboardId_versionNumber_key" ON "StoryboardVersion"("storyboardId", "versionNumber");
CREATE UNIQUE INDEX "StoryboardVersion_storyboardId_id_key" ON "StoryboardVersion"("storyboardId", "id");
CREATE UNIQUE INDEX "StoryboardVersion_projectId_id_key" ON "StoryboardVersion"("projectId", "id");
CREATE INDEX "StoryboardVersion_storyboardId_createdAt_idx" ON "StoryboardVersion"("storyboardId", "createdAt" DESC);
ALTER TABLE "StoryboardVersion" ADD CONSTRAINT "StoryboardVersion_project_storyboard_fkey" FOREIGN KEY ("projectId", "storyboardId") REFERENCES "Storyboard"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardVersion" ADD CONSTRAINT "StoryboardVersion_parent_fkey" FOREIGN KEY ("storyboardId", "parentVersionId") REFERENCES "StoryboardVersion"("storyboardId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_head_fkey" FOREIGN KEY ("id", "headVersionId") REFERENCES "StoryboardVersion"("storyboardId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_approved_fkey" FOREIGN KEY ("id", "approvedVersionId") REFERENCES "StoryboardVersion"("storyboardId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoryboardDirectorRun" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardId" UUID NOT NULL,
  "providerId" VARCHAR(80) NOT NULL,
  "requestedModelId" VARCHAR(160) NOT NULL,
  "resolvedModelId" VARCHAR(160),
  "contractVersion" VARCHAR(80) NOT NULL,
  "promptTemplateVersion" VARCHAR(80) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "responseId" VARCHAR(255),
  "status" "StoryboardDirectorRunStatus" NOT NULL,
  "safeResultCode" VARCHAR(80) NOT NULL,
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "generatedVersionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "StoryboardDirectorRun_generatedVersionId_key" ON "StoryboardDirectorRun"("generatedVersionId");
CREATE UNIQUE INDEX "StoryboardDirectorRun_projectId_id_key" ON "StoryboardDirectorRun"("projectId", "id");
CREATE INDEX "StoryboardDirectorRun_storyboardId_createdAt_idx" ON "StoryboardDirectorRun"("storyboardId", "createdAt" DESC);
ALTER TABLE "StoryboardDirectorRun" ADD CONSTRAINT "StoryboardDirectorRun_project_storyboard_fkey" FOREIGN KEY ("projectId", "storyboardId") REFERENCES "Storyboard"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDirectorRun" ADD CONSTRAINT "StoryboardDirectorRun_generated_fkey" FOREIGN KEY ("storyboardId", "generatedVersionId") REFERENCES "StoryboardVersion"("storyboardId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoryboardShot" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "shotKey" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "creativeDescription" TEXT NOT NULL,
  "startState" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "endState" TEXT NOT NULL,
  "camera" TEXT NOT NULL,
  "composition" TEXT NOT NULL,
  "continuityRequirements" JSONB NOT NULL,
  "durationSeconds" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StoryboardShot_storyboardVersionId_ordinal_key" ON "StoryboardShot"("storyboardVersionId", "ordinal");
CREATE UNIQUE INDEX "StoryboardShot_storyboardVersionId_shotKey_key" ON "StoryboardShot"("storyboardVersionId", "shotKey");
CREATE UNIQUE INDEX "StoryboardShot_projectId_id_key" ON "StoryboardShot"("projectId", "id");
CREATE INDEX "StoryboardShot_storyboardVersionId_ordinal_idx" ON "StoryboardShot"("storyboardVersionId", "ordinal");
ALTER TABLE "StoryboardShot" ADD CONSTRAINT "StoryboardShot_project_version_fkey" FOREIGN KEY ("projectId", "storyboardVersionId") REFERENCES "StoryboardVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ShotAssetRequirement" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "storyboardShotId" UUID NOT NULL,
  "requirementKey" VARCHAR(120) NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "inputJson" JSONB NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ShotAssetRequirement_storyboardShotId_requirementKey_key" ON "ShotAssetRequirement"("storyboardShotId", "requirementKey");
CREATE UNIQUE INDEX "ShotAssetRequirement_projectId_id_key" ON "ShotAssetRequirement"("projectId", "id");
CREATE INDEX "ShotAssetRequirement_storyboardVersionId_storyboardShotId_idx" ON "ShotAssetRequirement"("storyboardVersionId", "storyboardShotId");
ALTER TABLE "ShotAssetRequirement" ADD CONSTRAINT "ShotAssetRequirement_project_shot_fkey" FOREIGN KEY ("projectId", "storyboardShotId") REFERENCES "StoryboardShot"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShotAssetRequirement" ADD CONSTRAINT "ShotAssetRequirement_project_version_fkey" FOREIGN KEY ("projectId", "storyboardVersionId") REFERENCES "StoryboardVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssetResolutionManifest" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "requirementsHash" CHAR(64) NOT NULL,
  "candidateSnapshotJson" JSONB NOT NULL,
  "candidateResultHash" CHAR(64) NOT NULL,
  "finalBindingsHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AssetResolutionManifest_storyboardVersionId_key" ON "AssetResolutionManifest"("storyboardVersionId");
CREATE UNIQUE INDEX "AssetResolutionManifest_projectId_id_key" ON "AssetResolutionManifest"("projectId", "id");
CREATE INDEX "AssetResolutionManifest_projectId_createdAt_idx" ON "AssetResolutionManifest"("projectId", "createdAt" DESC);
ALTER TABLE "AssetResolutionManifest" ADD CONSTRAINT "AssetResolutionManifest_project_version_fkey" FOREIGN KEY ("projectId", "storyboardVersionId") REFERENCES "StoryboardVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ShotAssetBinding" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "manifestId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "productionAssetVersionId" UUID NOT NULL,
  "characterStateVersionId" UUID,
  "assetVersionFileId" UUID NOT NULL,
  "projectAssetId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ShotAssetBinding_manifest_requirement_file_key" ON "ShotAssetBinding"("manifestId", "requirementId", "assetVersionFileId");
CREATE UNIQUE INDEX "ShotAssetBinding_projectId_id_key" ON "ShotAssetBinding"("projectId", "id");
CREATE INDEX "ShotAssetBinding_requirementId_idx" ON "ShotAssetBinding"("requirementId");
ALTER TABLE "ShotAssetBinding" ADD CONSTRAINT "ShotAssetBinding_project_manifest_fkey" FOREIGN KEY ("projectId", "manifestId") REFERENCES "AssetResolutionManifest"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShotAssetBinding" ADD CONSTRAINT "ShotAssetBinding_project_requirement_fkey" FOREIGN KEY ("projectId", "requirementId") REFERENCES "ShotAssetRequirement"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShotAssetBinding" ADD CONSTRAINT "ShotAssetBinding_project_version_fkey" FOREIGN KEY ("projectId", "productionAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShotAssetBinding" ADD CONSTRAINT "ShotAssetBinding_project_state_fkey" FOREIGN KEY ("projectId", "characterStateVersionId") REFERENCES "CharacterStateVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShotAssetBinding" ADD CONSTRAINT "ShotAssetBinding_project_file_binding_fkey" FOREIGN KEY ("projectId", "assetVersionFileId") REFERENCES "AssetVersionFile"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShotAssetBinding" ADD CONSTRAINT "ShotAssetBinding_project_asset_fkey" FOREIGN KEY ("projectId", "projectAssetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoryboardDecision" (
  "id" UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "storyboardId" UUID NOT NULL,
  "storyboardVersionId" UUID NOT NULL,
  "manifestId" UUID,
  "decision" "StoryboardDecisionType" NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StoryboardDecision_idempotencyKey_key" ON "StoryboardDecision"("idempotencyKey");
CREATE UNIQUE INDEX "StoryboardDecision_projectId_id_key" ON "StoryboardDecision"("projectId", "id");
CREATE INDEX "StoryboardDecision_storyboardId_createdAt_idx" ON "StoryboardDecision"("storyboardId", "createdAt" DESC);
ALTER TABLE "StoryboardDecision" ADD CONSTRAINT "StoryboardDecision_project_storyboard_fkey" FOREIGN KEY ("projectId", "storyboardId") REFERENCES "Storyboard"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDecision" ADD CONSTRAINT "StoryboardDecision_storyboard_version_fkey" FOREIGN KEY ("storyboardId", "storyboardVersionId") REFERENCES "StoryboardVersion"("storyboardId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoryboardDecision" ADD CONSTRAINT "StoryboardDecision_project_manifest_fkey" FOREIGN KEY ("projectId", "manifestId") REFERENCES "AssetResolutionManifest"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_storyboard_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'storyboard history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StoryboardVersion_immutable" BEFORE UPDATE OR DELETE ON "StoryboardVersion" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
CREATE TRIGGER "StoryboardDirectorRun_immutable" BEFORE UPDATE OR DELETE ON "StoryboardDirectorRun" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
CREATE TRIGGER "StoryboardShot_immutable" BEFORE UPDATE OR DELETE ON "StoryboardShot" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
CREATE TRIGGER "ShotAssetRequirement_immutable" BEFORE UPDATE OR DELETE ON "ShotAssetRequirement" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
CREATE TRIGGER "AssetResolutionManifest_immutable" BEFORE UPDATE OR DELETE ON "AssetResolutionManifest" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
CREATE TRIGGER "ShotAssetBinding_immutable" BEFORE UPDATE OR DELETE ON "ShotAssetBinding" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
CREATE TRIGGER "StoryboardDecision_immutable" BEFORE UPDATE OR DELETE ON "StoryboardDecision" FOR EACH ROW EXECUTE FUNCTION "reject_storyboard_history_mutation"();
