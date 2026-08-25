-- Phase 13 immutable evidence guards. Mutable aggregate heads and bounded state machines are
-- intentionally excluded or receive field-level guards below.
CREATE OR REPLACE FUNCTION "reject_continuity_history_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'continuity and draft history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ContinuityProfileVersion_immutable" BEFORE UPDATE OR DELETE ON "ContinuityProfileVersion" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ContinuitySubject_immutable" BEFORE UPDATE OR DELETE ON "ContinuitySubject" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ContinuityRule_immutable" BEFORE UPDATE OR DELETE ON "ContinuityRule" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ShotBoundary_immutable" BEFORE UPDATE OR DELETE ON "ShotBoundary" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ShotContinuityState_immutable" BEFORE UPDATE OR DELETE ON "ShotContinuityState" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ContinuityDecision_immutable" BEFORE UPDATE OR DELETE ON "ContinuityDecision" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "KeyframeTarget_immutable" BEFORE UPDATE OR DELETE ON "KeyframeTarget" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "KeyframeAuthorization_immutable" BEFORE UPDATE OR DELETE ON "KeyframeAuthorization" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "KeyframeArtifact_immutable" BEFORE UPDATE OR DELETE ON "KeyframeArtifact" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "KeyframeDecision_immutable" BEFORE UPDATE OR DELETE ON "KeyframeDecision" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "GenerationPlanDraft_immutable" BEFORE UPDATE OR DELETE ON "GenerationPlanDraft" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "GenerationPlanDraftSource_immutable" BEFORE UPDATE OR DELETE ON "GenerationPlanDraftSource" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();

CREATE OR REPLACE FUNCTION "protect_keyframe_plan_identity"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'keyframe plan history is append-only';
  END IF;
  IF ROW(OLD."id", OLD."projectId", OLD."continuityProfileVersionId", OLD."providerProfileId", OLD."providerId", OLD."modelId", OLD."modelSnapshot", OLD."capabilitiesJson", OLD."width", OLD."height", OLD."quality", OLD."priceFactsJson", OLD."priceAsOf", OLD."priceExpiresAt", OLD."maximumCalls", OLD."planHash", OLD."createdAt")
     IS DISTINCT FROM
     ROW(NEW."id", NEW."projectId", NEW."continuityProfileVersionId", NEW."providerProfileId", NEW."providerId", NEW."modelId", NEW."modelSnapshot", NEW."capabilitiesJson", NEW."width", NEW."height", NEW."quality", NEW."priceFactsJson", NEW."priceAsOf", NEW."priceExpiresAt", NEW."maximumCalls", NEW."planHash", NEW."createdAt") THEN
    RAISE EXCEPTION 'keyframe plan identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "KeyframePlanVersion_identity_guard" BEFORE UPDATE OR DELETE ON "KeyframePlanVersion" FOR EACH ROW EXECUTE FUNCTION "protect_keyframe_plan_identity"();

CREATE OR REPLACE FUNCTION "protect_keyframe_attempt_identity"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'keyframe attempt history is append-only';
  END IF;
  IF ROW(OLD."id", OLD."projectId", OLD."keyframeAuthorizationId", OLD."keyframeTargetId", OLD."providerId", OLD."modelSnapshot", OLD."requestHash", OLD."createdAt")
     IS DISTINCT FROM
     ROW(NEW."id", NEW."projectId", NEW."keyframeAuthorizationId", NEW."keyframeTargetId", NEW."providerId", NEW."modelSnapshot", NEW."requestHash", NEW."createdAt") THEN
    RAISE EXCEPTION 'keyframe attempt identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "KeyframeAttempt_identity_guard" BEFORE UPDATE OR DELETE ON "KeyframeAttempt" FOR EACH ROW EXECUTE FUNCTION "protect_keyframe_attempt_identity"();
