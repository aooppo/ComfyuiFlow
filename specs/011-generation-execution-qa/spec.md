# Feature Specification: Generation Execution and QA

**Feature Branch**: `codex/011-generation-execution-qa`

**Created**: 2026-08-25

**Status**: Approved for zero-call implementation; LIVE acceptance requires action-time confirmation

**Input**: Implement the approved Phase 5-6 plan for selectable shot generation, bounded execution,
durable artifacts, technical validation, advisory frame-based AI QA, and explicit owner QA.

## Clarifications

### Session 2026-08-25

- Q: How far should delivery proceed? -> A: Build the complete live-ready path and stop for a fresh action-time confirmation before at most one real H3 call followed by one AI QA call.
- Q: Which shots may be submitted? -> A: The owner may select a compatible subset; incompatible shots remain visible but cannot be selected.
- Q: What completes QA? -> A: Technical validation, real CodexManager frame-based AI QA, and an explicit owner PASS or FAIL.
- Q: How are H3 and AI QA authorized? -> A: One combined confirmation with separate exact call budgets; AI QA is conditional on the exact technically valid artifact from its job.
- Q: What pauses a batch? -> A: Provider, ambiguous, or technical artifact failure pauses remaining work; AI QA is advisory and does not pause the batch.

## User Scenarios & Testing

### User Story 1 - Preview Compatible Shots (Priority: P1)

As the project owner, I can select shots from an approved Shot Plan and see exactly which shots are
compatible, what will be sent, and the maximum calls before authorizing anything.

**Why this priority**: A paid generation action is safe only when scope, inputs, constraints, and
cost exposure are understandable before the call boundary.

**Independent Test**: Preview a mixed compatible/incompatible plan, select compatible shots, and
verify blockers, five reference roles, prompt summary, workflow identity, and call caps with zero
external calls or durable authorization records.

**Acceptance Scenarios**:

1. **Given** an approved current PlanVersion with compatible shots, **When** the owner previews a
   subset, **Then** every selected shot receives a deterministic compatible result and preview hash.
2. **Given** a shot with a stale hash, wrong duration/aspect, missing or ambiguous H3 role, or
   unverified file, **When** preview runs, **Then** it is blocked with stable explanations and cannot
   be authorized.
3. **Given** a preview, **When** it completes, **Then** no authorization, job, Provider call,
   ComfyUI submission, or AI QA call is created.

---

### User Story 2 - Execute an Exact Authorized Batch (Priority: P1)

As the project owner, I can confirm a selected batch once and have a single-concurrency worker run
each exact shot without retry, fallback, or hidden substitutions.

**Why this priority**: This is the first product path that turns an approved GenerationSpec into a
durably tracked video-generation attempt.

**Independent Test**: Use Fake generation for a four-shot subset and verify one job per shot, one
generation and conditional AI QA budget per job, ordered execution, retained evidence, and no real
network calls.

**Acceptance Scenarios**:

1. **Given** an unchanged preview and explicit checked confirmation, **When** the batch is created,
   **Then** its targets, authorization, jobs, scope hash, expiry, workflow, and separate call budgets
   are persisted atomically.
2. **Given** a queued target, **When** the worker starts its only submission attempt, **Then** the
   target's generation authorization is consumed before the network boundary.
3. **Given** a provider failure, ambiguous submission, or technical artifact failure, **When** it is
   recorded, **Then** remaining jobs pause and no automatic retry, fallback, refund, or replacement
   occurs.
4. **Given** an ambiguous job with its preselected task identity, **When** reconciliation runs, **Then**
   only that task is polled or collected and no submit path is available.
5. **Given** a prior failed or rejected job, **When** the owner wants another attempt, **Then** a new
   preview, job, scope, and authorization are required and the original history is unchanged.

---

### User Story 3 - Inspect and Decide QA (Priority: P1)

As the project owner, I can inspect the retained video, technical facts, deterministic review frames,
and advisory AI findings before recording my own PASS or FAIL.

**Why this priority**: Provider completion is not evidence that a shot is playable, faithful, or
creatively acceptable.

**Independent Test**: Complete one Fake job, verify one retained MP4 and three hashed review frames,
produce a structured Fake AI QA result, and append an owner decision without altering any earlier
evidence.

**Acceptance Scenarios**:

1. **Given** a completed Provider task, **When** artifacts are retained, **Then** exactly one playable
   MP4 is hash-verified and its media and audio facts are persisted outside the source asset catalog.
