# Storyboard HTTP Contract v1

All errors use `{ "error": { "code": "STABLE_CODE", "message": "safe text", "details"?: {} } }`.
Project-scoped reads never expose local paths, Provider payloads, or credentials.

## Routes

- `GET /api/projects/{projectId}/storyboards?status=ACTIVE|ARCHIVED`: list stable identities and head summary; ACTIVE is the default.
- `POST /api/projects/{projectId}/storyboards`: create `{title, creativeBrief}`; no Director run.
- `GET /api/storyboards/{storyboardId}`: return identity, head content, approval projection, and
  `ETag: "storyboard-{rowVersion}"`.
- `DELETE /api/storyboards/{storyboardId}`: permanently delete only an empty Storyboard with no durable history; requires current `If-Match`.
- `POST /api/storyboards/{storyboardId}/archive`: archive without deleting history; requires current `If-Match`.
- `POST /api/storyboards/{storyboardId}/restore`: restore an archived Storyboard; requires current `If-Match`.
- `GET /api/storyboards/{storyboardId}/versions`: list immutable version summaries.
- `GET /api/storyboard-versions/{versionId}`: read one complete immutable snapshot.
- `POST /api/storyboards/{storyboardId}/generate`: run only `fake-storyboard-v1`, append run and
  three-shot proposal, return the new ETag; requires current `If-Match`.
- `POST /api/storyboards/{storyboardId}/versions`: append owner version from
  `{parentVersionId, creativeBrief, shots, includeProjectAssetRequirements?}` with 1–20 contiguous shots; requires current
  `If-Match`. The optional flag copies only the current project's published semantic requirements
  into otherwise empty shot requirement slots; it never selects, binds, or approves an asset.
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
- 409 `PROJECT_ARCHIVED`, `STORYBOARD_ARCHIVED`, `STORYBOARD_ALREADY_ACTIVE`,
  `STORYBOARD_DELETE_REQUIRES_ARCHIVE`, `PHASE2_GATE_CLOSED`, `CANDIDATE_GAP`, `CROSS_PROJECT`,
  `UNAPPROVED_ASSET`, `FILE_NOT_READY`, `DECISION_CONFLICT`
- 412 `VERSION_CONFLICT`
- 422 `SHOT_COUNT_INVALID`, `SHOT_ORDER_INVALID`, `ASSET_REQUIREMENTS_INCOMPLETE`
- 428 `PRECONDITION_REQUIRED`

Approval responses explicitly include `generationAuthorized: false`.
