CREATE TABLE "CapabilityPublicationReceipt" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorRef" VARCHAR(160) NOT NULL,
  "manifestJson" JSONB NOT NULL,
  "manifestSha256" CHAR(64) NOT NULL UNIQUE,
  "capabilityProfileId" UUID NOT NULL REFERENCES "CapabilityProfile"("id") ON DELETE RESTRICT,
  "implementationId" UUID NOT NULL REFERENCES "GenerationImplementation"("id") ON DELETE RESTRICT,
  "receiptDigest" CHAR(64) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "CapabilityPublicationReceipt_capabilityProfileId_createdAt_idx"
  ON "CapabilityPublicationReceipt" ("capabilityProfileId", "createdAt");
CREATE INDEX "CapabilityPublicationReceipt_implementationId_createdAt_idx"
  ON "CapabilityPublicationReceipt" ("implementationId", "createdAt");

CREATE TRIGGER "CapabilityPublicationReceipt_no_mutation"
  BEFORE UPDATE OR DELETE ON "CapabilityPublicationReceipt"
  FOR EACH ROW EXECUTE FUNCTION "mainline_append_only"();
