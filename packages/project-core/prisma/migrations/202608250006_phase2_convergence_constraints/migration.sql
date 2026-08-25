-- Phase 2 convergence: project identity must be enforced by PostgreSQL, not only service checks.
CREATE UNIQUE INDEX "AssetImportBatch_projectId_id_key" ON "AssetImportBatch"("projectId", "id");
CREATE UNIQUE INDEX "ProductionAssetRelation_projectId_id_key" ON "ProductionAssetRelation"("projectId", "id");
CREATE UNIQUE INDEX "CharacterStateComponent_projectId_id_key" ON "CharacterStateComponent"("projectId", "id");
CREATE UNIQUE INDEX "AssetUnderstandingManifest_projectId_id_key" ON "AssetUnderstandingManifest"("projectId", "id");
CREATE UNIQUE INDEX "AssetUnderstandingRun_projectId_id_key" ON "AssetUnderstandingRun"("projectId", "id");

ALTER TABLE "AssetImportAttempt" ADD CONSTRAINT "AssetImportAttempt_project_batch_fkey"
  FOREIGN KEY ("projectId", "batchId") REFERENCES "AssetImportBatch"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetImportAttempt" ADD CONSTRAINT "AssetImportAttempt_project_asset_composite_fkey"
  FOREIGN KEY ("projectId", "assetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_project_asset_composite_fkey"
  FOREIGN KEY ("projectId", "assetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionAssetVersion" ADD CONSTRAINT "ProductionAssetVersion_project_asset_composite_fkey"
  FOREIGN KEY ("projectId", "productionAssetId") REFERENCES "ProductionAsset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAssetVersion" ADD CONSTRAINT "ProductionAssetVersion_project_parent_fkey"
  FOREIGN KEY ("projectId", "basedOnVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetVersionFile" ADD CONSTRAINT "AssetVersionFile_project_version_composite_fkey"
  FOREIGN KEY ("projectId", "productionAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetVersionFile" ADD CONSTRAINT "AssetVersionFile_project_asset_composite_fkey"
  FOREIGN KEY ("projectId", "projectAssetId") REFERENCES "Asset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAssetRelation" ADD CONSTRAINT "ProductionAssetRelation_project_from_fkey"
  FOREIGN KEY ("projectId", "fromAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAssetRelation" ADD CONSTRAINT "ProductionAssetRelation_project_to_fkey"
  FOREIGN KEY ("projectId", "toAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CharacterProfile" ADD CONSTRAINT "CharacterProfile_project_asset_composite_fkey"
  FOREIGN KEY ("projectId", "productionAssetId") REFERENCES "ProductionAsset"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_project_profile_fkey"
  FOREIGN KEY ("projectId", "characterProfileId") REFERENCES "CharacterProfile"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_project_asset_version_fkey"
  FOREIGN KEY ("projectId", "productionAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_project_parent_fkey"
  FOREIGN KEY ("projectId", "basedOnVersionId") REFERENCES "CharacterVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterStateVersion" ADD CONSTRAINT "CharacterStateVersion_project_character_fkey"
  FOREIGN KEY ("projectId", "characterVersionId") REFERENCES "CharacterVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterStateVersion" ADD CONSTRAINT "CharacterStateVersion_project_parent_fkey"
  FOREIGN KEY ("projectId", "basedOnStateVersionId") REFERENCES "CharacterStateVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterStateComponent" ADD CONSTRAINT "CharacterStateComponent_project_state_fkey"
  FOREIGN KEY ("projectId", "characterStateVersionId") REFERENCES "CharacterStateVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterStateComponent" ADD CONSTRAINT "CharacterStateComponent_project_asset_version_fkey"
  FOREIGN KEY ("projectId", "componentAssetVersionId") REFERENCES "ProductionAssetVersion"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetUnderstandingRun" ADD CONSTRAINT "AssetUnderstandingRun_project_manifest_fkey"
  FOREIGN KEY ("projectId", "manifestId") REFERENCES "AssetUnderstandingManifest"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "protect_phase2_published_version"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'published Phase 2 versions are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" <> 'DRAFT' AND
     (to_jsonb(NEW) - 'status' - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updatedAt') THEN
    RAISE EXCEPTION 'published Phase 2 versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductionAssetVersion_published_immutable" BEFORE UPDATE OR DELETE ON "ProductionAssetVersion" FOR EACH ROW EXECUTE FUNCTION "protect_phase2_published_version"();
CREATE TRIGGER "CharacterVersion_published_immutable" BEFORE UPDATE OR DELETE ON "CharacterVersion" FOR EACH ROW EXECUTE FUNCTION "protect_phase2_published_version"();
CREATE TRIGGER "CharacterStateVersion_published_immutable" BEFORE UPDATE OR DELETE ON "CharacterStateVersion" FOR EACH ROW EXECUTE FUNCTION "protect_phase2_published_version"();
