CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TargetAspectRatio" AS ENUM ('PORTRAIT_9_16', 'LANDSCAPE_16_9', 'SQUARE_1_1', 'PORTRAIT_4_5');
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED');
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');
CREATE TYPE "AssetRole" AS ENUM ('SCENE', 'PRODUCT', 'CHARACTER_FULL_BODY', 'CHARACTER_FACE', 'CHARACTER_REAR_SIDE', 'PROP', 'AUDIO', 'OTHER');
CREATE TYPE "AssetStatus" AS ENUM ('READY', 'REMOVED');
CREATE TYPE "ImportOutcome" AS ENUM ('IMPORTED', 'DUPLICATE', 'REJECTED', 'FAILED');
CREATE TYPE "ActivityType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'PROJECT_RESTORED', 'ASSET_IMPORTED', 'ASSET_UPDATED', 'ASSET_REMOVED');

CREATE TABLE "Project" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "brief" TEXT,
  "targetAspectRatio" "TargetAspectRatio" NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoredObject" (
  "id" UUID NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "detectedMimeType" VARCHAR(120) NOT NULL,
  "storageKey" VARCHAR(255) NOT NULL,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Asset" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "storedObjectId" UUID NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "mediaType" "MediaType" NOT NULL,
  "role" "AssetRole" NOT NULL,
  "notes" TEXT,
  "status" "AssetStatus" NOT NULL DEFAULT 'READY',
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "inspectionWarning" VARCHAR(120),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetImportAttempt" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "submittedFilename" VARCHAR(255) NOT NULL,
  "submittedByteSize" BIGINT,
  "detectedMimeType" VARCHAR(120),
  "sha256" CHAR(64),
  "requestedRole" "AssetRole" NOT NULL,
  "outcome" "ImportOutcome" NOT NULL,
  "resultCode" VARCHAR(80) NOT NULL,
  "assetId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetImportAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectActivity" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "assetId" UUID,
  "type" "ActivityType" NOT NULL,
  "summary" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt" DESC);
CREATE UNIQUE INDEX "StoredObject_sha256_key" ON "StoredObject"("sha256");
CREATE UNIQUE INDEX "StoredObject_storageKey_key" ON "StoredObject"("storageKey");
CREATE UNIQUE INDEX "Asset_projectId_storedObjectId_key" ON "Asset"("projectId", "storedObjectId");
CREATE INDEX "Asset_projectId_status_createdAt_idx" ON "Asset"("projectId", "status", "createdAt" DESC);
CREATE INDEX "Asset_projectId_status_mediaType_idx" ON "Asset"("projectId", "status", "mediaType");
CREATE INDEX "Asset_projectId_status_role_idx" ON "Asset"("projectId", "status", "role");
CREATE INDEX "AssetImportAttempt_projectId_createdAt_idx" ON "AssetImportAttempt"("projectId", "createdAt" DESC);
CREATE INDEX "ProjectActivity_projectId_createdAt_idx" ON "ProjectActivity"("projectId", "createdAt" DESC);
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetImportAttempt" ADD CONSTRAINT "AssetImportAttempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetImportAttempt" ADD CONSTRAINT "AssetImportAttempt_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
