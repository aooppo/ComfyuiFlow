# Contract: Continuity and Keyframe API

All responses use business-safe DTOs. Default responses omit storage keys, paths, credentials, raw
prompts, raw Provider payloads, Base64, workflow JSON, and internal hashes except under an explicit
`advanced` object.

## Continuity

- `GET /api/storyboards/{storyboardId}/continuity`: returns eligibility, latest/approved profile,
  subject cards, ordered timeline, preflight issues, and navigation state. Zero external calls.
- `POST /api/storyboards/{storyboardId}/continuity/suggestions`: deterministically creates an
  immutable suggested version from the exact approved Storyboard/manifest. No AI call.
- `POST /api/continuity-profiles/{profileId}/versions`: appends an owner-edited version using
  `parentVersionId`, `rowVersion`, subjects, rules, boundaries, shot transitions, and idempotency key.
- `POST /api/continuity-profile-versions/{versionId}/preflight`: returns zero-call blockers/warnings,
  supported actions, and canonical preflight hash.
- `POST /api/continuity-profile-versions/{versionId}/decisions`: appends APPROVED/REJECTED/REVOKED;
  approval requires current preflight hash and zero blockers.

Conflict actions are finite commands: `INHERIT_PREVIOUS`, `DECLARE_SHOT_CHANGE`, or
`SELECT_APPROVED_REFERENCE`. Commands create a new version; they never mutate an approved version.

## Keyframes

- `POST /api/continuity-profile-versions/{versionId}/keyframe-plans/preview`: zero-call plan preview
  containing N+1 targets, capabilities, price fact/as-of/expiry, maximum calls, and no-retry notice.
- `POST /api/continuity-profile-versions/{versionId}/keyframe-plans`: persists the exact preview
  after hash match; Fake is allowed, LIVE requires explicit server enablement and full capabilities.
- `POST /api/keyframe-plans/{planId}/authorize`: records a fresh maximum-call and expiry-bound owner
  confirmation. It does not call a Provider or authorize video.
- `POST /api/keyframe-plans/{planId}/execute`: consumes before each attempt, submits each target once,
  pauses on failure/ambiguity, and returns retained artifact state.
- `POST /api/keyframe-artifacts/{artifactId}/decisions`: appends APPROVED/REJECTED.
- `GET /api/keyframe-artifacts/{artifactId}/content`: verified Range-capable image response.

## Video preview and draft

- Existing execution preview accepts optional `keyframePlanVersionId`. When present it returns the
  explicit video control tier, start/end keyframe labels and hashes, hard blockers, soft warnings,
  cost ceilings, and a scope hash that includes every continuity dependency.
- Existing batch creation must match the exact preview hash and stores those bindings.
- `GET /api/generation-plans/{planId}/drafts` returns local draft eligibility, missing ordinals,
  warnings, current draft, and history without changing formal assembly eligibility.
- `POST /api/generation-plans/{planId}/drafts` explicitly assembles the current technically valid
  source set locally and makes zero external calls.
- `GET /api/generation-plan-drafts/{draftId}/content` returns verified Range-capable video.

## Error semantics

Stable safe codes include `CONTINUITY_NOT_ELIGIBLE`, `CONTINUITY_CONFLICT`, `PROFILE_STALE`,
`KEYFRAME_CAPABILITY_UNAVAILABLE`, `KEYFRAME_PRICE_UNAVAILABLE`, `KEYFRAME_LIVE_DISABLED`,
`KEYFRAME_AUTHORIZATION_REQUIRED`, `KEYFRAME_SCOPE_CHANGED`, `KEYFRAME_ATTEMPT_FAILED`,
`VIDEO_CAPABILITY_INSUFFICIENT`, and `DRAFT_SOURCE_INCOMPLETE`.
