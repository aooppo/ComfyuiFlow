-- CreateEnum
CREATE TYPE "ContinuitySubjectKind" AS ENUM ('ENVIRONMENT', 'CHARACTER', 'PRODUCT', 'PROP', 'CAMERA', 'VISUAL_STYLE');

-- CreateEnum
CREATE TYPE "ContinuityPolicy" AS ENUM ('WHOLE_FILM_HOLD', 'SHOT_CHANGE', 'UNIMPORTANT');

-- CreateEnum
CREATE TYPE "ContinuityImportance" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "ContinuityDecisionType" AS ENUM ('APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "KeyframePlanStatus" AS ENUM ('PLANNED', 'RUNNING', 'PAUSED', 'AWAITING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KeyframeAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "KeyframeDecisionType" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VideoControlTier" AS ENUM ('ORDINARY_REFERENCE', 'LOCKED_START', 'LOCKED_START_END');

-- AlterTable
ALTER TABLE "GenerationBatch" ADD COLUMN     "continuityProfileVersionId" UUID,
ADD COLUMN     "continuityScopeHash" CHAR(64),
ADD COLUMN     "keyframePlanVersionId" UUID,
ADD COLUMN     "videoControlTier" "VideoControlTier";

-- AlterTable
ALTER TABLE "GenerationBatchTarget" ADD COLUMN     "endBoundaryHash" CHAR(64),
ADD COLUMN     "endKeyframeHash" CHAR(64),
ADD COLUMN     "endKeyframeSoftTarget" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startBoundaryHash" CHAR(64),
ADD COLUMN     "startKeyframeHash" CHAR(64);

-- CreateTable
CREATE TABLE "ContinuityProfile" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyboardId" UUID NOT NULL,
    "headVersionId" UUID,
    "approvedVersionId" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityProfileVersion" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "continuityProfileId" UUID NOT NULL,
    "storyboardVersionId" UUID NOT NULL,
    "manifestId" UUID NOT NULL,
    "parentVersionId" UUID,
    "versionNumber" INTEGER NOT NULL,
    "registryVersion" VARCHAR(80) NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "outputHash" CHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuityProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuitySubject" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "continuityProfileVersionId" UUID NOT NULL,
    "subjectKey" VARCHAR(160) NOT NULL,
    "kind" "ContinuitySubjectKind" NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "productionAssetVersionId" UUID,
    "assetVersionFileId" UUID,
    "sourceSha256" CHAR(64),
    "factsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuitySubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityRule" (
    "id" UUID NOT NULL,
    "continuitySubjectId" UUID NOT NULL,
    "propertyKey" VARCHAR(120) NOT NULL,
    "policy" "ContinuityPolicy" NOT NULL,
    "importance" "ContinuityImportance" NOT NULL,
    "expectedValueJson" JSONB NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShotBoundary" (
    "id" UUID NOT NULL,
    "continuityProfileVersionId" UUID NOT NULL,
    "boundaryIndex" INTEGER NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "stateJson" JSONB NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShotBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShotContinuityState" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "continuityProfileVersionId" UUID NOT NULL,
    "storyboardShotId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "startBoundaryId" UUID NOT NULL,
    "endBoundaryId" UUID NOT NULL,
    "declaredChangesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShotContinuityState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityDecision" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "continuityProfileId" UUID NOT NULL,
    "continuityProfileVersionId" UUID NOT NULL,
    "decision" "ContinuityDecisionType" NOT NULL,
    "preflightHash" CHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuityDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyframePlanVersion" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "continuityProfileVersionId" UUID NOT NULL,
    "providerProfileId" VARCHAR(80) NOT NULL,
    "providerId" VARCHAR(80) NOT NULL,
    "modelId" VARCHAR(160) NOT NULL,
    "modelSnapshot" VARCHAR(160) NOT NULL,
    "capabilitiesJson" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "quality" VARCHAR(40) NOT NULL,
    "priceFactsJson" JSONB NOT NULL,
    "priceAsOf" TIMESTAMP(3),
    "priceExpiresAt" TIMESTAMP(3),
    "maximumCalls" INTEGER NOT NULL,
    "planHash" CHAR(64) NOT NULL,
    "status" "KeyframePlanStatus" NOT NULL DEFAULT 'PLANNED',
    "rowVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyframePlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyframeTarget" (
    "id" UUID NOT NULL,
    "keyframePlanVersionId" UUID NOT NULL,
    "shotBoundaryId" UUID NOT NULL,
    "boundaryIndex" INTEGER NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "referencesJson" JSONB NOT NULL,
    "referencesHash" CHAR(64) NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptHash" CHAR(64) NOT NULL,
    "targetHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyframeTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyframeAuthorization" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "keyframePlanVersionId" UUID NOT NULL,
    "planHash" CHAR(64) NOT NULL,
    "maximumCalls" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyframeAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyframeAttempt" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "keyframeAuthorizationId" UUID NOT NULL,
    "keyframeTargetId" UUID NOT NULL,
    "providerId" VARCHAR(80) NOT NULL,
    "modelSnapshot" VARCHAR(160) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "status" "KeyframeAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "safeResultCode" VARCHAR(80) NOT NULL,
    "providerCallCount" INTEGER NOT NULL DEFAULT 0,
    "usageJson" JSONB,
    "costFactsJson" JSONB,
    "responseId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "KeyframeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyframeArtifact" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "keyframeAttemptId" UUID NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "detectedMimeType" VARCHAR(120) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "retainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyframeArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyframeDecision" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "keyframeArtifactId" UUID NOT NULL,
    "decision" "KeyframeDecisionType" NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyframeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationPlanDraft" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "generationPlanId" UUID NOT NULL,
    "generationPlanVersionId" UUID NOT NULL,
    "sourceSetHash" CHAR(64) NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "warningsHash" CHAR(64) NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "detectedMimeType" VARCHAR(120) NOT NULL,
    "container" VARCHAR(80) NOT NULL,
    "videoCodec" VARCHAR(80) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fps" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "assemblerVersion" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationPlanDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationPlanDraftSource" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "generationPlanDraftId" UUID NOT NULL,
    "generationSpecId" UUID NOT NULL,
    "generatedArtifactId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceSha256" CHAR(64) NOT NULL,
    "sourceByteSize" BIGINT NOT NULL,
    "sourceMimeType" VARCHAR(120) NOT NULL,
    "humanQaState" VARCHAR(40) NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationPlanDraftSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfile_storyboardId_key" ON "ContinuityProfile"("storyboardId");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfile_headVersionId_key" ON "ContinuityProfile"("headVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfile_approvedVersionId_key" ON "ContinuityProfile"("approvedVersionId");

-- CreateIndex
CREATE INDEX "ContinuityProfile_projectId_updatedAt_idx" ON "ContinuityProfile"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfile_projectId_id_key" ON "ContinuityProfile"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfileVersion_idempotencyKey_key" ON "ContinuityProfileVersion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ContinuityProfileVersion_storyboardVersionId_createdAt_idx" ON "ContinuityProfileVersion"("storyboardVersionId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfileVersion_continuityProfileId_versionNumber_key" ON "ContinuityProfileVersion"("continuityProfileId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityProfileVersion_projectId_id_key" ON "ContinuityProfileVersion"("projectId", "id");

-- CreateIndex
CREATE INDEX "ContinuitySubject_continuityProfileVersionId_kind_idx" ON "ContinuitySubject"("continuityProfileVersionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuitySubject_continuityProfileVersionId_subjectKey_key" ON "ContinuitySubject"("continuityProfileVersionId", "subjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuitySubject_projectId_id_key" ON "ContinuitySubject"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityRule_continuitySubjectId_propertyKey_key" ON "ContinuityRule"("continuitySubjectId", "propertyKey");

-- CreateIndex
CREATE INDEX "ShotBoundary_continuityProfileVersionId_boundaryIndex_idx" ON "ShotBoundary"("continuityProfileVersionId", "boundaryIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ShotBoundary_continuityProfileVersionId_boundaryIndex_key" ON "ShotBoundary"("continuityProfileVersionId", "boundaryIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ShotBoundary_continuityProfileVersionId_id_key" ON "ShotBoundary"("continuityProfileVersionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShotContinuityState_continuityProfileVersionId_storyboardSh_key" ON "ShotContinuityState"("continuityProfileVersionId", "storyboardShotId");

-- CreateIndex
CREATE UNIQUE INDEX "ShotContinuityState_continuityProfileVersionId_ordinal_key" ON "ShotContinuityState"("continuityProfileVersionId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ShotContinuityState_projectId_id_key" ON "ShotContinuityState"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityDecision_idempotencyKey_key" ON "ContinuityDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ContinuityDecision_continuityProfileId_createdAt_idx" ON "ContinuityDecision"("continuityProfileId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityDecision_projectId_id_key" ON "ContinuityDecision"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframePlanVersion_planHash_key" ON "KeyframePlanVersion"("planHash");

-- CreateIndex
CREATE INDEX "KeyframePlanVersion_continuityProfileVersionId_createdAt_idx" ON "KeyframePlanVersion"("continuityProfileVersionId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KeyframePlanVersion_projectId_id_key" ON "KeyframePlanVersion"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeTarget_keyframePlanVersionId_boundaryIndex_key" ON "KeyframeTarget"("keyframePlanVersionId", "boundaryIndex");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeTarget_keyframePlanVersionId_shotBoundaryId_key" ON "KeyframeTarget"("keyframePlanVersionId", "shotBoundaryId");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeTarget_keyframePlanVersionId_targetHash_key" ON "KeyframeTarget"("keyframePlanVersionId", "targetHash");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeAuthorization_keyframePlanVersionId_key" ON "KeyframeAuthorization"("keyframePlanVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeAuthorization_idempotencyKey_key" ON "KeyframeAuthorization"("idempotencyKey");

-- CreateIndex
CREATE INDEX "KeyframeAuthorization_projectId_expiresAt_idx" ON "KeyframeAuthorization"("projectId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeAuthorization_projectId_id_key" ON "KeyframeAuthorization"("projectId", "id");

-- CreateIndex
CREATE INDEX "KeyframeAttempt_keyframeAuthorizationId_createdAt_idx" ON "KeyframeAttempt"("keyframeAuthorizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeAttempt_keyframeAuthorizationId_keyframeTargetId_key" ON "KeyframeAttempt"("keyframeAuthorizationId", "keyframeTargetId");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeAttempt_projectId_id_key" ON "KeyframeAttempt"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeArtifact_keyframeAttemptId_key" ON "KeyframeArtifact"("keyframeAttemptId");

-- CreateIndex
CREATE INDEX "KeyframeArtifact_storageKey_idx" ON "KeyframeArtifact"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeArtifact_projectId_id_key" ON "KeyframeArtifact"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeDecision_idempotencyKey_key" ON "KeyframeDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "KeyframeDecision_keyframeArtifactId_createdAt_idx" ON "KeyframeDecision"("keyframeArtifactId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KeyframeDecision_projectId_id_key" ON "KeyframeDecision"("projectId", "id");

-- CreateIndex
CREATE INDEX "GenerationPlanDraft_generationPlanId_createdAt_idx" ON "GenerationPlanDraft"("generationPlanId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPlanDraft_generationPlanVersionId_sourceSetHash_w_key" ON "GenerationPlanDraft"("generationPlanVersionId", "sourceSetHash", "warningsHash");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPlanDraft_projectId_id_key" ON "GenerationPlanDraft"("projectId", "id");

-- CreateIndex
CREATE INDEX "GenerationPlanDraftSource_generatedArtifactId_idx" ON "GenerationPlanDraftSource"("generatedArtifactId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPlanDraftSource_generationPlanDraftId_ordinal_key" ON "GenerationPlanDraftSource"("generationPlanDraftId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPlanDraftSource_generationPlanDraftId_generationS_key" ON "GenerationPlanDraftSource"("generationPlanDraftId", "generationSpecId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPlanDraftSource_projectId_id_key" ON "GenerationPlanDraftSource"("projectId", "id");

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_continuityProfileVersionId_fkey" FOREIGN KEY ("continuityProfileVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_keyframePlanVersionId_fkey" FOREIGN KEY ("keyframePlanVersionId") REFERENCES "KeyframePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfile" ADD CONSTRAINT "ContinuityProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfile" ADD CONSTRAINT "ContinuityProfile_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfile" ADD CONSTRAINT "ContinuityProfile_headVersionId_fkey" FOREIGN KEY ("headVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfile" ADD CONSTRAINT "ContinuityProfile_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfileVersion" ADD CONSTRAINT "ContinuityProfileVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfileVersion" ADD CONSTRAINT "ContinuityProfileVersion_continuityProfileId_fkey" FOREIGN KEY ("continuityProfileId") REFERENCES "ContinuityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfileVersion" ADD CONSTRAINT "ContinuityProfileVersion_storyboardVersionId_fkey" FOREIGN KEY ("storyboardVersionId") REFERENCES "StoryboardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfileVersion" ADD CONSTRAINT "ContinuityProfileVersion_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "AssetResolutionManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityProfileVersion" ADD CONSTRAINT "ContinuityProfileVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuitySubject" ADD CONSTRAINT "ContinuitySubject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuitySubject" ADD CONSTRAINT "ContinuitySubject_continuityProfileVersionId_fkey" FOREIGN KEY ("continuityProfileVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityRule" ADD CONSTRAINT "ContinuityRule_continuitySubjectId_fkey" FOREIGN KEY ("continuitySubjectId") REFERENCES "ContinuitySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotBoundary" ADD CONSTRAINT "ShotBoundary_continuityProfileVersionId_fkey" FOREIGN KEY ("continuityProfileVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotContinuityState" ADD CONSTRAINT "ShotContinuityState_continuityProfileVersionId_fkey" FOREIGN KEY ("continuityProfileVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotContinuityState" ADD CONSTRAINT "ShotContinuityState_storyboardShotId_fkey" FOREIGN KEY ("storyboardShotId") REFERENCES "StoryboardShot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotContinuityState" ADD CONSTRAINT "ShotContinuityState_startBoundaryId_fkey" FOREIGN KEY ("startBoundaryId") REFERENCES "ShotBoundary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotContinuityState" ADD CONSTRAINT "ShotContinuityState_endBoundaryId_fkey" FOREIGN KEY ("endBoundaryId") REFERENCES "ShotBoundary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityDecision" ADD CONSTRAINT "ContinuityDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityDecision" ADD CONSTRAINT "ContinuityDecision_continuityProfileId_fkey" FOREIGN KEY ("continuityProfileId") REFERENCES "ContinuityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityDecision" ADD CONSTRAINT "ContinuityDecision_continuityProfileVersionId_fkey" FOREIGN KEY ("continuityProfileVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframePlanVersion" ADD CONSTRAINT "KeyframePlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframePlanVersion" ADD CONSTRAINT "KeyframePlanVersion_continuityProfileVersionId_fkey" FOREIGN KEY ("continuityProfileVersionId") REFERENCES "ContinuityProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeTarget" ADD CONSTRAINT "KeyframeTarget_keyframePlanVersionId_fkey" FOREIGN KEY ("keyframePlanVersionId") REFERENCES "KeyframePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeTarget" ADD CONSTRAINT "KeyframeTarget_shotBoundaryId_fkey" FOREIGN KEY ("shotBoundaryId") REFERENCES "ShotBoundary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeAuthorization" ADD CONSTRAINT "KeyframeAuthorization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeAuthorization" ADD CONSTRAINT "KeyframeAuthorization_keyframePlanVersionId_fkey" FOREIGN KEY ("keyframePlanVersionId") REFERENCES "KeyframePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeAttempt" ADD CONSTRAINT "KeyframeAttempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeAttempt" ADD CONSTRAINT "KeyframeAttempt_keyframeAuthorizationId_fkey" FOREIGN KEY ("keyframeAuthorizationId") REFERENCES "KeyframeAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeAttempt" ADD CONSTRAINT "KeyframeAttempt_keyframeTargetId_fkey" FOREIGN KEY ("keyframeTargetId") REFERENCES "KeyframeTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeArtifact" ADD CONSTRAINT "KeyframeArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeArtifact" ADD CONSTRAINT "KeyframeArtifact_keyframeAttemptId_fkey" FOREIGN KEY ("keyframeAttemptId") REFERENCES "KeyframeAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeDecision" ADD CONSTRAINT "KeyframeDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyframeDecision" ADD CONSTRAINT "KeyframeDecision_keyframeArtifactId_fkey" FOREIGN KEY ("keyframeArtifactId") REFERENCES "KeyframeArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraft" ADD CONSTRAINT "GenerationPlanDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraft" ADD CONSTRAINT "GenerationPlanDraft_generationPlanId_fkey" FOREIGN KEY ("generationPlanId") REFERENCES "GenerationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraft" ADD CONSTRAINT "GenerationPlanDraft_generationPlanVersionId_fkey" FOREIGN KEY ("generationPlanVersionId") REFERENCES "GenerationPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraftSource" ADD CONSTRAINT "GenerationPlanDraftSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraftSource" ADD CONSTRAINT "GenerationPlanDraftSource_generationPlanDraftId_fkey" FOREIGN KEY ("generationPlanDraftId") REFERENCES "GenerationPlanDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraftSource" ADD CONSTRAINT "GenerationPlanDraftSource_generationSpecId_fkey" FOREIGN KEY ("generationSpecId") REFERENCES "GenerationSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPlanDraftSource" ADD CONSTRAINT "GenerationPlanDraftSource_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
