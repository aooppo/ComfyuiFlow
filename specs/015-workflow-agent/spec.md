# Feature Specification: Workflow Agent and Cross-Shot Execution

**Feature Branch**: `codex/015-workflow-agent`
**Created**: 2026-08-26
**Status**: Approved for implementation; no LIVE AI or video call is authorized
**Input**: Implement the approved Workflow Agent, per-shot execution, cross-shot dependency, and
blocked-shot repair plan while preserving all existing execution evidence and safety gates.

## User Scenarios & Testing

### User Story 1 - Plan Every Shot Against Real Capabilities (Priority: P1)

As the owner, after confirming a Storyboard I receive a deterministic execution preview in which
each selected Shot is matched to a technically available implementation, or is clearly marked as a
trial, blocked, or waiting on an upstream Shot.

**Why this priority**: No generation can be safely authorized until the system can separate creative
requirements from provider capabilities and produce an executable, explainable plan per Shot.

**Independent Test**: Given a confirmed Storyboard and a recorded capability snapshot, repeat the
planning operation twice and verify identical selections, reasons, dependencies, costs, and plan
template hashes without any external call.

**Acceptance Scenarios**:

1. **Given** a confirmed Storyboard with complete assets, **When** automatic planning runs, **Then**
   each Shot receives one immutable requirement specification and one explainable execution state.
2. **Given** AUTO, PREFERRED, and LOCKED choices, **When** candidates are filtered and ranked,
   **Then** hard incompatibilities are rejected, explicit priorities are honored, and any preference
   fallback is explained.
3. **Given** two equivalent planning inputs, **When** planning is repeated, **Then** candidate order,
   selected implementations, snapshots, costs, and plan template hashes are identical.
4. **Given** a missing adapter, credential, price, runtime capability, or required input, **When**
   planning runs, **Then** the Shot is blocked with a stable error code and no job or external call.

---

### User Story 2 - Confirm One Mixed-Implementation Batch (Priority: P1)

As the owner, I review one aggregate preview and confirm one Batch even when different Shots use
different providers, models, executors, or implementations.

**Why this priority**: The current single-profile Batch cannot execute a real multi-Shot plan and
forces provider decisions too early.

**Independent Test**: Confirm a zero-call mixed-plan fixture and verify one atomic transaction
freezes every selected Shot plan, exact cost and call ceilings, authorization, targets, and jobs;
any stale or unknown-cost input rolls the transaction back completely.

**Acceptance Scenarios**:

1. **Given** all selected Shots are READY or explicitly labeled FIRST REAL TRIAL, **When** the owner
   confirms the preview, **Then** the complete plan, snapshots, symbolic dependencies, maximum cost,
   call limits, and authorization are frozen atomically.
2. **Given** one Shot is BLOCKED or cost is unknown, **When** confirmation is attempted, **Then** no
   authorization, target, or job is created.
3. **Given** legacy generation history, **When** a new mixed Batch is created, **Then** old Batches
   remain readable and continue through the legacy path.
4. **Given** a confirmed Batch, **When** a Shot is dispatched, **Then** the worker uses that Shot's
   frozen implementation rather than a process-wide provider choice.

---

### User Story 3 - Execute Shots in Dependency Order (Priority: P1)

As the owner, I can generate a sequence in which a downstream Shot starts from the true final frame
of a completed upstream Shot, while unaffected Shots and valid artifacts are preserved.

**Why this priority**: Cross-Shot continuity is the central reason for introducing a Workflow Agent
instead of running independent fixed workflows.

**Independent Test**: Execute a two-Shot fixture in which Shot 2 depends on Shot 1, extract and hash
the last decoded frame, materialize the downstream input, and prove Shot 2 cannot run before Shot 1
is technically valid.

**Acceptance Scenarios**:

1. **Given** a valid acyclic Shot dependency graph, **When** the worker claims work, **Then** it
   chooses only runnable targets in stable topological and Shot order.