2. **Given** a technically valid artifact, **When** QA preparation runs, **Then** first, middle, and
   near-final review frames are deterministically retained with timestamps, hashes, and extractor
   version.
3. **Given** a valid artifact under an unconsumed combined authorization, **When** real AI QA runs,
   **Then** it uses only the five exact references, three review frames, technical facts, and expected
   GenerationSpec, consumes one AI QA call, and returns a strict advisory result.
4. **Given** any AI QA result, **When** it is displayed, **Then** motion and audio semantics remain
   explicitly not assessable and no human decision is inferred.
5. **Given** an artifact awaiting review, **When** the owner records PASS or FAIL, **Then** the decision
   is appended and only PASS is eligible for a future assembly phase.

### Edge Cases

- A selected set contains duplicates, a target outside the approved version, or more than 20 shots.
- An approved plan changes, is revoked, or its project/Storyboard is archived after preview.
- Two tabs submit the same or conflicting preview and idempotency key.
- A source file has the same size but different bytes when revalidated before staging.
- More than one file matches an H3 role, the character roles do not share one character version, or
  the rear reference lacks a rear/rear-three-quarter viewpoint.
- Authorization expires after queueing but before a target reaches the network boundary.
- Provider submission loses its response after the preselected task identity is sent.
- Provider returns zero, multiple, empty, non-video, corrupt, or technically incompatible artifacts.
- Frame extraction or AI QA fails after the video itself is retained.
- A cancellation races with claim, submission, completion, or reconciliation.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST allow selection of 1-20 unique shots from the currently approved
  GenerationPlanVersion and reject targets outside that version.
- **FR-002**: Preview MUST be read-only, deterministic, project-scoped, and report per-shot
  compatibility, stable blockers, exact references, compiled prompt facts, workflow identity,
  estimated H3 cost, AI QA price visibility, and maximum call counts.
- **FR-003**: The H3 v1 profile MUST require exactly 9:16, 4 seconds, 768x1344, 24fps, no required
  audio, and five unambiguous Scene, Product, Full Body, Face, and Rear roles.
- **FR-004**: Preview and execution MUST revalidate approved bindings, local file readiness, media
  facts, project ownership, and streaming SHA-256 without changing the approved GenerationSpec.
- **FR-005**: Provider prompts MUST be deterministic, versioned, hash-bound, owner-reviewable, and
  compiled from provider-neutral facts; ordinary requests MUST NOT supply Provider endpoints,
  workflow JSON, node identifiers, credentials, or output paths.
- **FR-006**: Batch creation MUST atomically persist exact targets, one immutable scope, expiry,
  Provider/model/workflow snapshots, and separate generation and AI QA budgets after explicit
  confirmation of an unchanged preview.
- **FR-007**: Each GenerationJob MUST permit at most one submission; authorization MUST be consumed
  transactionally before its external call and is not refunded for failure, timeout, or ambiguity.
- **FR-008**: Processing MUST be single-concurrency and ordered; technical failure or ambiguity MUST
  pause remaining targets while advisory AI QA findings MUST NOT pause the batch.
- **FR-009**: Reconciliation MUST be query-only for the recorded task identity and MUST expose no
  submit, fallback, or replacement behavior.
- **FR-010**: A repeat attempt MUST create a new linked Job, preview, and authorization while
  preserving the original Job, events, calls, artifacts, and reviews.
- **FR-011**: Generated binaries MUST use a generated-artifact storage namespace outside the source
  asset catalog, while business metadata and lineage remain project-scoped durable records.
- **FR-012**: Technical validation MUST require exactly one non-empty playable MP4 and record SHA-256,
  byte size, container, video/audio codecs, dimensions, frame rate, duration, bitrate, and audio facts.
- **FR-013**: QA preparation MUST retain first, middle, and near-final review frames with deterministic
  timestamps, extractor version, storage identity, and SHA-256.
- **FR-014**: AI QA MUST use the CodexManager Local provider, fixed loopback endpoint, registered
  `gpt-5.4` alias, strict structured output, `store:false`, zero retries, and at most one call per
  technically valid target.
- **FR-015**: AI QA MUST classify identity, wardrobe/state, product structure, scene, composition,
  cross-frame continuity, visual damage, and unexpected objects as PASS/WARN/FAIL/NOT_ASSESSABLE with
  evidence and confidence; motion quality and audio meaning MUST remain NOT_ASSESSABLE.
