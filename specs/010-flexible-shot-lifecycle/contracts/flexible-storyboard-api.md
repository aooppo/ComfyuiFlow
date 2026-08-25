# Flexible Storyboard API Contract

All errors use the existing safe `{ error: { code, message } }` envelope. Lifecycle writes require the current Storyboard ETag in `If-Match`.

## Variable shots

- `POST /api/storyboards/{storyboardId}/versions`
  - Body contains 1–20 shots.
  - Shot keys are unique UUIDs and ordinals are exactly 1 through N.
  - Appends one immutable owner version and clears current Storyboard approval.
- `POST /api/storyboard-versions/{versionId}/decisions`
  - Approval accepts 1–20 contiguous shots with a complete current manifest.
  - Empty, over-limit, duplicate, or gapped shots return stable validation codes and zero writes.

## Lifecycle

- `GET /api/projects/{projectId}/storyboards?status=ACTIVE|ARCHIVED`
  - Defaults to ACTIVE.
  - Returns lifecycle state and enough dependency facts for the UI to label Archive versus Delete.
- `POST /api/storyboards/{storyboardId}/archive`
  - Requires `If-Match`.
  - Sets status ARCHIVED and archivedAt; retains every child and projection.
- `POST /api/storyboards/{storyboardId}/restore`
  - Requires `If-Match`.
  - Sets status ACTIVE and archivedAt null.
- `DELETE /api/storyboards/{storyboardId}`
  - Requires `If-Match`.
  - Succeeds only when no durable child record exists.
  - Otherwise returns `STORYBOARD_DELETE_REQUIRES_ARCHIVE` without mutation.

Stable lifecycle errors include `STORYBOARD_ARCHIVED`, `STORYBOARD_ALREADY_ACTIVE`, `STORYBOARD_DELETE_REQUIRES_ARCHIVE`, `PRECONDITION_REQUIRED`, and `VERSION_CONFLICT`.
