# Feature Specification: Flexible Shot Lifecycle

**Feature Branch**: `codex/phase-0-discovery`

**Created**: 2026-08-25

**Status**: Approved for implementation

**Input**: User requests that Storyboards support adding and removing shots, that any supported shot count can enter a Generation Plan, and that Storyboard cards expose safe archive/delete actions.

## User Scenarios & Testing

### User Story 1 - Shape a Variable-Length Storyboard (Priority: P1)

As the project owner, I can add, remove, reorder, and edit shots so the Storyboard matches the story instead of being locked to three shots.

**Why this priority**: Shot structure is a creative decision. A fixed three-shot editor prevents ordinary short-form stories from being represented accurately.

**Independent Test**: Start from a three-shot Fake proposal, add two shots, remove one, reorder the remaining four, save, reload, and verify the immutable new version contains the same four ordered shots.

**Acceptance Scenarios**:

1. **Given** a Storyboard draft with fewer than 20 shots, **When** the owner adds a shot, **Then** a new editable shot with a stable identity is inserted and all visible ordinals are contiguous.
2. **Given** a Storyboard draft with more than one shot, **When** the owner removes a shot, **Then** only the editing copy changes until the owner saves a new immutable version.
3. **Given** a draft containing 1–20 complete shots with contiguous ordinals, **When** the owner completes asset resolution and approves it, **Then** approval is allowed without requiring exactly three shots.
4. **Given** an empty or more-than-20-shot editing copy, **When** approval or save is attempted, **Then** the system rejects it with a clear stable explanation and creates no partial version.

---

### User Story 2 - Plan Every Approved Shot (Priority: P1)

As the project owner, I can turn any approved 1–20-shot Storyboard into a Generation Plan with one inspectable GenerationSpec per source shot.

**Why this priority**: Flexible Storyboard editing has no end-to-end value if the planner silently drops shots or continues to require three.

**Independent Test**: Approve Storyboards containing 1, 4, and 20 shots, create a plan for each, and verify the plan contains the same number of ordered specifications with exact source identities and deterministic hashes.

**Acceptance Scenarios**:

1. **Given** an approved Storyboard with N shots where N is 1–20, **When** a plan is created, **Then** exactly N ordered GenerationSpecs are persisted and zero external calls occur.
2. **Given** a variable-length plan, **When** the owner edits and saves it, **Then** every source shot remains represented exactly once and prior plan versions remain unchanged.
3. **Given** missing, duplicate, or non-contiguous source/spec ordinals, **When** create, preflight, or approval runs, **Then** it fails atomically with a stable blocker.

---

### User Story 3 - Remove or Recover Storyboards Safely (Priority: P2)

As the project owner, I can remove accidental empty Storyboards and archive established Storyboards without losing their history.

**Why this priority**: The list currently accumulates mistakes with no removal control, while established provenance must remain recoverable.

**Independent Test**: Permanently delete an empty Storyboard, archive a versioned Storyboard, confirm it leaves the active list and becomes read-only, then restore it with all versions and plans intact.

**Acceptance Scenarios**:

1. **Given** a Storyboard with no versions, runs, decisions, manifests, or plans, **When** permanent deletion is confirmed, **Then** it is removed and cannot be reopened.
2. **Given** a Storyboard with any durable history, **When** removal is requested, **Then** permanent deletion is refused and the UI offers recoverable archive instead.
3. **Given** an archived Storyboard, **When** it is viewed, **Then** all history remains readable but generation, editing, asset resolution, planning, and decisions are blocked.
4. **Given** an archived Storyboard, **When** the owner restores it, **Then** it returns to the active list with unchanged versions, decisions, manifests, plans, and hashes.

### Edge Cases

- Fake Director continues to create exactly three shots; flexibility begins in the owner editing copy.
- Removing the only shot leaves an unsaved empty editing copy; it cannot be persisted or approved.
- Adding the twentieth shot is allowed; adding a twenty-first is blocked before save.
- Reordering regenerates only ordinals; stable shot keys remain attached to their content.
- Removing a shot that has structured asset requirements removes those requirements only from the newly saved version; historical versions and manifests remain unchanged.
- An approved Storyboard cannot be edited in place. A new version clears the current approval projection and requires a new manifest and decision.
- Archive and restore use optimistic concurrency so stale tabs create no partial state.
- Permanent deletion is unavailable after any durable child record exists, even if a plan or decision is no longer current.

## Requirements

### Functional Requirements

