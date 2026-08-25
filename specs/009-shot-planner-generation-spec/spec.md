# Feature Specification: Shot Planner and GenerationSpec

**Feature Branch**: `codex/phase-0-discovery`

**Created**: 2026-08-25

**Status**: Approved for implementation

**Input**: Convert an approved 1–20-shot storyboard and its frozen asset-resolution manifest into an append-only, reviewable, provider-neutral Generation Plan without making external or video-generation calls.

## User Scenarios & Testing

### User Story 1 - Create a Deterministic Shot Plan (Priority: P1)

As the project owner, I can turn the currently approved variable-length storyboard into one local Shot Plan so each shot has an exact, inspectable GenerationSpec before any provider is selected.

**Independent Test**: Approve 1-, 4-, and 20-shot Storyboards with complete manifests, create plans twice with distinct idempotency keys, and verify that both persisted runs have distinct identities but identical normalized specifications and hashes for every source shot.

**Acceptance Scenarios**:

1. Given a current approved 1–20-shot storyboard version and its frozen manifest, creating a plan appends exactly one ordered GenerationSpec per source shot and performs zero external calls.
2. Given identical approved inputs and Planner version, repeated creation produces identical content and hashes while retaining separate plan identities.
3. Given an unapproved, revoked, stale, archived, cross-project, or manifest-less input, creation fails atomically with a stable explanation.

### User Story 2 - Edit, Compare, and Preflight Immutable Versions (Priority: P1)

As the project owner, I can refine prompts and provider-neutral constraints, compare immutable versions, and run a read-only preflight without overwriting history.

**Independent Test**: Open one plan in two browser sessions, save one edited version, observe a conflict from the stale session, compare both versions, and run preflight without creating a job or Provider attempt.

**Acceptance Scenarios**:

1. Saving any edit appends a GenerationPlanVersion linked to its parent and preserves the prior version unchanged.
2. A stale `If-Match` creates no version or partial GenerationSpec rows and returns the current head identity.
3. Preflight rechecks Storyboard approval, Manifest identity, exact file/reference state, and expected hashes without reading Provider credentials or submitting work.
4. A failed preflight returns stable per-shot blockers and never mutates the plan.

### User Story 3 - Explicitly Approve or Revoke the Plan (Priority: P2)

As the project owner, I can explicitly approve the current complete plan or append a revocation while seeing that neither action authorizes generation.

**Independent Test**: Approve a preflight-passing head version, reload it, revoke it, and verify both immutable decisions remain visible and every response says generation is not authorized.

**Acceptance Scenarios**:

1. Approval requires the current head, 1–20 valid source-aligned specifications, and a passing preflight.
2. Approval and revocation append decisions rather than mutating previous records.
3. An approved plan exposes `generationAuthorized: false` and creates no grant, GenerationJob, Provider request, ComfyUI submission, Artifact, or QA result.

### Edge Cases

