# Storyboard HTTP Contract v1

All errors use `{ "error": { "code": "STABLE_CODE", "message": "safe text", "details"?: {} } }`.
Project-scoped reads never expose local paths, Provider payloads, or credentials.

## Routes

- `GET /api/projects/{projectId}/storyboards?cursor=&limit=`: list stable identities and head summary.
- `POST /api/projects/{projectId}/storyboards`: create `{title, creativeBrief}`; no Director run.
- `GET /api/storyboards/{storyboardId}`: return identity, head content, approval projection, and
  `ETag: "storyboard-{rowVersion}"`.
- `GET /api/storyboards/{storyboardId}/versions`: list immutable version summaries.
- `GET /api/storyboard-versions/{versionId}`: read one complete immutable snapshot.
- `POST /api/storyboards/{storyboardId}/generate`: run only `fake-storyboard-v1`, append run and
  three-shot version, return the new ETag; requires current `If-Match`.
- `POST /api/storyboards/{storyboardId}/versions`: append owner version from
  `{parentVersionId, creativeBrief, shots}`; requires current `If-Match`.
- `POST /api/storyboard-versions/{versionId}/asset-candidates/preview`: aggregate the frozen Phase 2
  candidate policy with `formalSelectionCreated=false`.
- `POST /api/storyboard-versions/{versionId}/asset-resolution-manifests`: gate-open only; body maps
  every requirement ID to selected AssetVersionFile IDs and includes the preview result hash.
- `POST /api/storyboard-versions/{versionId}/decisions`: append `APPROVED` or `REVOKED`; requires
  `Idempotency-Key` and the Storyboard ETag.

## Concurrency

- Missing `If-Match`: HTTP 428 `PRECONDITION_REQUIRED`.
- Stale ETag or parent: HTTP 412 `VERSION_CONFLICT` with current head ID and ETag.
- Version append and head update are one transaction; conflict produces no run/version/shot/requirement.

## Stable Errors

- 400 `INVALID_REQUEST`
- 404 `PROJECT_NOT_FOUND`, `STORYBOARD_NOT_FOUND`, `STORYBOARD_VERSION_NOT_FOUND`
- 409 `PROJECT_ARCHIVED`, `PHASE2_GATE_CLOSED`, `CANDIDATE_GAP`, `CROSS_PROJECT`,
  `UNAPPROVED_ASSET`, `FILE_NOT_READY`, `DECISION_CONFLICT`
- 412 `VERSION_CONFLICT`
- 422 `SHOT_COUNT_INVALID`, `SHOT_ORDER_INVALID`, `ASSET_REQUIREMENTS_INCOMPLETE`
- 428 `PRECONDITION_REQUIRED`

Approval responses explicitly include `generationAuthorized: false`.
