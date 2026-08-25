CREATE UNIQUE INDEX "StoryboardDirectorRun_one_active_per_storyboard"
ON "StoryboardDirectorRun"("storyboardId")
WHERE "status" IN ('QUEUED', 'RUNNING');
