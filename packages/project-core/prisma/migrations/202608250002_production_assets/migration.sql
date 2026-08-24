CREATE TYPE "ProductionAssetType" AS ENUM ('CHARACTER','OUTFIT','PROP','SCENE','VOICE','LORA','HAIR','MAKEUP','ACCESSORY','OTHER');
CREATE TYPE "ProductionAssetStatus" AS ENUM ('ACTIVE','INACTIVE','ARCHIVED');
CREATE TYPE "ProductionAssetVersionStatus" AS ENUM ('DRAFT','ACTIVE','RETIRED');
CREATE TYPE "ReferenceUsage" AS ENUM ('IDENTITY','FACE','FULL_BODY','OUTFIT_DETAIL','PROP_DETAIL','SCENE_STYLE','POSE','CONTROL','TRAINING_SOURCE');
CREATE TYPE "Viewpoint" AS ENUM ('FRONT','FRONT_THREE_QUARTER','SIDE','REAR_THREE_QUARTER','REAR','TOP','LOW','DETAIL','UNSPECIFIED');
CREATE TYPE "ShotScale" AS ENUM ('EXTREME_CLOSE_UP','CLOSE_UP','MEDIUM_CLOSE_UP','MEDIUM','MEDIUM_FULL','FULL','WIDE','EXTREME_WIDE','UNSPECIFIED');
CREATE TYPE "BindingApprovalStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED');
CREATE TYPE "BindingSourceType" AS ENUM ('OWNER','MIGRATION','UNDERSTANDING_REVISION');
CREATE TYPE "BindingStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "AssetRelationType" AS ENUM ('DEFAULT_VOICE','IDENTITY_LORA','REQUIRES','COMPATIBLE_WITH','PART_OF','DERIVED_FROM');
CREATE TYPE "RelationStatus" AS ENUM ('ACTIVE','INACTIVE');
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCTION_ASSET_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PRODUCTION_ASSET_PUBLISHED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'ASSET_VERSION_FILE_BOUND';

CREATE TABLE "ProductionAsset" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "type" "ProductionAssetType" NOT NULL,
  "name" VARCHAR(120) NOT NULL, "normalizedName" VARCHAR(120) NOT NULL, "slug" VARCHAR(120),
  "status" "ProductionAssetStatus" NOT NULL DEFAULT 'ACTIVE', "currentVersionId" UUID,
  "rowVersion" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ProductionAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionAsset_projectId_type_normalizedName_key" ON "ProductionAsset"("projectId","type","normalizedName");
CREATE UNIQUE INDEX "ProductionAsset_projectId_id_key" ON "ProductionAsset"("projectId","id");
CREATE INDEX "ProductionAsset_projectId_type_status_name_idx" ON "ProductionAsset"("projectId","type","status","name");
ALTER TABLE "ProductionAsset" ADD CONSTRAINT "ProductionAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionAssetVersion" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "productionAssetId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL, "basedOnVersionId" UUID, "status" "ProductionAssetVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "displayName" VARCHAR(120) NOT NULL, "description" TEXT, "factsJson" JSONB,
  "sourceType" "BindingSourceType" NOT NULL DEFAULT 'OWNER', "sourceRevisionId" UUID,
  "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ProductionAssetVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionAssetVersion_productionAssetId_versionNumber_key" ON "ProductionAssetVersion"("productionAssetId","versionNumber");
CREATE UNIQUE INDEX "ProductionAssetVersion_projectId_id_key" ON "ProductionAssetVersion"("projectId","id");
CREATE INDEX "ProductionAssetVersion_projectId_status_idx" ON "ProductionAssetVersion"("projectId","status");
CREATE UNIQUE INDEX "ProductionAssetVersion_single_active" ON "ProductionAssetVersion"("productionAssetId") WHERE "status" = 'ACTIVE';
ALTER TABLE "ProductionAssetVersion" ADD CONSTRAINT "ProductionAssetVersion_asset_fkey" FOREIGN KEY ("productionAssetId") REFERENCES "ProductionAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAssetVersion" ADD CONSTRAINT "ProductionAssetVersion_basedOn_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAsset" ADD CONSTRAINT "ProductionAsset_currentVersion_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssetVersionFile" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "productionAssetVersionId" UUID NOT NULL, "projectAssetId" UUID NOT NULL,
  "referenceUsage" "ReferenceUsage" NOT NULL, "viewpoint" "Viewpoint" NOT NULL DEFAULT 'UNSPECIFIED',
  "shotScale" "ShotScale" NOT NULL DEFAULT 'UNSPECIFIED', "regionJson" JSONB, "qualityFactsJson" JSONB,
  "approvalStatus" "BindingApprovalStatus" NOT NULL DEFAULT 'PENDING', "isPreferred" BOOLEAN NOT NULL DEFAULT false,
  "sourceType" "BindingSourceType" NOT NULL DEFAULT 'OWNER', "sourceRevisionId" UUID,
  "status" "BindingStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AssetVersionFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetVersionFile_equivalent_key" ON "AssetVersionFile"("productionAssetVersionId","projectAssetId","referenceUsage","viewpoint","shotScale");
CREATE UNIQUE INDEX "AssetVersionFile_projectId_id_key" ON "AssetVersionFile"("projectId","id");
CREATE INDEX "AssetVersionFile_candidate_idx" ON "AssetVersionFile"("projectId","referenceUsage","status","approvalStatus");
ALTER TABLE "AssetVersionFile" ADD CONSTRAINT "AssetVersionFile_version_fkey" FOREIGN KEY ("productionAssetVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetVersionFile" ADD CONSTRAINT "AssetVersionFile_asset_fkey" FOREIGN KEY ("projectAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionAssetRelation" (
  "id" UUID NOT NULL, "projectId" UUID NOT NULL, "fromAssetVersionId" UUID NOT NULL, "toAssetVersionId" UUID NOT NULL,
  "relationType" "AssetRelationType" NOT NULL, "status" "RelationStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceType" "BindingSourceType" NOT NULL DEFAULT 'OWNER', "sourceRevisionId" UUID,
  "validFrom" TIMESTAMP(3), "validTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionAssetRelation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionAssetRelation_equivalent_key" ON "ProductionAssetRelation"("fromAssetVersionId","toAssetVersionId","relationType");
CREATE INDEX "ProductionAssetRelation_projectId_status_idx" ON "ProductionAssetRelation"("projectId","status");
ALTER TABLE "ProductionAssetRelation" ADD CONSTRAINT "ProductionAssetRelation_from_fkey" FOREIGN KEY ("fromAssetVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAssetRelation" ADD CONSTRAINT "ProductionAssetRelation_to_fkey" FOREIGN KEY ("toAssetVersionId") REFERENCES "ProductionAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