2. **Given** an upstream technical success, **When** a downstream final-frame dependency resolves,
   **Then** the exact last decoded video frame is persisted, verified, hashed, and bound as the
   downstream first frame.
3. **Given** an upstream failure or ambiguous submission, **When** downstream work is evaluated,
   **Then** downstream targets remain waiting and no paid submission occurs.
4. **Given** an unchanged successful Shot and unchanged inputs, **When** an affected Batch is
   replanned, **Then** its verified artifact is reused without a new job or authorization charge.
5. **Given** a changed upstream plan or artifact, **When** dependency materialization runs, **Then**
   the downstream plan is invalidated rather than silently binding a different file.

---

### User Story 4 - Repair Only Blocked Shots (Priority: P2)

As the owner, when a Shot cannot be planned I receive actionable repair choices and can repair only
that Shot and its dependency closure without losing unaffected work.

**Why this priority**: A repairable capability mismatch must not become a whole-project failure or
cause unnecessary paid regeneration.

**Independent Test**: Start with one blocked Shot and one independent completed branch, apply each
deterministic repair type in fixtures, and verify only the blocked Shot and transitive dependants are
replanned while the independent artifact remains reusable.

**Acceptance Scenarios**:

1. **Given** a direct blocker, **When** repair options are requested, **Then** the owner sees stable
   CHANGE_IMPLEMENTATION, RELAX_REQUIREMENT, REWRITE_SHOT, SPLIT_SHOT, or REPLACE_ASSET proposals
   with impact, call, cost, and creative-effect details.
2. **Given** a deterministic implementation change or accepted relaxation, **When** it is applied,
   **Then** no AI Director call occurs and only the affected dependency closure is replanned.
3. **Given** an owner-triggered rewrite or split, **When** the separate Director authorization is
   consumed, **Then** one immutable repair proposal is produced without retry or fallback.
4. **Given** an adopted rewrite or split, **When** the Storyboard changes, **Then** a new reversible
   version is appended, unaffected stable Shot keys are preserved, and affected requirement specs
   and plans are regenerated.
5. **Given** a stale repair proposal, **When** adoption is attempted, **Then** it is rejected without
   changing the Storyboard or consuming a video authorization.

---

### User Story 5 - Continue Automatically Until Final Review (Priority: P2)

As the owner, after one Batch confirmation I can let technically valid Shots continue automatically
through advisory AI QA, then review all results together before assembly.

**Why this priority**: The normal product path should not require a separate manual gate after every
derived manifest, plan, continuity state, keyframe, or Shot.

**Independent Test**: Run a zero-call execution fixture covering PASS, WARN, NOT_ASSESSABLE, hard
FAIL, and AMBIGUOUS outcomes and verify the configured continuation policy advances or pauses the
dependency graph exactly as previewed.

**Acceptance Scenarios**:

1. **Given** the default continuation policy, **When** a Shot is technically valid and AI QA returns
   PASS, WARN, or NOT_ASSESSABLE, **Then** the next runnable Shot may proceed automatically.
2. **Given** technical failure, ambiguity, or a high-confidence hard-criterion failure, **When** the
   result is recorded, **Then** the Batch pauses before any dependent paid submission.
3. **Given** all targets are complete or reused, **When** execution finishes, **Then** the Batch waits
   for one unified Owner review; AI QA never fabricates Owner approval.
4. **Given** the optional pause-after-each-Shot policy, **When** a Shot completes, **Then** execution
   pauses without changing the immutable Batch plan.

---

### User Story 6 - Operate and Roll Back Safely (Priority: P3)

As an operator, I can see whether the database, worker, generation runtime, credentials, quota,
prices, and implementations are ready, and can disable real generation or return new work to the
legacy engine without erasing history.

**Why this priority**: The feature spans local infrastructure and paid providers; failures must be
visible and rollback must fail closed.

**Independent Test**: With real generation disabled, exercise readiness and rollback fixtures and
verify zero external calls, preserved plans/evidence, and continued legacy-history readability.

