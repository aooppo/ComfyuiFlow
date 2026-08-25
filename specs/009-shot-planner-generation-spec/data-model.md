# Data Model: Shot Planner and GenerationSpec

## GenerationPlan

- Project, Storyboard, approved StoryboardVersion, and Manifest identities.
- Head/approved version and rowVersion are mutable projections only.
- Creation idempotency is unique per project.

## GenerationPlanVersion

- Immutable identity, plan, version number, parent, source (`DETERMINISTIC_PLANNER` or `OWNER`).
- Planner/contract versions and input/reference/output hashes.
- Exactly three child specs are required for approval.

## GenerationSpec

- Immutable plan-version, StoryboardShot, shotKey, and ordinal identity.
- Narrative, camera, composition, continuity, duration, positive prompt, capability JSON, and content hash.
- Unique ordinal and shotKey per version.

## GenerationSpecReference

- Exact requirement, semantic version, optional state version, file binding, ProjectAsset, expected SHA-256, and ReferenceUsage.
- All identities share the project and originate from the frozen Manifest.

## GenerationPlanDecision

- Immutable APPROVED or REVOKED event with plan/version, idempotency, request hash, notes, and time.
- Updates only the approved projection and always returns `generationAuthorized: false`.

## Lifecycle

```text
approved storyboard + manifest
  -> plan/head v1
  -> optional owner v2..n under CAS
  -> preflight (no writes)
  -> APPROVED
  -> later edit creates an unapproved head
  -> REVOKED appends history and clears matching projection
```

No transition creates a Provider grant, GenerationJob, Artifact, QAResult, or external call.
