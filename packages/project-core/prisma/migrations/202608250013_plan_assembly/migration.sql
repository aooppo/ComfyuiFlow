CREATE TABLE "GenerationPlanAssembly" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "generationPlanId" UUID NOT NULL,
    "generationPlanVersionId" UUID NOT NULL,
    "sourceSetHash" CHAR(64) NOT NULL,
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

    CONSTRAINT "GenerationPlanAssembly_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationPlanAssemblySource" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "generationPlanAssemblyId" UUID NOT NULL,
    "generationSpecId" UUID NOT NULL,
    "generatedArtifactId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceSha256" CHAR(64) NOT NULL,
    "sourceByteSize" BIGINT NOT NULL,
    "sourceMimeType" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationPlanAssemblySource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenerationPlanAssembly_generationPlanVersionId_sourceSetHash_key"
ON "GenerationPlanAssembly"("generationPlanVersionId", "sourceSetHash");
CREATE UNIQUE INDEX "GenerationPlanAssembly_projectId_id_key"
ON "GenerationPlanAssembly"("projectId", "id");
CREATE INDEX "GenerationPlanAssembly_generationPlanId_createdAt_idx"
ON "GenerationPlanAssembly"("generationPlanId", "createdAt" DESC);

CREATE UNIQUE INDEX "GenerationPlanAssemblySource_generationPlanAssemblyId_ordinal_key"
ON "GenerationPlanAssemblySource"("generationPlanAssemblyId", "ordinal");
CREATE UNIQUE INDEX "GenerationPlanAssemblySource_generationPlanAssemblyId_generationSpecId_key"
ON "GenerationPlanAssemblySource"("generationPlanAssemblyId", "generationSpecId");
CREATE UNIQUE INDEX "GenerationPlanAssemblySource_projectId_id_key"
ON "GenerationPlanAssemblySource"("projectId", "id");
CREATE INDEX "GenerationPlanAssemblySource_generatedArtifactId_idx"
ON "GenerationPlanAssemblySource"("generatedArtifactId");

ALTER TABLE "GenerationPlanAssembly"
ADD CONSTRAINT "GenerationPlanAssembly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanAssembly"
ADD CONSTRAINT "GenerationPlanAssembly_generationPlanId_fkey" FOREIGN KEY ("generationPlanId") REFERENCES "GenerationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanAssembly"
ADD CONSTRAINT "GenerationPlanAssembly_generationPlanVersionId_fkey" FOREIGN KEY ("generationPlanVersionId") REFERENCES "GenerationPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GenerationPlanAssemblySource"
ADD CONSTRAINT "GenerationPlanAssemblySource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanAssemblySource"
ADD CONSTRAINT "GenerationPlanAssemblySource_generationPlanAssemblyId_fkey" FOREIGN KEY ("generationPlanAssemblyId") REFERENCES "GenerationPlanAssembly"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanAssemblySource"
ADD CONSTRAINT "GenerationPlanAssemblySource_generationSpecId_fkey" FOREIGN KEY ("generationSpecId") REFERENCES "GenerationSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GenerationPlanAssemblySource"
ADD CONSTRAINT "GenerationPlanAssemblySource_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