**Acceptance Scenarios**:

1. **Given** one unavailable dependency, **When** readiness is viewed, **Then** its business-level
   status and blocker are shown without exposing credentials, paths, raw graphs, or endpoints.
2. **Given** real generation is disabled, **When** new work reaches dispatch, **Then** no provider
   submission occurs while status and reconcile of already-submitted work remain available.
3. **Given** the engine is returned to legacy mode, **When** old and new history is opened, **Then**
   all plans, evidence, artifacts, QA, and Owner decisions remain readable.

### Edge Cases

- The Shot graph contains a cycle, self-dependency, missing Shot, or cross-project reference.
- A READY implementation loses a required node, credential, region, quota, or current price after
  preview but before confirmation or dispatch.
- A TRIAL implementation succeeds technically, fails technically, or returns an ambiguous result.
- Two tabs confirm the same preview, accept the same repair, or replan against different heads.
- The worker stops after cost reservation or authorization consumption but before receiving a
  provider task identifier.
- The upstream video is variable-frame-rate, has no decodable frame, has audio only, or produces an
  extracted frame with the wrong dimensions or media type.
- A completed artifact exists but its hash, technical status, requirement hash, plan hash, or
  dependency input hash no longer matches.
- AI QA cost would exceed the Batch ceiling after generation cost has already been consumed.
- A registry definition is removed or changed while historical plans still reference its version.
- A user selects an unimplemented direct provider or requests first-plus-last-frame control that has
  not passed a real trial.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST derive one immutable ShotRequirementSpec per source Shot containing
  creative and continuity facts but no provider, model, workflow, node, graph, or credential choice.
- **FR-002**: Planning MUST deterministically derive technical requirements, candidates, blockers,
  dependencies, selection reasons, cost estimates, and plan template hashes with zero external calls.
- **FR-003**: The implementation registry MUST distinguish provider, model, executor, implementation,
  version, status, constraints, price, readiness, and technical evidence.
- **FR-004**: AUTO, ordered PREFERRED families, exact LOCKED provider/model, Storyboard default, and
  Project default MUST follow the documented precedence and fail closed on incompatibility.
- **FR-005**: Candidate selection MUST apply all hard capability, input, adapter, runtime,
  credential, region, quota, policy, and cost filters before deterministic weighted ranking.
- **FR-006**: Selection MUST optimize the whole acyclic Storyboard in stable topological order and
  include explicit model, provider, and implementation switching penalties.
- **FR-007**: Every filtered candidate, preference fallback, score vector, readiness/evidence fact,
  switching penalty, cost, latency, and trial risk MUST be explainable to the owner.
- **FR-008**: Each ShotExecutionPlan MUST use exactly one trusted graph executor or direct-provider
  executor and MUST be immutable after freezing; invalidation and supersession append new records.
- **FR-009**: Trusted graph plans MUST use only server-owned reference workflows, patterns, blocks,
  node metadata, bindings, and safe output rules; model-generated executable graphs are forbidden.
- **FR-010**: Graph validation MUST reject unknown classes or fields, incompatible edges, cycles,
  orphaned outputs, disallowed nodes, unsafe paths, credentials, endpoints, downloads, and commands.
- **FR-011**: Direct-provider plans MUST reference only registered adapters and server-owned endpoint
  profiles; credentials and raw endpoints MUST remain outside frozen plans and public responses.
- **FR-012**: A Batch MUST support different frozen implementations per target and MUST atomically
  freeze plans, snapshots, symbolic dependencies, costs, call limits, authorization, targets, and jobs.
- **FR-013**: Confirmation MUST reject blocked, stale, unknown-cost, over-budget, mismatched-hash, or
  unavailable plans without partial writes or external calls.
- **FR-014**: Worker dispatch MUST load the target's frozen adapter and MUST never perform automatic
  retry, resubmission, provider fallback, or model fallback.
