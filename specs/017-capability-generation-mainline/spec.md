# Feature Specification: Dynamic Capability Generation Mainline

**Feature Branch**: `codex/017-capability-generation-mainline`

**Created**: 2026-08-27

**Status**: Draft

**Input**: Replace every previous product generation path with one dynamic, capability-driven
mainline; reset the scoped local data only after recoverable backups; then prepare, but do not
execute without new approval, one bounded LIVE test.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Plan and Run a Frozen Capability Attempt (Priority: P1)

An owner plans a storyboard shot using a registered capability. The product freezes the exact
execution identities, validates the resulting material, and performs at most the authorized
generation and independent quality-review calls without substituting another route.

**Why this priority**: This is the product's sole generation path and is the prerequisite for
credible, auditable video work.

**Independent Test**: With a test-only adapter, create a plan, preview, authorization, one-target
batch, attempt, artifact, and independent quality result; prove that a second submission cannot
occur and that an ambiguous result is terminal.

**Acceptance Scenarios**:

1. **Given** a valid capability and planning input, **When** the owner creates an execution plan,
   **Then** the plan preserves the exact implementation, runtime contract, provider, model,
   adapter, compiler, validator, graph digest, and reference selections.
2. **Given** an authorized one-target batch, **When** its worker performs an attempt, **Then** it
   consumes the respective authorization before the external call and submits only the frozen
   material.
3. **Given** an ambiguous submission outcome, **When** reconciliation cannot establish its state,
   **Then** the attempt stops terminally with no replacement or resubmission.
4. **Given** a technically valid artifact, **When** independent AI quality review is authorized,
   **Then** it consumes its own allowance once, records its result against the artifact, and never
   decides Owner approval, retry, or assembly.

---

### User Story 2 - Manage Capability-Driven Planning (Priority: P1)

An owner can use the Storyboard workspace to inspect dynamic planning and formally review a batch
without seeing retired provider/workflow controls, historical generation panels, or production
fake choices.

**Why this priority**: The UI must make the unique product path understandable and prevent an
operator from accidentally selecting a removed or simulated execution route.

**Independent Test**: Visit the Storyboard workspace in a zero-call environment and confirm that
only capability-driven planning, batch review, artifact review, Owner decision, retry preview, and
assembly are reachable.

**Acceptance Scenarios**:

1. **Given** an owner opens a storyboard, **When** planning is requested, **Then** the workspace
   shows dynamic capability choices and the resulting frozen execution facts.
2. **Given** a formal batch review, **When** the owner examines it, **Then** the product shows
   exact targets, limits, costs, expiry facts, artifacts, quality results, and Owner-decision
   choices.
3. **Given** production UI and APIs, **When** they are searched or exercised, **Then** retired
   generation controls, routes, codenames, and fake identities are unavailable.

---

### User Story 3 - Reset Local Product State Recoverably (Priority: P1)

An operator can replace the old local data model with the canonical model after creating
inspectable database and storage backups, knowing that prior local projects, assets, storyboards,
and generation records intentionally do not appear in the new product.

**Why this priority**: The product cannot have one truthful mainline while legacy records and
parallel schemas remain active.

**Independent Test**: Starting with representative old local records, verify the backup dump and
storage manifest, perform the reset, apply the clean baseline, and confirm only canonical empty
tables and empty active storage are reachable.

**Acceptance Scenarios**:

1. **Given** relevant processes are stopped, **When** reset preparation begins, **Then** the
   operator obtains a readable database dump and timestamped storage manifest with hashes before
   any reset action.
2. **Given** approved backup evidence, **When** the local reset completes, **Then** active storage
   is empty, backups are offline-only, and the database contains only the canonical schema.
3. **Given** the new schema, **When** an attempted update targets immutable lineage, **Then** the
   product rejects it and preserves append-only history.

---

### User Story 4 - Review an Exact One-Shot LIVE Preview (Priority: P2)

An owner can review a zero-call preview for Shot 1 of the red ceramic cup demonstration, including
all frozen identities, source hash, limits, price facts, and no-retry rules, before granting or
withholding a new action-time authorization.

**Why this priority**: A precise human decision is required before any irreversible provider or
quality-review cost.

**Independent Test**: With the worker stopped and all LIVE gates verified, produce the preview and
confirm that it creates no batch, provider task, generation call, or AI quality call.

**Acceptance Scenarios**:

1. **Given** the reset local state and verified source material, **When** the owner requests the
   preview for Shot 1, **Then** the product recalculates its new identifiers, plan digest, graph
   digest, and source hash for the specified four-second, 16:9, 2K, seed `887034974`, no-watermark
   configuration.
2. **Given** missing, expired, or unverified operational facts, **When** preview is requested,
   **Then** the product blocks before creating a batch and clearly names the missing fact.
3. **Given** a complete preview, **When** the owner has not granted a new exact confirmation,
   **Then** no worker or external generation/quality operation starts.

### Edge Cases

- A reference digest, runtime contract digest, or live runtime capability differs from the frozen
  planning material.
- An adapter reference is ambiguous for the frozen runtime or the runtime disallows a graph node.
- A worker restarts with a submitted or reconciling attempt.
- A database reset is requested while a related process is still active or backup proof is missing.
- A generation artifact is technically playable but quality review fails, times out, or is
  unavailable.
- A retry is requested without a real Owner `FAIL`, or assembly is requested before an Owner
  decision.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST have exactly one production generation lifecycle from planning
  through attempt, artifact, quality review, Owner decision, retry preview, and assembly.
