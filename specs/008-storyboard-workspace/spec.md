# Feature Specification: Three-Shot Storyboard Workspace

**Feature Branch**: `codex/phase-0-discovery`

**Created**: 2026-08-25

**Status**: Approved for implementation

**Input**: User description: "Implement Phase 2 convergence and a three-shot storyboard workspace with append-only versions, deterministic Fake Director, gated formal asset binding, explicit approval, and zero external provider or video-generation calls."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create a Three-Shot Draft (Priority: P1)

As the project owner, I can enter a creative description and ask the local Fake Director for a
three-shot storyboard proposal so I can establish a visible narrative structure without uploading
assets or spending provider credits.

**Why this priority**: A usable three-shot proposal is the smallest product increment that moves the
project beyond the one-shot technical spike while preserving the zero-call safety boundary.

**Independent Test**: From an active project, create a storyboard, generate a Fake proposal, reopen
the page, and verify that the same three ordered shots and zero-call provenance are present.

**Acceptance Scenarios**:

1. **Given** an active project and a non-empty creative description, **When** the owner runs the Fake
   Director, **Then** exactly three ordered draft shots are created and no external call occurs.
2. **Given** the same project, description, and Fake contract version, **When** two proposals are
   generated, **Then** their shot content is deterministic while their run and version identities
   remain distinct.
3. **Given** an archived or unknown project, **When** draft creation is requested, **Then** the request
   is rejected without creating a storyboard or run.

---

### User Story 2 - Edit and Compare Immutable Versions (Priority: P1)

As the project owner, I can edit, reorder, save, and compare the three shots without overwriting an
older version, so creative changes remain reversible and attributable.

**Why this priority**: Human control and append-only history are required before any storyboard can
be treated as an approved business decision.

**Independent Test**: Edit the current draft in two browser sessions, save one, verify the stale
session receives a conflict, then compare and reopen both immutable versions.

**Acceptance Scenarios**:

1. **Given** a current storyboard version, **When** the owner saves changed shot content or order,
   **Then** a new version is appended with a parent link and the previous version remains unchanged.
2. **Given** two editors opened at the same head version, **When** the first saves and the second
   attempts to save, **Then** the second receives an actionable version-conflict response and no
   content is overwritten.
3. **Given** an incomplete working draft, **When** the owner saves it, **Then** it remains editable but
   cannot be approved until it contains exactly three valid ordered shots.

---

### User Story 3 - Resolve Assets and Explicitly Approve (Priority: P2)

As the project owner, I can inspect asset requirements and gaps for every shot, bind only eligible
approved assets after the Phase 2 gate passes, freeze the resulting resolution manifest, and
explicitly approve the storyboard.

**Why this priority**: A storyboard is not production-ready until every required reference is bound
to an exact approved asset version and the owner separately approves the creative revision.

**Independent Test**: Demonstrate that formal binding is blocked while the Phase 2 gate is closed,
then open the gate with recorded evidence, bind eligible candidates for all required slots, freeze a
manifest, and append an approval decision.

**Acceptance Scenarios**:

1. **Given** a shot asset requirement, **When** candidates are previewed, **Then** eligible, rejected,
   and gap results use the frozen Phase 2 policy and create no formal selection.
2. **Given** the Phase 2 gate is closed, **When** the owner attempts to bind or approve, **Then** the
   operation fails closed and creates no binding, manifest, or decision.
3. **Given** the gate is open and a selected candidate remains eligible, **When** the owner confirms
   it, **Then** the exact semantic version, state version, file binding, and project file are locked.
4. **Given** exactly three valid shots and a complete frozen asset-resolution manifest, **When** the
   owner approves the current version, **Then** an append-only approval decision is recorded without
   authorizing generation.
5. **Given** any missing, stale, cross-project, unapproved, inactive, or non-ready asset, **When**
   approval is attempted, **Then** approval is rejected with stable, explainable gap codes.

### Edge Cases

- A proposal or saved draft that contains zero, one, two, or more than three shots remains
  unapprovable; the Fake Director itself must always return exactly three.
- Duplicate or non-contiguous shot order values are normalized only in the editing form; persisted
  versions must contain unique order values 1, 2, and 3 before approval.
- A stale `If-Match` value creates no new version and returns the current head identity.
- Candidate eligibility changing after preview invalidates the proposed binding; confirmation must
  re-evaluate the candidate within the write transaction.
- Revoking a decision does not mutate or delete the approved version, manifest, or earlier decision.
- Archived projects remain readable but cannot generate proposals, save versions, bind assets, or
  append approval decisions.
- Fake Director failure creates visible failed-run evidence but never retries or falls back.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a project-scoped storyboard list and a stable Storyboard
  identity whose history remains readable after restart.
- **FR-002**: The system MUST allow an active project owner to create a storyboard from a creative
  description without invoking an external Provider.
- **FR-003**: The Fake Director MUST create exactly three ordered shots containing start state,
  action, end state, camera, composition, continuity requirements, and duration.
- **FR-004**: Fake output MUST be deterministic for the same normalized input and contract version,
  while every run and saved version retains distinct provenance.
- **FR-005**: Every generated proposal MUST append a Director run and a Storyboard version; Provider
  completion MUST NOT append approval.