- **FR-016**: AI QA is advisory only. Human PASS/FAIL decisions MUST be append-only, remain blank until
  explicitly submitted, and never cause automatic retry, approval, assembly, or publication.
- **FR-017**: LIVE generation and LIVE AI QA MUST default disabled. Fake providers MUST cover the full
  automated path with zero external calls.
- **FR-018**: The Project Worker MUST reach ComfyUI only through the registered MCP tool boundary and
  MUST NOT add a direct HTTP execution path.
- **FR-019**: APIs and logs MUST return stable safe errors and never expose credentials, absolute
  storage paths, Base64 data, raw workflow payloads, or secret-bearing Provider responses.
- **FR-020**: Cancellation MUST fail closed when unsupported, preserve evidence, and never imply a
  refund or confirmed remote termination.
- **FR-021**: Existing Phase 0-4 data, workflows, and tests MUST remain readable and behaviorally
  compatible; historical workflow files and spike evidence MUST not be rewritten or auto-imported.
- **FR-022**: A real acceptance attempt MUST remain a separately authorized operation capped at one
  H3 submission and, only after technical success, one CodexManager AI QA call.

### Key Entities

- **GenerationBatch**: One confirmed ordered subset of an approved plan and its projected state.
- **GenerationBatchTarget**: One exact selected GenerationSpec and its immutable preview facts.
- **ExecutionAuthorization**: Time-bounded combined permission with independent operation budgets.
- **AuthorizationConsumption**: One irreversible use of an authorization budget for an exact target.
- **GenerationJob**: One and only one possible Provider submission attempt for a target.
- **GenerationJobEvent**: Append-only lifecycle evidence for claims, calls, statuses, and failures.
- **GeneratedArtifact**: Retained generated binary identity and complete source lineage.
- **ArtifactTechnicalCheck / ArtifactReviewFrame**: Append-only technical and visual-review evidence.
- **AiQaRun / AiQaResult**: One bounded advisory structured review and its Provider provenance.
- **HumanQaDecision**: Explicit owner PASS or FAIL that does not mutate prior evidence.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can preview and understand a 1-20-shot selection in under two seconds in the
  Fake/ready local environment, with 100 percent of incompatible shots carrying stable explanations.
- **SC-002**: Unchanged inputs produce byte-identical preview, prompt, authorization-scope, and target
  hashes in 100 percent of repeated tests.
- **SC-003**: Every accepted batch creates exactly one target and one initial Job per selected shot,
  and no Job can produce more than one submission call.
- **SC-004**: Provider/ambiguous/technical failures start zero later submissions until a new owner
  confirmation, while reconciliations create zero submissions.
- **SC-005**: Every technically accepted result has exactly one retained MP4, complete media facts,
  and exactly three hashed deterministic review frames.
- **SC-006**: Every AI QA result traces to one Artifact, five source references, three review frames,
  one model response, and no more than one external AI call.
- **SC-007**: One hundred percent of completed automated acceptance records Generation Provider 0,
  ComfyUI 0, CodexManager 0, and video generation 0 through Fake providers.
- **SC-008**: Human QA remains blank after all technical and AI steps until the owner explicitly
  submits PASS or FAIL, and only PASS is marked future-assembly eligible.
- **SC-009**: Existing Phase 0-4 automated suites remain compatible and migration rehearsal preserves
  all existing project, Storyboard, plan, specification, and hash counts.
- **SC-010**: Formatting, lint, type checks, unit/contract/default tests, sequential isolated
  PostgreSQL tests, migration rehearsal, production build, secret scan, diff check, and browser QA pass.
- **SC-011**: After separate action-time confirmation, live acceptance records at most one H3 call
  and one conditional AI QA call with no retry, fallback, or automatic Human QA decision.

## Assumptions

- The application remains local, single-owner, project-scoped, portrait-video oriented, and uses a
  standalone single-concurrency worker.
- Fake is the automated default; LIVE environment gates and credentials are server-only.
- The H3 estimate is informational and timestamped; Provider settlement remains authoritative.
- If CodexManager cannot expose a currency estimate, confirmation explicitly acknowledges one
  unpriced external AI call rather than inventing a price.
- AI QA uses still frames and cannot establish motion quality or audio semantics.

## Out of Scope

- Full-video or audio-semantic AI QA, 15-second or 2K workflows, additional generation Providers,
  arbitrary workflow editing, automatic retry/fallback, assembly, publishing, and automatic import
  of historical Phase 0 spike output.