- **FR-002**: The system MUST select a capability during planning and freeze every execution
  identity and digest before preview or batch creation.
- **FR-003**: The system MUST resolve an adapter only from exact frozen adapter and runtime
  references; no ambiguous resolution is permitted.
- **FR-004**: The system MUST validate frozen graph material against its runtime contract and the
  current allowed runtime facts before external submission.
- **FR-005**: The system MUST reject raw graph material supplied by a browser, language model, or
  worker outside the frozen planning record.
- **FR-006**: The system MUST expose only generic submission, status, and artifact-retention
  boundary actions and load their runtime contract from the attempt's implementation.
- **FR-007**: The system MUST consume generation and AI-quality authorizations separately before
  their respective external calls and persist each consumption.
- **FR-008**: The system MUST limit an authorized target to one generation submission and MUST
  stop on failure, timeout, or ambiguity without automatic fallback or retry.
- **FR-009**: The system MUST support restart reconciliation without duplicate submission.
- **FR-010**: The system MUST preserve technical artifact facts, playable media facts, three review
  frames, and independent quality results as immutable evidence.
- **FR-011**: The system MUST require a real Owner `PASS`, `FAIL`, or `RISK_ACCEPTED` decision;
  AI quality results MUST remain advisory.
- **FR-012**: The system MUST permit retry preview only after real Owner `FAIL` and MUST make retry
  and assembly operations concurrency-safe and idempotent.
- **FR-013**: The system MUST use one capability registry as the sole production registration
  source and give its first product release schema version 1.
- **FR-014**: The system MUST remove retired generation workers, provider abstractions, fixed
  workflow/provider profiles, record families, routes, exports, UI controls, and production fake
  identities; it MUST provide no compatibility read or dual-track fallback.
- **FR-015**: The system MUST use a single canonical data model for capability profiles, runtime
  contracts, implementations, requirements, planning snapshots, specs, references, graphs, plans,
  authorizations, batches, targets, consumptions, attempts, artifacts, AI-quality results, Owner
  decisions, retry previews, and assemblies.
- **FR-016**: The system MUST make the canonical execution lineage append-only and reject mutation
  that would overwrite recorded decision, evidence, consumption, or attempt facts.
- **FR-017**: The system MUST replace local migration history with one clean baseline derived from
  the canonical schema.
- **FR-018**: The system MUST require stopped related processes, a readable database dump, and a
  timestamped offline storage hash manifest before local reset.
- **FR-019**: The system MUST keep backups inaccessible to product reads and create empty active
  storage after reset; no old local records will be migrated.
- **FR-020**: The system MUST remove retired terms and version codenames from production types,
  services, database names, routes, and UI labels while retaining ordinary schema-version fields.
- **FR-021**: The system MUST make runtime readiness a live probe result rather than a manually
  configured readiness switch.
- **FR-022**: The system MUST expose the capability-driven Storyboard planning and formal batch
  review surfaces, while hiding retired shot-plan, provider/workflow selector, history, and fake
  product surfaces.
- **FR-023**: The system MUST produce a zero-call LIVE preview only after source, runtime,
  provider, quality, price, limit, and expiry facts are freshly verified.
- **FR-024**: The system MUST not treat a broad request as LIVE authorization; an exact preview
  requires a later action-time confirmation before a worker starts.
- **FR-025**: After a confirmed one-shot LIVE run, the system MUST stop after its artifact and
  independent quality result and wait for an Owner decision; it MUST not retry, assemble three
  shots, or auto-promote readiness.

### Key Entities _(include if feature involves data)_

- **Capability profile and runtime contract**: Registered execution capability and the allowed
  runtime facts it owns.
- **Generation implementation**: The exact provider/model/adapter/compiler/validator combination
  that is selected during planning.
- **Planning input, specification, reference plan, and materialized graph**: Immutable creative
  input and deterministic frozen material used for an execution plan.
- **Authorization, batch, target, and consumption**: The owner-approved scope, its individual
  work items, and irreversible call allowances.
- **Attempt, artifact, AI-quality result, Owner decision, retry preview, and assembly**: The
  append-only operational and review lineage for a target.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A one-target simulated run produces exactly one frozen plan, one attempt, and no more
  than one generation submission and one independently authorized quality call.
- **SC-002**: A simulated ambiguous submission, worker restart, or adapter ambiguity produces zero
  duplicate submissions.
- **SC-003**: Automated production-source checks find zero retired generation route, fixed workflow
  identifier, versioned capability/generation product symbol, or production fake identity.
- **SC-004**: Following reset, the active local database contains only canonical tables and
  constraints, old generation tables number zero, and active local storage contains zero old files.
- **SC-005**: The complete format, lint, type, test, database, build, secret, and diff validation
  suite passes before LIVE preflight.
- **SC-006**: A LIVE preview for the scoped Shot 1 produces zero external generation and quality
  calls until a new exact action-time confirmation is recorded.

## Assumptions

- The scoped local database is `127.0.0.1:5448/comfyuiflow`; its existing local data may be
  intentionally discarded only after verified backup evidence.
- The current red ceramic cup source material is available for controlled copy into empty active
  storage and its expected scene-image digest begins `8edca81a` and ends `5280a1`.
- LIVE Test A remains limited to Shot 1, one generation submission, one independent AI-quality
  call only after technical artifact success, and no automatic continuation.
- Existing ComfyUI/CodexManager credentials remain private environment material and may be used
  only for later preflight, never printed or committed.
