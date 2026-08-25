CREATE TYPE "StoryboardStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Storyboard"
  ADD COLUMN "status" "StoryboardStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Storyboard_projectId_status_updatedAt_idx"
  ON "Storyboard"("projectId", "status", "updatedAt" DESC);
