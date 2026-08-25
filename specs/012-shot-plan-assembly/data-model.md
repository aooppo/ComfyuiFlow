# Data Model: Approved Shot Plan Assembly

All rows are project-scoped, append-only, and use restrictive deletion so plan, source, and output
lineage cannot be orphaned.

## GenerationPlanAssembly

- `id`, `projectId`, `generationPlanId`, `generationPlanVersionId`
- `sourceSetHash`: deterministic identity of the exact approved version and ordered sources
- `storageKey`, `sha256`, `byteSize`, `detectedMimeType`
- `container`, `videoCodec`, `width`, `height`, `fps`, `durationSeconds`, `hasAudio`
- `assemblerVersion`: identifies normalization/concat behavior
- `createdAt`
- Unique `(generationPlanVersionId, sourceSetHash)` makes identical creation idempotent.
- Indexed by plan and newest creation time for history.

## GenerationPlanAssemblySource

- `id`, `projectId`, `generationPlanAssemblyId`
- `generationSpecId`, `generatedArtifactId`, `ordinal`
- `sourceSha256`, `sourceByteSize`, `sourceMimeType`
- `createdAt`
- Unique `(generationPlanAssemblyId, ordinal)` and `(generationPlanAssemblyId, generationSpecId)`.
- One assembly owns exactly one source row for each approved ordinal.

## Computed Assembly State

- `eligible`: true only when every approved spec resolves exactly one latest owner-PASS source.
- `missingOrdinals`: ordered approved ordinals without an eligible artifact.
- `sources`: ordered safe identities for the current eligible source set.
- `sourceSetHash`: present only for a complete current set.
- `currentAssembly`: newest immutable assembly whose hash equals the current source-set hash.
- `history`: all plan assemblies newest first; `stale=true` when its hash differs from the current hash.

## Invariants

1. Every source belongs to the same project and approved GenerationPlanVersion as the assembly.
2. Every source artifact is retained, technically valid, hash/size verified, and owner PASS.
3. Ordinals are complete, unique, and ascending before FFmpeg runs.
4. The assembly output is silent H.264 MP4 at 768x1344 and 24 fps.
5. Assembly/source rows and stored files are never updated or deleted by feature workflows.
6. A source-set hash identifies at most one assembly for an approved version.