- A Storyboard edit or approval revocation after plan creation makes preflight fail with `MANIFEST_STALE` or `STORYBOARD_NOT_APPROVED`; historical plan versions remain readable.
- Any reference that becomes removed, non-ready, unapproved, cross-project, or hash-inconsistent blocks preflight.
- Owner-edited prompts may be empty drafts only before approval; approval requires every positive prompt and structured field to validate.
- Duplicate idempotency keys return the original result only when the request hash matches; reuse with different content fails.
- Provider names, workflow IDs, ComfyUI node names, credentials, local paths, and raw binary/Base64 content are rejected from the public contract.
- Archived projects remain readable but cannot create plans, append versions, or decide approval.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST create a stable project-scoped GenerationPlan only from a currently approved StoryboardVersion and its exact AssetResolutionManifest.
- **FR-002**: Deterministic planning MUST create exactly one GenerationSpec for each of 1–20 ordered source Storyboard shots.
- **FR-003**: The same normalized inputs and Planner version MUST produce identical specification content, input/reference/output hashes, and prompt text.
- **FR-004**: Every create request MUST retain its own plan identity and provenance while idempotent replay returns the original matching result.
- **FR-005**: GenerationPlanVersion and GenerationSpec content MUST be append-only and linked to their parent/source identities.
- **FR-006**: Owner edits MUST append a new version using optimistic concurrency and MUST NOT overwrite older content.
- **FR-007**: Every GenerationSpec MUST include source identities, narrative states, camera, composition, continuity, duration, normalized positive prompt, exact reference facts, capability requirements, and canonical hashes.
- **FR-008**: Exact references MUST identify the requirement, ProductionAssetVersion, optional CharacterStateVersion, AssetVersionFile, ProjectAsset, SHA-256, and ReferenceUsage.
- **FR-009**: Capability requirements MUST remain provider-neutral and express reference-to-video mode, aspect ratio, duration, reference count, and audio requirement.
- **FR-010**: Public and persisted GenerationSpec content MUST reject Provider, model, workflow, node, credential, absolute-path, Base64, and binary payload fields.
- **FR-011**: A read-only preflight MUST re-evaluate current Storyboard approval, Manifest identity, binding completeness, project isolation, file readiness, binding approval, and expected hashes.
- **FR-012**: Preflight MUST return stable plan-level and per-shot blockers and MUST create no durable records.
- **FR-013**: Approval MUST require the current plan head, 1–20 source-aligned valid specs, and a passing preflight.
- **FR-014**: Approval and revocation MUST append GenerationPlanDecision events and maintain only derived current/approved projections.
- **FR-015**: All writes MUST reject archived projects and cross-project identities atomically.
- **FR-016**: Create and decision writes MUST support safe idempotency and request-hash mismatch rejection; version appends MUST use parent identity plus optimistic concurrency.
- **FR-017**: Reads MUST expose plan history, immutable versions, comparisons, preflight results, decision history, and safe stable errors without sensitive paths or payloads.
- **FR-018**: The Storyboard UI MUST link to a separate Shot Plan view that explains references, blockers, versions, approval state, and the zero-generation boundary.
- **FR-019**: Plan approval MUST always return and display `generationAuthorized: false`.
- **FR-020**: This feature MUST create zero AiModelProvider, Provider, ComfyUI, video-generation, GenerationJob, Artifact, or QA calls/records.
- **FR-021**: Existing single-shot, asset-understanding, candidate, and Storyboard contracts MUST remain backward compatible.
- **FR-022**: Database migration MUST be additive and preserve all existing Storyboard, Manifest, binding, decision, ProjectAsset, and binary data.

### Key Entities

- **GenerationPlan**: Stable identity bound to one approved StoryboardVersion and Manifest, with head/approved projections and row version.
- **GenerationPlanVersion**: Immutable deterministic or owner-authored snapshot with canonical input/output hashes and parent linkage.
- **GenerationSpec**: One immutable provider-neutral execution intention for one exact Storyboard shot and its locked references.
- **GenerationPlanDecision**: Append-only APPROVED or REVOKED owner decision that never grants generation authority.
- **GenerationPlanPreflight**: Non-persisted validation result with stable blockers and zero-call facts.

## Success Criteria

- **SC-001**: A user can create and reopen a complete 1–20-shot plan in under two minutes without technical identifiers or command-line interaction.
- **SC-002**: One hundred percent of unchanged normalized inputs produce identical spec and hash output.
- **SC-003**: One hundred percent of saves preserve prior versions and stale writers create zero partial records.
- **SC-004**: Every accepted plan contains exactly one ordered specification per source shot whose references can be traced to the frozen Manifest.
- **SC-005**: All unapproved, stale, cross-project, non-ready, unapproved-binding, and hash-mismatch cases are rejected with stable blockers.
- **SC-006**: Preflight completes within two seconds for a 1–20-shot MVP plan and performs zero writes.
- **SC-007**: A reviewer can compare versions, understand every blocker, approve/revoke, and distinguish plan approval from generation authorization without assistance.
- **SC-008**: Existing Phase 0–3 automated suites remain compatible.
- **SC-009**: Full acceptance records `AI 0 / Provider 0 / ComfyUI 0 / video generation 0`.
- **SC-010**: Format, lint, type, automated tests, isolated database, migration rehearsal, production build, secret scan, diff check, and browser QA pass.

## Assumptions

- The application remains local, single-owner, project-scoped, and portrait-video oriented.
- Deterministic Planner v1 uses only approved Storyboard and Manifest facts; AI planning is a separate future feature.
- Owner edits are limited to provider-neutral GenerationSpec fields and do not change the frozen Storyboard or Manifest.
- Phase 5 will map an approved GenerationSpec to a Provider/workflow under a separate action-time authorization.
- Human QA for Phase 2/3 was recorded as PASS in task `01a03663-5cc7-7ad3-8ba2-e37e927639e1`; Phase 4 does not reinterpret that creative decision.

## Out of Scope

- GenerationJob, execution grants, Provider/model selection, workflow materialization, ComfyUI submission, polling, retry, Artifact ingestion, AI QA, audio generation, assembly, and publishing.
- Automatic plan approval, automatic fallback, automatic retry, or conversion of plan approval into generation permission.
