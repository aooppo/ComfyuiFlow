-- Preserve normalized Assembly output facts independently from the immutable source lineage.
ALTER TABLE "GenerationAssemblyV3Record"
ADD COLUMN "outputFfprobeJson" JSONB;