- **FR-015**: The worker MUST claim only dependency-ready targets in stable topological, ordinal, and
  Shot-key order, preserving the existing single-concurrency lease boundary.
- **FR-016**: Previous-final-frame dependencies MUST bind the exact authorized upstream target and
  plan, the first technically valid artifact, and a versioned deterministic extractor.
- **FR-017**: The dependency extractor MUST use the last decodable video frame, persist its index,
  timestamp, media facts, and hash, and MUST NOT reuse an approximate QA review frame.
- **FR-018**: Downstream submission MUST materialize and hash exact upstream artifact and frame inputs;
  any mismatch or upstream replacement MUST invalidate the downstream plan.
- **FR-019**: A completed artifact MAY be reused only when requirement, plan, dependency input, hash,
  and technical-validity checks all match; reuse MUST consume no new video authorization.
- **FR-020**: Planning blockers MUST produce deterministic structured repair proposals with direct
  and transitive impact, creative effect, predicted capabilities, calls, cost, and proposal hash.
- **FR-021**: Implementation changes and accepted requirement relaxation MUST be deterministic and
  zero-call; relaxation MUST preserve exact changed path, original hardness, new hardness, and reason.
- **FR-022**: Rewrite and split repairs MUST reuse the existing bounded AI Director run lifecycle,
  require a separate action-time authorization, use strict structured output, and never retry/fallback.
- **FR-023**: Adopting a repair MUST append a reversible Storyboard version, preserve unaffected stable
  Shot keys, revalidate copied bindings, and replan only the affected dependency closure.
- **FR-024**: Default continuation MUST advance after technical validity plus PASS, WARN, or
  NOT_ASSESSABLE AI QA, and pause on technical failure, ambiguity, budget exhaustion, or an explicit
  high-confidence hard-criterion failure.
- **FR-025**: AI QA and generation cost/call ceilings MUST be included in one immutable Batch cost
  snapshot and transactionally reserved before each authorized network attempt.
- **FR-026**: A successful real TRIAL MUST promote only technical implementation evidence to READY;
  technical failure or ambiguity MUST block that version, while creative and Owner judgments remain
  independent.
- **FR-027**: The new owner interface MUST show business-language planning, repair, dependency,
  progress, cost, and final-review states while hiding raw graphs, node identifiers, task IDs, hashes,
  credentials, endpoints, and local paths by default.
- **FR-028**: The normal path MUST require Storyboard confirmation and one video Batch confirmation;
  derived validation is automatic, advanced continuity/keyframe gates are optional, and final Owner
  review remains explicit.
- **FR-029**: Fake generation MUST remain available only for tests and legacy compatibility and MUST
  not appear in the new default registry, owner workflow, or MVP acceptance.
- **FR-030**: New persistence MUST be additive and append-only, preserve all GenerationSpec V1,
  legacy Batch, Director, continuity, artifact, QA, and Owner-decision history, and avoid destructive
  rollback migrations.
- **FR-031**: Runtime tools MUST expose allowlisted node discovery, static graph validation,
  readiness, and execution-by-frozen-plan without accepting arbitrary local paths or public graph data.
- **FR-032**: Readiness MUST report database, worker, generation runtime, bridge, credential, quota,
  price, and implementation status without exposing secrets or machine-specific configuration.
- **FR-033**: Operators MUST be able to disable new real submissions and select the legacy engine;
  already-submitted work may only be queried, retained, cancelled where supported, or reconciled by
  its original task identifier or idempotency key.
- **FR-034**: Existing trusted H3 reference workflow bytes and hashes MUST remain unchanged; its
  evidence may be backfilled idempotently, while first-frame use starts as a real-task TRIAL and
  first-plus-last-frame remains unavailable until separately proven.
- **FR-035**: All automated implementation and acceptance MUST make zero Director, AI QA, ComfyUI,
  or video-provider calls; every real validation scenario requires a later refreshed scope, current
  price/quota/credential facts, exact call/cost limits, and fresh action-time owner confirmation.

