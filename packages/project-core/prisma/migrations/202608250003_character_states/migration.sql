CREATE TYPE "CharacterStateComponentSlot" AS ENUM ('OUTFIT','HAIR','MAKEUP','ACCESSORY');
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CHARACTER_STATE_PUBLISHED';

CREATE TABLE "CharacterProfile" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "productionAssetId" UUID NOT NULL,
  "canonicalName" VARCHAR(120) NOT NULL, "identityNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterProfile_productionAssetId_key" ON "CharacterProfile"("productionAssetId");
CREATE UNIQUE INDEX "CharacterProfile_projectId_id_key" ON "CharacterProfile"("projectId","id");
CREATE INDEX "CharacterProfile_projectId_canonicalName_idx" ON "CharacterProfile"("projectId","canonicalName");
ALTER TABLE "CharacterProfile" ADD CONSTRAINT "CharacterProfile_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterProfile" ADD CONSTRAINT "CharacterProfile_asset_fkey" FOREIGN KEY ("productionAssetId") REFERENCES "ProductionAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CharacterVersion" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "characterProfileId" UUID NOT NULL,
  "productionAssetVersionId" UUID NOT NULL, "versionNumber" INTEGER NOT NULL,
  "status" "ProductionAssetVersionStatus" NOT NULL DEFAULT 'DRAFT', "identityFactsJson" JSONB,
  "basedOnVersionId" UUID, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CharacterVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterVersion_profile_version_key" ON "CharacterVersion"("characterProfileId","versionNumber");
CREATE UNIQUE INDEX "CharacterVersion_projectId_id_key" ON "CharacterVersion"("projectId","id");
CREATE UNIQUE INDEX "CharacterVersion_single_active" ON "CharacterVersion"("characterProfileId") WHERE "status" = 'ACTIVE';
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_profile_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_asset_version_fkey" FOREIGN KEY ("productionAssetVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_basedOn_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "CharacterVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CharacterStateVersion" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "characterVersionId" UUID NOT NULL,
  "stateKey" VARCHAR(80) NOT NULL, "versionNumber" INTEGER NOT NULL, "name" VARCHAR(120) NOT NULL,
  "status" "ProductionAssetVersionStatus" NOT NULL DEFAULT 'DRAFT', "description" TEXT,
  "basedOnStateVersionId" UUID, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CharacterStateVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterStateVersion_series_version_key" ON "CharacterStateVersion"("characterVersionId","stateKey","versionNumber");
CREATE UNIQUE INDEX "CharacterStateVersion_projectId_id_key" ON "CharacterStateVersion"("projectId","id");
CREATE UNIQUE INDEX "CharacterStateVersion_single_active" ON "CharacterStateVersion"("characterVersionId","stateKey") WHERE "status" = 'ACTIVE';
ALTER TABLE "CharacterStateVersion" ADD CONSTRAINT "CharacterStateVersion_character_fkey" FOREIGN KEY ("characterVersionId") REFERENCES "CharacterVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterStateVersion" ADD CONSTRAINT "CharacterStateVersion_basedOn_fkey" FOREIGN KEY ("basedOnStateVersionId") REFERENCES "CharacterStateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CharacterStateComponent" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "characterStateVersionId" UUID NOT NULL,
  "slotType" "CharacterStateComponentSlot" NOT NULL, "componentAssetVersionId" UUID NOT NULL,
  "slotKey" VARCHAR(80) NOT NULL DEFAULT '', "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterStateComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterStateComponent_slot_key" ON "CharacterStateComponent"("characterStateVersionId","slotType","slotKey");
CREATE INDEX "CharacterStateComponent_project_slot_idx" ON "CharacterStateComponent"("projectId","slotType");
ALTER TABLE "CharacterStateComponent" ADD CONSTRAINT "CharacterStateComponent_state_fkey" FOREIGN KEY ("characterStateVersionId") REFERENCES "CharacterStateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CharacterStateComponent" ADD CONSTRAINT "CharacterStateComponent_asset_version_fkey" FOREIGN KEY ("componentAssetVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