- **FR-006**: Storyboard content MUST be append-only: saving any change creates a new immutable
  version linked to its parent and never edits an existing version in place.
- **FR-007**: Version creation MUST require the expected current head and reject stale writers without
  partial records.
- **FR-008**: The owner MUST be able to view the current head, inspect version history, compare two
  versions, and reopen any historical version read-only.
- **FR-009**: Incomplete drafts MAY be saved, but approval MUST require exactly three valid shots with
  unique order values 1 through 3.
- **FR-010**: Each shot MUST hold zero or more structured ShotAssetRequirements that embed the frozen
  `asset-candidate-v1` request and its canonical hash.
- **FR-011**: Candidate preview MUST reuse the Phase 2 hard-filtering service and return eligible,
  rejected, gaps, and result hashes without creating formal selection records.
- **FR-012**: Formal asset binding, manifest freezing, and storyboard approval MUST fail closed until
  the documented Phase 2 convergence gate is open.
- **FR-013**: Binding confirmation MUST revalidate project, identity, version, character state,
  lifecycle, owner approval, usage, viewpoint, shot scale, and media capability atomically.
- **FR-014**: A ShotAssetBinding MUST lock the selected ProductionAssetVersion,
  CharacterStateVersion where applicable, AssetVersionFile, and ProjectAsset rather than a mutable
  name or current-version pointer.
- **FR-015**: An AssetResolutionManifest MUST freeze the candidate policy version, requirement and
  candidate-result hashes, complete final binding set, and creation provenance.
- **FR-016**: Approval MUST append a StoryboardDecision for the current version and complete manifest;
  revocation MUST append a new decision instead of changing history.
- **FR-017**: Approval MUST NOT grant or imply permission for external AI, ComfyUI submission, video
  generation, QA acceptance, or final assembly.
- **FR-018**: All reads and writes MUST enforce project isolation and reject cross-project identities
  atomically.
- **FR-019**: APIs and UI MUST expose stable errors for version conflict, invalid shot count,
  candidate gap, Phase 2 gate closed, cross-project reference, unapproved asset, and non-ready file.
- **FR-020**: The existing single-shot spike contracts and default Provider behavior MUST remain
  backward compatible.
- **FR-021**: The project workspace MUST link to a separate storyboard list/editor rather than adding
  the editor to the existing long asset page.
- **FR-022**: All normal implementation and acceptance checks for this feature MUST record zero
  external AI, AI ranking, ComfyUI, and video-generation calls.

### Key Entities

- **Storyboard**: Stable project-scoped creative identity and current-head projection.
- **StoryboardVersion**: Immutable snapshot of creative description, exactly ordered shot drafts when
  approvable, parent version, source, contract version, and content hash.
- **ShotDraft**: One ordered shot's narrative, camera, composition, continuity, and duration content.
- **StoryboardDirectorRun**: Append-only provenance for a Fake proposal or failure.
- **ShotAssetRequirement**: Version-owned structured asset need using `asset-candidate-v1`.
- **ShotAssetBinding**: Exact, immutable selection of eligible semantic and physical asset versions.
- **AssetResolutionManifest**: Frozen set of requirement inputs, candidate results, and final bindings.
- **StoryboardDecision**: Append-only owner approval or revocation for one immutable version.
- **Phase2GateEvidence**: Read-only determination that the Phase 2 convergence acceptance ledger is
  complete; it is not a user-controlled bypass flag.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An owner can create and reopen a deterministic three-shot Fake proposal in under two
  minutes without technical identifiers or command-line interaction.
- **SC-002**: One hundred percent of saves preserve the prior version and reject stale-head writes
  without partial version, shot, requirement, or run records.
- **SC-003**: Every approvable version contains exactly three shots ordered 1–3 and a complete frozen
  manifest; every incomplete version is rejected with an explainable reason.
- **SC-004**: Candidate preview produces the same normalized input and output hashes for unchanged
  data and never restores a hard-filtered candidate.
- **SC-005**: Cross-project, stale, unapproved, inactive, and non-ready asset selections are rejected
  in all automated database and API scenarios.
- **SC-006**: Phase 2 gate-closed tests create zero bindings, manifests, or approval decisions; the
  gate-open scenario succeeds only after the recorded convergence evidence is present.
- **SC-007**: Existing single-shot spike contract and integration tests continue to pass unchanged.
- **SC-008**: A human reviewer can locate storyboards, edit and reorder shots, compare versions,
  understand asset gaps, and distinguish approval from generation authorization without assistance.
- **SC-009**: Full acceptance records `External Provider 0 / AI ranking 0 / ComfyUI 0 / video
generation 0`.
- **SC-010**: The project quality gates—format, lint, type check, automated tests, database validation,
  production build, secret scan, and diff check—all pass.

## Assumptions

- The application remains local, single-owner, and project-scoped.
- The first approvable storyboard has exactly three portrait-video shots; responsive desktop browser
  support is sufficient for this phase.
- Fake Director is the only enabled Storyboard Provider; adding a real Provider requires a separate
  feature, live gate, persisted authorization, and action-time confirmation.
- Phase 2 convergence remains owned by `specs/007-asset-understanding`; this feature consumes its
  frozen candidate contract and gate evidence without duplicating its requirements.
- No GenerationSpec, generation job, ComfyUI submission, AI QA, audio generation, or final assembly
  is included.
