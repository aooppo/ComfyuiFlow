DROP TRIGGER IF EXISTS "StoryboardDirectorRun_immutable" ON "StoryboardDirectorRun";

CREATE OR REPLACE FUNCTION "guard_storyboard_director_run_mutation"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storyboard history is append-only';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."storyboardId" IS DISTINCT FROM OLD."storyboardId"
    OR NEW."providerId" IS DISTINCT FROM OLD."providerId"
    OR NEW."requestedModelId" IS DISTINCT FROM OLD."requestedModelId"
    OR NEW."contractVersion" IS DISTINCT FROM OLD."contractVersion"
    OR NEW."promptTemplateVersion" IS DISTINCT FROM OLD."promptTemplateVersion"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."generatedVersionId" IS DISTINCT FROM OLD."generatedVersionId"
    OR NEW."maxShotCount" IS DISTINCT FROM OLD."maxShotCount"
    OR NEW."headVersionId" IS DISTINCT FROM OLD."headVersionId"
    OR NEW."headContentHash" IS DISTINCT FROM OLD."headContentHash"
    OR NEW."scopeHash" IS DISTINCT FROM OLD."scopeHash"
    OR NEW."priceSnapshotHash" IS DISTINCT FROM OLD."priceSnapshotHash"
    OR NEW."billingChannel" IS DISTINCT FROM OLD."billingChannel"
    OR NEW."maxCostUsd" IS DISTINCT FROM OLD."maxCostUsd"
    OR NEW."priceEffectiveAt" IS DISTINCT FROM OLD."priceEffectiveAt"
    OR NEW."priceExpiresAt" IS DISTINCT FROM OLD."priceExpiresAt"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'storyboard director run scope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StoryboardDirectorRun_guarded"
BEFORE UPDATE OR DELETE ON "StoryboardDirectorRun"
FOR EACH ROW EXECUTE FUNCTION "guard_storyboard_director_run_mutation"();
