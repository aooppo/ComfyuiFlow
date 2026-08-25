# Generation Plan HTTP Contract v1

Errors use `{ "error": { "code": "STABLE_CODE", "message": "safe text", "details"?: {} } }`. Responses never expose credentials, absolute paths, binary/Base64 content, Provider payloads, workflow IDs, model IDs, or node names.

## Routes

- `POST /api/storyboard-versions/{versionId}/generation-plans`: requires `Idempotency-Key`; returns 201, ETag, `externalCalls: 0`, and `generationAuthorized: false`.
- `GET /api/generation-plans/{planId}`: returns identity, head, approval projection, decisions, and ETag `"generation-plan-{rowVersion}"`.
- `GET /api/generation-plans/{planId}/versions`: immutable version summaries.
- `POST /api/generation-plans/{planId}/versions`: requires `If-Match` and parent; appends exactly three owner-edited specs.
- `POST /api/generation-plan-versions/{versionId}/preflight`: returns ready/blockers/shot results with zero writes/calls.
- `POST /api/generation-plan-versions/{versionId}/decisions`: requires `If-Match` and `Idempotency-Key`; appends APPROVED or REVOKED.

## Stable Errors

- 404 `GENERATION_PLAN_NOT_FOUND`, `GENERATION_PLAN_VERSION_NOT_FOUND`
- 409 `STORYBOARD_NOT_APPROVED`, `MANIFEST_MISSING`, `MANIFEST_STALE`, `REFERENCE_NOT_READY`, `REFERENCE_UNAPPROVED`, `INPUT_HASH_MISMATCH`, `CROSS_PROJECT`, `PROJECT_ARCHIVED`, `DECISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`
- 412 `PLAN_VERSION_CONFLICT`
- 422 `GENERATION_SPEC_INVALID`
- 428 `PRECONDITION_REQUIRED`
