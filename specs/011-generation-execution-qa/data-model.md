# Data Model: Generation Execution and QA

All rows carry `projectId`, use composite project ownership checks, preserve created timestamps, and
use Restrict deletion for durable lineage.

## GenerationBatch

- Approved `generationPlanVersionId`, Provider/profile snapshot, preview/scope hashes,
  idempotency key, status, rowVersion, timestamps.
- Status: `QUEUED -> RUNNING -> AWAITING_HUMAN_QA -> COMPLETED`; any technical uncertainty yields
  `PAUSED`; explicit pre-submit cancellation yields `CANCELLED`.
- Owns ordered targets, one authorization, and jobs.

## GenerationBatchTarget

- Batch, exact `generationSpecId`, ordinal, target hash, prompt hash, references hash, compiled prompt,
  slot manifest JSON, optional `retryOfJobId`.
- Unique Batch/Spec and Batch/ordinal. The snapshot is immutable after creation.

## ExecutionAuthorization and AuthorizationConsumption

- Authorization: Batch, scope hash, confirmation timestamp, expiry, generation/AI QA maximum counts.
- Consumption: Authorization, target, operation `GENERATION_SUBMIT | AI_QA_REVIEW`, request hash,
  consumed timestamp.
- Unique Authorization/Target/Operation. Insert and expiry/scope validation occur atomically before
  each network request. A failed request keeps its consumption.

## GenerationJob and GenerationJobEvent

- Job: Batch target, attempt number fixed at 1, optional prior Job, projected status, preselected
  Provider task ID, safe result code, claim owner/lease timestamps, call count, timestamps.
- One target owns one initial Job. A retry creates a new target/Job linked to the old Job.
- Event: Job, sequence, type, safe payload JSON, timestamp; unique Job/sequence.
- Job status: `QUEUED`, `RUNNING`, `SUBMITTED`, `AMBIGUOUS`, `TECHNICAL_FAILED`,
  `AWAITING_HUMAN_QA`, `QA_PASS`, `QA_FAIL`, `CANCELLED`.

## GeneratedArtifact

- Job, generated storage key, SHA-256, byte size, detected MIME, Provider artifact reference facts,
  workflow/model/task provenance, retained timestamp, technical status.
- Exactly one valid VIDEO artifact is allowed per successful H3 Job. Binaries are not `Asset` rows.

## ArtifactTechnicalCheck and ArtifactReviewFrame

- Technical check: Artifact, checker version, PASS/FAIL, safe result code, container/video/audio facts,
  width, height, fps, duration, bitrate, checked timestamp.
- Review frame: Artifact, role `FIRST | MIDDLE | FINAL`, requested/actual timestamp, extractor version,
  generated storage key, SHA-256, byte size, MIME.
- Exactly one check and one frame per Artifact/role for v1; later checker versions append new records.

## AiQaRun and AiQaResult

- Run: Artifact, Provider/requested/resolved model, request/input hashes, response ID, status, safe
  result code, call count, usage JSON, timestamps.
- Result: Run, contract/prompt versions, overall advisory status, summary, limitations, criteria JSON,
  output hash, created timestamp.
- One v1 run per Artifact under a combined authorization. Provider failure is evidence and never a
  Human QA decision.

## HumanQaDecision

- Artifact, decision `PASS | FAIL`, notes, idempotency key, request hash, created timestamp.
- Append-only. Current projection is the latest decision; only latest PASS exposes
  `futureAssemblyEligible=true`.

## H3 slot manifest

The target snapshot stores five ordered entries with semantic/file identities and hashes:

1. Scene: ProductionAsset `SCENE`, usage `SCENE_STYLE`.
2. Product: ProductionAsset `PROP`, usage `PROP_DETAIL`.
3. Character full body: one Character version/state, usage `FULL_BODY`.
4. Character face: same Character version/state, usage `FACE`.
5. Character rear: same Character version/state, usage `FULL_BODY` or `IDENTITY`, viewpoint `REAR` or
   `REAR_THREE_QUARTER`.

Multiple candidates for a role are never ranked at execution time; the frozen Manifest must make
the binding unambiguous.
