# Research Decisions: Shot Planner and GenerationSpec

## R-001: Deterministic Planner first

**Decision**: Planner v1 is a pure local transformation of approved Storyboard and Manifest facts.
**Rationale**: It is reproducible and preserves zero calls.
**Alternatives**: AI planning requires a separate provider capability and authorization feature.

## R-002: Stable plan with immutable versions

**Decision**: Use a mutable head projection over append-only versions/specs.
**Rationale**: This matches Storyboard history and supports conflict-safe editing.
**Alternatives**: In-place updates violate provenance.

## R-003: One spec per approved shot

**Decision**: Require exactly one ordered spec for each of 1–20 source shots and preserve stable shotKey identity.
**Rationale**: Storyboard approval freezes a bounded, contiguous 1–20-shot source boundary.
**Alternatives**: Arbitrary counts wait for a Storyboard contract change.

## R-004: Exact reference rows

**Decision**: Persist normalized reference rows as well as contract JSON.
**Rationale**: Composite foreign keys prevent cross-project errors and simplify preflight.
**Alternatives**: JSON-only references weaken relational integrity.

## R-005: Provider-neutral capability facts

**Decision**: Express mode, aspect ratio, duration, reference count, and audio requirement only.
**Rationale**: Future adapters can map facts without leaking provider fields upstream.
**Alternatives**: H3 workflow parameters would couple the domain.

## R-006: Preflight is read-only and time-sensitive

**Decision**: Re-evaluate approval, manifest, binding, file state, and expected SHA on every preflight and decision.
**Rationale**: A once-valid reference can later be removed or revoked.
**Alternatives**: Trusting creation-time facts makes approval stale.

## R-007: Approval does not authorize generation

**Decision**: Decisions always expose `generationAuthorized: false`.
**Rationale**: Submission needs a new action-time grant in Phase 5.
**Alternatives**: Reusing approval as a grant conflicts with governance.

## R-008: Separate Next build artifacts

**Decision**: Development uses `.next`; production build/start use `.next-build`.
**Rationale**: It removes concurrent dev/build cache collisions.
**Alternatives**: Manual shutdown is error-prone.
