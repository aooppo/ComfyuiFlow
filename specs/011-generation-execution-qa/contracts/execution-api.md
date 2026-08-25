# Generation Execution HTTP Contract v1

Errors use `{ "error": { "code": "STABLE_CODE", "message": "safe text", "details"?: {} } }`.
Responses omit credentials, absolute paths, Base64, raw workflows, nodes, and secret Provider data.

## Preview and authorization

- `POST /api/generation-plan-versions/{versionId}/execution-preview`
  - Body: registered `providerProfileId`, 1-20 unique `generationSpecIds`, optional paired
    `retryOfJobId` and non-empty `retryRequirements` for one terminal failed/cancelled shot.
  - Read-only response: `GenerationExecutionPreviewV1`, deterministic `previewHash`, per-shot
    compatibility/blockers, display-safe slot/prompt facts, call maxima and cost visibility.
  - The saved GenerationSpec `positivePrompt` is the authoritative H3 shot description; changing it
    changes the compiled prompt, prompt SHA, target hash, preview hash, and AI QA expected facts.
- `POST /api/generation-batches`
  - Requires `Idempotency-Key`.
  - Body: `previewHash`, selected Spec IDs, `confirmed: true`, expiry in the allowed server range,
    and the exact paired retry source/requirements when the preview is a new attempt.
  - Recomputes Preview and atomically creates Batch, Targets, authorization, and queued Jobs only on
    an exact hash match. Returns 201 and `GenerationBatchViewV1`.

## Read, control, and review

- `GET /api/generation-batches/{batchId}` idempotently closes a batch whose jobs are all terminal,
  then returns jobs, events summary, call ledger, artifacts, QA, rowVersion, and no secret fields.
- `POST /api/generation-jobs/{jobId}/reconcile` polls/retains only the bound Provider task; no body may
  supply a different task or workflow.
- `POST /api/generation-jobs/{jobId}/cancel` requires `If-Match` and records fail-closed outcome.
- `GET /api/generated-artifacts/{artifactId}` returns lineage, content/review URLs, facts and QA.
- `GET /api/generated-artifacts/{artifactId}/content` streams the verified generated video.
- `GET /api/generated-artifacts/{artifactId}/review-frames/{role}` streams one verified frame.
- `POST /api/generated-artifacts/{artifactId}/human-qa-decisions` requires `Idempotency-Key`; body is
  strict `{ decision: "PASS" | "FAIL", notes?: string }`; non-empty `notes` are mandatory for
  `FAIL` and become the editable starting point for a separately authorized new attempt.

## Stable errors

`GENERATION_PLAN_NOT_APPROVED`, `GENERATION_PLAN_STALE`, `GENERATION_PROFILE_INCOMPATIBLE`,
`GENERATION_TARGET_INVALID`, `REFERENCE_SLOT_MISSING`, `REFERENCE_SLOT_AMBIGUOUS`,
`REFERENCE_CHARACTER_MISMATCH`, `REFERENCE_NOT_READY`, `REFERENCE_HASH_MISMATCH`,
`WORKFLOW_NOT_READY`, `LIVE_DISABLED`, `PREVIEW_STALE`, `AUTHORIZATION_EXPIRED`,
`AUTHORIZATION_SCOPE_MISMATCH`, `AUTHORIZATION_CONSUMED`, `JOB_NOT_RECONCILABLE`,
`JOB_AMBIGUOUS`, `ARTIFACT_INVALID`, `QA_NOT_READY`, `PROJECT_ARCHIVED`,
`STORYBOARD_ARCHIVED`, `IDEMPOTENCY_CONFLICT`, `PRECONDITION_REQUIRED`.
