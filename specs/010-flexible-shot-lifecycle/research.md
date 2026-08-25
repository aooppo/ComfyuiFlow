# Research: Flexible Shot Lifecycle

## Decision 1: Support 1–20 saved and approved shots

**Decision**: Reuse the existing 20-shot draft boundary and require at least one complete, contiguously ordered shot for save, approval, and planning.

**Rationale**: The data model already anticipates up to 20 shots. A zero-shot durable version has no generation meaning, while 20 keeps payloads and UI bounded.

**Alternatives considered**: Unlimited shots were rejected because the current UI, hashing, preflight, and single-page comparison flows are intentionally bounded. Keeping approval fixed at three was rejected by the Owner.

## Decision 2: Keep Fake Director at three shots

**Decision**: Preserve `storyboard-three-shot-v1` as a backward-compatible deterministic idea generator.

**Rationale**: Flexible editing does not require changing the provider contract or historical fixture hashes. Users can reshape the generated proposal after it is created.

**Alternatives considered**: Passing a variable requested shot count to Fake Director was deferred because it is a separate AI/product decision and would replace a frozen contract.

## Decision 3: Empty-only hard delete, otherwise archive

**Decision**: Hard delete only a Storyboard with no durable children. Any version, run, decision, manifest, or plan makes the aggregate archive-only.

**Rationale**: This removes accidental blank cards while protecting append-only provenance and downstream foreign-key identities.

**Alternatives considered**: Cascading delete was rejected as constitution-incompatible. Archive-only for every empty typo was rejected as unnecessary list clutter.

## Decision 4: Lifecycle state lives on Storyboard

**Decision**: Add an ACTIVE/ARCHIVED projection and timestamp to Storyboard; do not repurpose Project status or mutate child records.

**Rationale**: Storyboard lifecycle is independent from Project lifecycle, and child history must remain byte-identical through archive/restore.

**Alternatives considered**: Hiding cards in client state is not durable. Deleting/restoring child records would break provenance.

## Decision 5: Variable length changes cardinality, not identity rules

**Decision**: Every plan version contains exactly one spec for each approved source shot, matched by ordinal, storyboardShotId, and shotKey.

**Rationale**: Existing deterministic hashes and source traceability generalize cleanly from three to N when the full ordered array is validated.

**Alternatives considered**: Allowing plan editors to add or remove specs was rejected because a Generation Plan must not invent or omit approved Storyboard shots.