### Key Entities

- **ShotRequirementSpec**: Immutable creative, asset, timing, framing, and dependency facts for one
  source Shot, independent of any execution provider.
- **GenerationImplementation**: A versioned provider/model/executor capability with lifecycle,
  readiness, constraints, and evidence identity.
- **GenerationImplementationEvidence**: Append-only technical outcomes tied to one implementation
  version; excludes creative and Owner approval.
- **ShotExecutionPlan**: Immutable per-Shot executable plan, snapshots, costs, symbolic dependencies,
  template hash, materialized hash, status, and supersession lineage.
- **CapabilitySnapshot**: Exact registry, runtime, price, readiness, evidence, and policy inputs used
  for planning.
- **ShotDependencyGraph**: A project-scoped acyclic graph over stable Shot keys.
- **RepairProposal**: Deterministic repair option with action, blocker, impact closure, creative effect,
  estimated capabilities, calls, cost, and stale-check hash.
- **GenerationBatchTarget**: One planned Shot in a Batch, including execute or reuse disposition and
  exact execution-plan binding.
- **BatchCostSnapshot**: Immutable generation, QA, Director-excluded, maximum-cost, pricing-validity,
  and call ceilings for one video Batch.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Replanning identical normalized inputs 100 times produces identical candidate order,
  chosen implementation, selection explanation, dependencies, costs, and plan template hash.
- **SC-002**: One confirmation creates either 100% of the selected plans, targets, authorization,
  reservations, and jobs or none of them; no partial Batch is observable.
- **SC-003**: In every dependency test, a downstream paid submission count remains zero until all
  required upstream artifacts and materialized hashes are technically valid and exact.
- **SC-004**: Replanning one changed Shot invalidates exactly that Shot and its transitive dependency
  closure while 100% of matching independent completed artifacts remain reusable.
- **SC-005**: Every failure, timeout, ambiguous response, hard QA stop, and cost stop produces zero
  automatic retries, resubmissions, or provider/model fallbacks.
- **SC-006**: A two-Shot continuity acceptance extracts the true last decoded frame from Shot 1,
  records its exact identity, and binds it as Shot 2's first frame with matching materialized hash.
- **SC-007**: Owners can move from confirmed Storyboard to executing an all-ready Batch through one
  planning preview and one video confirmation, with no intermediate mandatory approval.
- **SC-008**: All new UI acceptance scenarios expose zero raw graphs, node IDs, credentials,
  endpoints, local paths, provider task IDs, or full hashes outside the collapsed technical evidence.
- **SC-009**: Legacy V1 plans, fixed-profile Batches, historical Director runs, artifacts, QA, and
  Owner decisions remain readable and pass their existing regression tests after migration.
- **SC-010**: The complete automated suite, migrations, format, lint, types, build, secret scan, and
  diff checks pass with zero real external calls.

## Assumptions

- The product remains a local single-user application; multi-tenancy, distributed orchestration,
  and a separate Workflow Agent service are outside this feature.
- Shot count remains 1-20 with contiguous ordinals and stable project-scoped Shot keys.
- Existing AI Director, worker lease, authorization, artifact, QA, assembly, storage, and legacy H3
  behavior are extended rather than replaced.
- Current verified H3 reference evidence is eligible for idempotent READY backfill only when exact
  implementation version, workflow hash, runtime lineage, and technically valid artifacts match.
- H3 first-frame execution uses the first formally authorized production Shot as its initial TRIAL;
  no separate paid smoke call is permitted.
- Direct-provider adapters, official H3, Seedance, arbitrary graph generation, custom-node install,
  model install, and first-plus-last-frame execution are outside MVP availability.
- Technical readiness, AI QA, creative quality, and final Owner approval remain separate decisions.
- This feature authorizes source changes, migrations, tests, and zero-call fixtures only; it does not
  authorize any live Director, AI QA, ComfyUI, H3, or other provider submission.
