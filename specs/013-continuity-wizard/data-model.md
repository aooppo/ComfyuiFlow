# Data Model: Whole-Film Continuity Wizard

All records are project-scoped. Configuration versions, boundaries, plans, attempts, artifacts,
decisions, and assemblies are append-only; binary content remains outside PostgreSQL.

## ContinuityProfile and ContinuityProfileVersion

- `ContinuityProfile`: stable aggregate for one approved Storyboard; stores head and approved version.
- `ContinuityProfileVersion`: exact StoryboardVersion, manifest, registry version, parent, version
  number, canonical input/output hash, and creation time.
- A version becomes approved only through an append-only `ContinuityDecision` bound to request hash.
- Any revoked/changed Storyboard approval, manifest, or source asset invalidates preflight.

## ContinuitySubject and ContinuityRule

- Subject fields: profile version, stable `subjectKey`, registry `kind`, business label, optional
  semantic asset/version/file identities, source hash, and normalized facts JSON.
- Rule fields: subject, stable property key, `WHOLE_FILM_HOLD | SHOT_CHANGE | UNIMPORTANT`,
  `HARD | SOFT`, normalized expected value, and explanation.
- Subject uniqueness is `(profileVersionId, subjectKey)`; rule uniqueness is
  `(subjectId, propertyKey)`.

## ShotBoundary and ShotContinuityState

- Exactly N+1 boundaries per profile version with index 0..N, normalized state JSON, state hash, and
  validation status.
- Every shot state references the existing StoryboardShot plus one start and one end boundary and
  contains only declared per-shot transitions/notes.
- Shot ordinal i references boundary i-1 and i. Internal boundaries are therefore shared by identity.

## ContinuityPreflight and ContinuityDecision

- Preflight is computed, zero-call state: `ready`, sorted blocker/warning items, and preflight hash.
- Each issue includes severity, stable code, subject, boundary/shot identity, explanation, and
  supported business actions.
- Decision stores `APPROVED | REJECTED | REVOKED`, request/preflight hash, notes, idempotency key,
  and owner timestamp.

## KeyframePlanVersion and KeyframeTarget

- Plan binds approved profile version, Provider profile/model/capability snapshot, dimensions,
  quality, price-fact JSON/as-of/expiry, max calls, plan hash, and status.
- Exactly one target per boundary binds state hash, ordered reference hashes, prompt hash, and target
  hash. For N shots there are N+1 targets.

## KeyframeAuthorization, Attempt, Artifact, Decision

- Authorization binds plan hash, maximum calls, confirmed/expiry timestamps, and idempotency key.
- Attempt uniquely identifies authorization+target, records provider/model snapshot, request hash,
  `STARTED | SUCCEEDED | FAILED | AMBIGUOUS`, safe result code, one provider call maximum, and usage/
  cost facts.
- Artifact stores storage key, hash, size, MIME type, dimensions, and retained timestamp.
- Decision is append-only `APPROVED | REJECTED`; a plan is usable only when the latest decision for
  every exact target artifact is APPROVED.

## Continuity-aware video execution

- `GenerationBatch` optionally binds profile version, keyframe plan version, continuity scope hash,
  and registered video control tier.
- Each target optionally binds start/end boundary hashes, start/end keyframe artifact hashes, and
  marks the end keyframe as a soft QA target for ordinary-reference H3.
- Historical null bindings retain Phase 11/12 behavior; non-null bindings must pass full stale checks.

## DraftAssembly and DraftAssemblySource

- Draft assembly binds approved plan version, exact ordered technically valid artifacts, source-set
  hash, warning summary/hash, local output facts, assembler version, and creation time.
- Sources bind generation spec/artifact, ordinal, source hash/size/type, Human QA state, and warning
  snapshot. No Human PASS is required.
- It has separate API/UI/content identity from formal `GenerationPlanAssembly`.

## Core invariants

1. Every referenced object belongs to the same project and exact approved lineage.
2. N shots create N+1 unique ordered boundaries and targets.
3. Boundary and target hashes are canonical and stable for unchanged input.
4. No keyframe attempt exists without prior authorization consumption.
5. One target receives at most one attempt per authorization; no automatic retry/fallback exists.
6. Approved artifacts must verify storage hash/size before use.
7. H3 is never represented as start/end locked.
8. Draft and formal assembly records, routes, labels, and eligibility never overlap.
