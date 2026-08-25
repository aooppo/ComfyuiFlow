# Director API Contract

- `POST /api/storyboards/{id}/director-preview`: profile, max shots, optional selected semantic
  versions; returns deterministic candidates, safe scope facts, expiry and zero calls.
- `POST /api/storyboards/{id}/director-runs`: same scope plus preview hash, idempotency and `If-Match`;
  atomically creates one QUEUED run and authorization.
- `GET /api/storyboard-director-runs/{runId}`: safe status, attempt count and proposal ID.
- `GET /api/storyboards/{id}/director-proposals`: proposal summaries.
- `GET /api/storyboard-director-proposals/{proposalId}`: immutable proposal and comparison.
- `POST /api/storyboard-director-proposals/{proposalId}/decisions`: append REJECTED decision.
- `POST /api/storyboard-director-proposals/{proposalId}/adopt`: edited proposal plus `If-Match`;
  revalidates references and appends one AI_DIRECTOR StoryboardVersion.

Errors use stable safe codes. No response exposes secrets, absolute paths, Base64, raw Provider
output, or browser-overridable provider configuration.