- **FR-001**: The editor MUST allow the owner to add, remove, reorder, and edit shots in a local editing copy.
- **FR-002**: A saved StoryboardVersion MUST contain 1–20 shots with unique stable shot keys and contiguous ordinals beginning at 1.
- **FR-003**: Adding or reordering a shot MUST preserve the stable identities of all unaffected shots.
- **FR-004**: Removing a shot MUST affect only a newly appended version and MUST NOT mutate historical versions, requirements, manifests, decisions, or plans.
- **FR-005**: Fake Director MUST remain deterministic and continue to return its existing three-shot proposal with zero external calls.
- **FR-006**: Storyboard approval MUST accept any complete 1–20-shot current version with a matching frozen manifest and MUST reject zero, over-limit, duplicate, or non-contiguous shots.
- **FR-007**: Generation Plan creation MUST create exactly one GenerationSpec for every ordered shot in the approved source version.
- **FR-008**: Generation Plan editing, preflight, approval, history, and comparison MUST support 1–20 specifications and preserve a one-to-one mapping to source shot identities.
- **FR-009**: Deterministic hashes MUST cover the complete ordered variable-length shot/spec collection.
- **FR-010**: All variable-length paths MUST remain project-scoped, append-only, optimistic-concurrency protected, and zero-call by default.
- **FR-011**: The active Storyboard list MUST expose a removal menu with explicit confirmation and must not turn the entire card into the destructive control.
- **FR-012**: A Storyboard MAY be permanently deleted only when it has no durable history or dependent records.
- **FR-013**: A Storyboard with durable history MUST be removable only through recoverable archive.
- **FR-014**: Archived Storyboards MUST be excluded from the default active list, available in an archived view, readable, and blocked from all writes.
- **FR-015**: Restoring a Storyboard MUST preserve and re-expose all historical versions, requirements, manifests, bindings, decisions, plans, and hashes.
- **FR-016**: Archive, restore, and delete MUST require the current Storyboard version token and return stable conflict/error codes.
- **FR-017**: Existing three-shot Storyboards and Generation Plans MUST remain readable and behaviorally compatible.
- **FR-018**: No operation in this feature may authorize generation or create Provider, ComfyUI, GenerationJob, Artifact, or QA calls/records.
- **FR-019**: The 008 and 009 living specifications, contracts, verification guides, and traceability MUST be updated to remove obsolete exactly-three approval/planning rules while retaining the Fake Director three-shot rule.

### Key Entities

- **Storyboard**: Stable project-scoped creative aggregate with active or archived lifecycle state and immutable version history.
- **StoryboardVersion**: Immutable 1–20-shot snapshot whose current projection can be approved or superseded.
- **StoryboardShot**: Immutable version-owned shot row with a stable cross-version shot key and contiguous ordinal.
- **GenerationPlanVersion**: Immutable plan snapshot containing one GenerationSpec per source StoryboardShot.
- **GenerationSpec**: Provider-neutral generation description bound to exactly one source shot.

## Success Criteria

- **SC-001**: An owner can add, remove, reorder, save, and reopen a 1–20-shot Storyboard without command-line interaction.
- **SC-002**: One hundred percent of accepted Storyboard versions contain unique shot keys and contiguous ordinals from 1 through their shot count.
- **SC-003**: Plans created from 1-, 4-, and 20-shot approved Storyboards contain exactly 1, 4, and 20 deterministic specifications respectively.
- **SC-004**: Historical Storyboard and plan versions remain byte-for-byte/hash-identical after later shot additions or removals.
- **SC-005**: Empty and over-limit drafts, stale writers, duplicate identities, and ordinal gaps create zero partial durable records.
- **SC-006**: An owner can remove an accidental empty Storyboard in under 30 seconds and archive/restore an established Storyboard in under one minute.
- **SC-007**: Archived Storyboards permit zero writes until restored and retain 100 percent of their prior history.
- **SC-008**: Existing three-shot fixtures and all prior automated suites remain compatible.
- **SC-009**: Full acceptance records AI 0, Provider 0, ComfyUI 0, and video generation 0.
- **SC-010**: Format, lint, type, automated tests, isolated database tests, migration rehearsal, production build, secret scan, diff check, and browser QA pass.

## Assumptions

- The supported variable range is 1–20 shots, matching the existing data-model boundary.
- Fake Director remains a three-shot idea generator; this feature adds owner-controlled structural editing rather than a new AI prompt contract.
- “Delete” means permanent deletion only for a truly empty Storyboard; all durable creative provenance uses archive/restore.
- This feature remains local, single-owner, provider-neutral, and portrait-video oriented.

## Out of Scope

- AI-selected shot counts, automatic scene splitting, or automatic shot deletion.
- Permanent deletion of versioned Storyboards or any Generation Plan/history.
- Provider/model selection, workflow materialization, ComfyUI submission, video generation, QA, assembly, or publishing.
