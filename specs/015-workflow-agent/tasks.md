# Tasks: Workflow Agent and Cross-Shot Execution

**Input**: Design documents from `/specs/015-workflow-agent/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required by FR-035 and SC-010. Within each slice, add failing tests before the
implementation and keep all automated paths at zero external calls.

## Phase 1: Setup and Baseline Preservation

**Purpose**: Freeze the exact baseline, preserve unrelated work, and establish V2 file boundaries.

- [x] T001 Record the audited four pre-existing Director/Next generated-file changes and baseline commit in specs/015-workflow-agent/verification.md
- [x] T002 Verify current V1/H3 contract and zero-call baseline in tests/contract/minimax-h3-workflow.test.ts and tests/contract/generation-execution-boundaries.test.ts
- [x] T003 [P] Create the additive generation registry directory and exact V1 preservation fixture in generation/registry.json and tests/fixtures/generation/legacy-h3-registry.json
- [x] T004 [P] Add V2 contract module export boundary without changing V1 schemas in packages/contracts/src/workflow-agent.ts and packages/contracts/src/index.ts

---

## Phase 2: Foundational Contracts, Registry, and Persistence

**Purpose**: Shared versioned types, implementation identity, additive database model, and adapter
boundary required by every user story.

**Critical**: No story implementation begins until this phase passes its contract and migration tests.

- [x] T005 [P] Add failing strict-schema and stable-error tests for V2 requirements, registry, plans, dependencies, repair, cost, and continuation in tests/unit/workflow-agent-contracts.test.ts
- [x] T006 [P] Add failing registry uniqueness, cross-reference, hash, availability, and V1-byte preservation tests in tests/unit/workflow-agent-registry.test.ts
- [x] T007 Implement strict V2 Zod schemas and safe DTO types from contracts/workflow-agent-contracts.md in packages/contracts/src/workflow-agent.ts
- [x] T008 Implement generation registry loader, canonical snapshot hashing, unique/cross-reference validation, and secret exclusion in packages/project-core/src/workflow-agent/registry.ts
- [x] T009 [P] Add failing Prisma migration/model/immutability and V1-read compatibility coverage in tests/integration/workflow-agent-postgres.test.ts
- [x] T010 Extend entities, enums, composite relations, nullability, and append-only identity guards in packages/project-core/prisma/schema.prisma and packages/project-core/prisma/migrations/202608260019_workflow_agent/migration.sql
- [x] T011 Regenerate Prisma client and branch V1/V2 GenerationSpec readers/writers by contractVersion in packages/project-core/src/generation-plan-service.ts and packages/project-core/src/deterministic-shot-planner.ts
- [x] T012 [P] Add failing adapter lookup, version mismatch, typed failure, and legacy wrapper tests in tests/unit/generation-adapter-registry.test.ts
- [x] T013 Implement GenerationAdapter, typed submission errors, adapter registry, and legacy provider wrapper in packages/project-core/src/generation-adapter.ts
- [x] T014 Export foundational V2 modules and services without changing existing imports in packages/project-core/src/index.ts
- [x] T015 Run Prisma format/generate/validate, shadow migration rehearsal, foundational unit/contract tests, and git diff check; record evidence in specs/015-workflow-agent/verification.md

**Checkpoint**: V2 contracts and persistence exist; all V1 rows/contracts/tests remain compatible.

---

## Phase 3: User Story 1 - Deterministic Per-Shot Planning (Priority: P1) MVP

**Goal**: Produce a zero-call, deterministic, explainable READY/TRIAL/BLOCKED/WAITING plan per Shot.

**Independent Test**: Replan the same 1-20 Shot normalized fixture 100 times and obtain identical
candidate order, choice, explanation, cost, DAG, repair hash, and plan template SHA.

### Tests for User Story 1

- [x] T016 [P] [US1] Add failing Requirement Analyzer and ShotRequirementSpec V2 hash tests in tests/unit/workflow-agent-requirements.test.ts
- [x] T017 [P] [US1] Add failing hard-filter, AUTO/PREFERRED/LOCKED precedence, Wilson score, switch-penalty, and deterministic tie tests in tests/unit/workflow-agent-selection.test.ts
- [x] T018 [P] [US1] Add failing DAG validation, stable topology, waiting propagation, and affected-closure tests in tests/unit/workflow-agent-dependency.test.ts
- [x] T019 [P] [US1] Add failing planning API safety, no-store, zero-call, and safe-error contract tests in tests/contract/workflow-agent-api.test.ts

### Implementation for User Story 1

- [x] T020 [US1] Implement provider-neutral deterministic requirement rules in packages/project-core/src/workflow-agent/requirement-analyzer.ts
- [x] T021 [US1] Implement dependency graph validation, topology, wait propagation, and invalidation closure in packages/project-core/src/workflow-agent/dependency-graph.ts
- [x] T022 [US1] Implement hard candidate resolution and stable blocker codes in packages/project-core/src/workflow-agent/capability-resolver.ts
- [x] T023 [US1] Implement whole-Storyboard dynamic programming, Wilson lower bound, scores, penalties, and selectionReason in packages/project-core/src/workflow-agent/implementation-selector.ts
- [x] T024 [US1] Implement READY reference, READY pattern/block, and evidence-gated TRIAL resolution in packages/project-core/src/workflow-agent/pattern-resolver.ts
- [x] T025 [US1] Implement direct-request compiler that rejects unregistered adapters/endpoints/unknown cost in packages/project-core/src/workflow-agent/direct-request-compiler.ts
- [x] T026 [US1] Implement contract/readiness/security/cost validation and stable planning outcomes in packages/project-core/src/workflow-agent/validator.ts
- [x] T027 [US1] Implement DRAFT/FROZEN/INVALIDATED/SUPERSEDED plan persistence and idempotent registry/evidence sync in packages/project-core/src/workflow-agent/execution-plan-service.ts
- [x] T028 [US1] Implement end-to-end zero-call planning orchestration in packages/project-core/src/workflow-agent/workflow-agent-service.ts
- [x] T029 [US1] Add thin workflow-plan preview route with safe DTO/no-store behavior in apps/project-web/app/api/generation-plan-versions/[versionId]/workflow-plans/route.ts
- [x] T030 [US1] Add preference CAS/idempotency route in apps/project-web/app/api/generation-plans/[planId]/planning-preferences/route.ts
- [x] T031 [US1] Verify 100-run determinism, missing capability/price/credential/adapter blockers, and zero external calls; record results in specs/015-workflow-agent/verification.md

**Checkpoint**: User Story 1 independently produces complete zero-call Workflow Plans.

---

## Phase 4: User Story 2 - One Atomic Mixed-Implementation Batch (Priority: P1)

**Goal**: Confirm one Batch whose targets carry different frozen implementations/adapters.

**Independent Test**: A mixed fixture atomically creates every plan/authorization/target/job or none;
stale, blocked, unknown-cost, or over-budget scope produces zero partial rows and zero calls.

### Tests for User Story 2

- [x] T032 [P] [US2] Add failing V2 confirmation DTO, mixed-target projection, and V1 compatibility contract tests in tests/contract/generation-execution-api.test.ts
- [x] T033 [P] [US2] Add failing atomic freeze, cost reservation, idempotency, stale preview, and mixed-plan PostgreSQL tests in tests/integration/workflow-agent-postgres.test.ts
- [x] T034 [P] [US2] Add failing per-target adapter dispatch and legacy engine branch tests in tests/unit/project-worker-loop.test.ts

### Implementation for User Story 2

- [x] T035 [US2] Extend preview/confirmation service with V2 all-ready checks, integer-micros cost snapshot, and one atomic freeze transaction in packages/project-core/src/generation-execution-service.ts
- [x] T036 [US2] Extend safe V2 execution DTO/error mapping while preserving V1 wire contracts in packages/project-core/src/generation-execution-contracts.ts
- [x] T037 [US2] Extend generation batch routes for discriminated engineVersion requests and safe mixed-target responses in apps/project-web/app/api/generation-batches/route.ts and apps/project-web/app/api/generation-batches/[batchId]/route.ts
- [x] T038 [US2] Assemble adapter registry and dual legacy/workflow-agent engines without a process-wide V2 profile in apps/project-worker/src/index.ts
- [x] T039 [US2] Refactor GenerationWorker to resolve the frozen adapter per target and enforce typed pre-dispatch/rejected/ambiguous semantics in packages/project-core/src/generation-worker.ts
- [x] T040 [US2] Verify atomic rollback, no retry/fallback, mixed adapter dispatch, and legacy Batch regression; record evidence in specs/015-workflow-agent/verification.md

**Checkpoint**: One confirmation safely freezes and dispatches a mixed zero-call/stub Batch.

---

## Phase 5: User Story 3 - Cross-Shot Dependency Execution (Priority: P1)

**Goal**: Execute only dependency-ready targets and bind the exact upstream final frame downstream.

**Independent Test**: In a two-Shot fixture, Shot 2 remains unclaimable until Shot 1 is technically
valid, then receives the exact last decoded frame and a matching materialized execution SHA.

### Tests for User Story 3

- [x] T041 [P] [US3] Add failing exact final decoded frame/index/rational PTS/hash tests using media fixture in tests/unit/dependency-final-frame.test.ts
- [x] T042 [P] [US3] Add failing topological claim, upstream stop, materialization mismatch, invalidation, and reuse tests in tests/integration/workflow-agent-postgres.test.ts
- [x] T043 [P] [US3] Add failing reuse projection tests for Draft and Final Assembly source selection in tests/unit/generation-plan-draft.test.ts and tests/unit/generation-plan-assembly.test.ts

### Implementation for User Story 3

- [x] T044 [US3] Implement exact FFprobe/FFmpeg dependency frame extraction and storage verification in packages/project-core/src/dependency-frame-extractor.ts
- [x] T045 [US3] Extend artifact frame persistence with exact index/PTS/time-base facts in packages/project-core/src/generated-artifact-service.ts
- [x] T046 [US3] Implement symbolic-to-Batch target binding, write-once materialized input/SHA, and upstream drift invalidation in packages/project-core/src/workflow-agent/execution-plan-service.ts
- [x] T047 [US3] Update worker claim SQL and release logic for stable dependency-ready topology and downstream pause in packages/project-core/src/generation-worker.ts
- [x] T048 [US3] Implement exact REUSE_ARTIFACT validation with no Job/consumption and no latest-artifact substitution in packages/project-core/src/generation-execution-service.ts
- [x] T049 [US3] Teach Draft and Assembly source resolution to use frozen reuse artifacts in packages/project-core/src/generation-plan-draft-service.ts and packages/project-core/src/generation-plan-assembly-service.ts
- [x] T050 [US3] Verify exact final frame, upstream failure zero downstream calls, drift invalidation, and independent artifact reuse; record evidence in specs/015-workflow-agent/verification.md

**Checkpoint**: Cross-Shot execution and reuse are deterministic and paid-call safe.

---

## Phase 6: User Story 4 - Blocked Shot Repair Loop (Priority: P2)

**Goal**: Offer deterministic repair options and replan only the affected dependency closure.

**Independent Test**: Repair one blocked branch while an independent completed branch retains its
plan and artifact; only rewrite/split use a separately authorized Fake Director run.

### Tests for User Story 4

- [x] T051 [P] [US4] Add failing five-action repair schema, stable hash, stale proposal, and closure tests in tests/unit/workflow-agent-repair.test.ts
- [x] T052 [P] [US4] Add failing zero-call deterministic repair and one-call Fake rewrite/split contract tests in tests/contract/workflow-agent-repair-api.test.ts
- [x] T053 [P] [US4] Add failing repair adoption, stable Shot keys, split child keys, binding revalidation, and partial replan PostgreSQL tests in tests/integration/storyboard-director-v2-postgres.test.ts

### Implementation for User Story 4

- [x] T054 [US4] Implement stable RepairProposal generation and impact closure in packages/project-core/src/workflow-agent/repair-planner.ts
- [x] T055 [US4] Implement zero-call implementation change, relaxation ledger, and replace-asset actions in packages/project-core/src/workflow-agent/workflow-agent-service.ts
- [x] T056 [US4] Extend Director contracts/entities/services/worker with SHOT_REPAIR rewrite/split strict output in packages/project-core/src/storyboard-director-contracts.ts, packages/project-core/src/storyboard-director-service.ts, and packages/project-core/src/storyboard-director-worker.ts
- [x] T057 [US4] Implement repair adoption with StoryboardVersion append, unaffected keys/bindings copy, split-key derivation, and affected-only replan in packages/project-core/src/storyboard-director-service.ts
- [x] T058 [US4] Add repair preview/run/adopt thin routes in apps/project-web/app/api/shot-execution-plans/[planId]/repair-preview/route.ts, apps/project-web/app/api/shot-execution-plans/[planId]/repair-runs/route.ts, and apps/project-web/app/api/workflow-repair-proposals/[proposalId]/adopt/route.ts
- [x] T059 [US4] Verify Director/video authorization separation, stale rejection, no retry/fallback, and unaffected reuse; record evidence in specs/015-workflow-agent/verification.md

**Checkpoint**: BLOCKED is locally repairable and never becomes an automatic Project failure.

---

## Phase 7: User Story 5 - Auto-Continuation and Unified Owner Review (Priority: P2)

**Goal**: Continue safe Shots after QA policy and perform one final Owner review without weakening
explicit Human approval.

**Independent Test**: Fixtures for PASS/WARN/NOT_ASSESSABLE continue, while hard FAIL, ambiguity,
technical failure, and cost exhaustion pause before dependent submission.

### Tests for User Story 5

- [x] T060 [P] [US5] Add failing continuation-policy and hard-criterion/confidence tests in tests/unit/generation-continuation.test.ts
- [x] T061 [P] [US5] Add failing QA cost reservation, dependency pause, and final review projection tests in tests/integration/workflow-agent-postgres.test.ts
- [x] T062 [P] [US5] Add UI source/contract tests for business states, no Fake, collapsed technical evidence, and explicit Owner decisions in tests/contract/workflow-agent-ui.test.ts

### Implementation for User Story 5

- [x] T063 [US5] Persist deterministic continuation decisions and include QA cost/calls in Batch budget in packages/project-core/src/generation-qa-service.ts and packages/project-core/src/generation-execution-service.ts
- [x] T064 [US5] Apply continuation/pause policy without fabricating Human QA in packages/project-core/src/generation-worker.ts
- [x] T065 [US5] Extract Workflow Planning, Batch Progress, and Final Owner Review components from the legacy editor in apps/project-web/components/storyboards/workflow-planning-panel.tsx, apps/project-web/components/storyboards/generation-batch-panel.tsx, and apps/project-web/components/storyboards/final-owner-review-panel.tsx
- [x] T066 [US5] Integrate engine-specific panels while preserving legacy history in apps/project-web/components/storyboards/shot-plan-editor.tsx
- [x] T067 [US5] Add Chinese status/blocker/repair/continuation strings and accessible loading/empty/error states in apps/project-web/components/i18n/language-provider.tsx and apps/project-web/app/globals.css
- [x] T068 [US5] Perform zero-call in-app browser acceptance for preferences, repair, one confirmation, dependency progress, pause, Draft review, Human decisions, and Assembly; record screenshots/results in specs/015-workflow-agent/verification.md

**Checkpoint**: The normal path has one video confirmation and one explicit final Owner review.

---

## Phase 8: User Story 6 - Readiness, Developer Startup, and Rollback (Priority: P3)

**Goal**: Report honest readiness, manage only owned local processes, and fail closed on rollback.

**Independent Test**: With real generation disabled, readiness and supervisor fixtures make zero
external calls, preserve history, and keep already-submitted work query/reconcile-only.

### Tests for User Story 6

- [x] T069 [P] [US6] Add failing node catalog normalization, secret removal, allowlist, scoped hash, and stale-catalog tests in tests/contract/comfyui-node-catalog.test.ts
- [x] T070 [P] [US6] Add failing graph class/field/type/edge/DAG/output/path/symlink/prefix and zero-prompt tests in tests/contract/comfyui-graph-validator.test.ts
- [x] T071 [P] [US6] Add failing submit-by-plan identity, authorization/materialized SHA, and no-local-path tests in tests/contract/generation-adapter-registry.test.ts
- [x] T072 [P] [US6] Add failing process ownership, loopback, health/migration, no-install, and secret-redaction tests in tests/unit/project-dev-supervisor.test.ts

### Implementation for User Story 6

- [x] T073 [US6] Implement scoped normalized node catalog and allowlisted node info in packages/comfyui-bridge/src/node-catalog.ts
- [x] T074 [US6] Implement trusted graph validation, realpath containment, safe prefix derivation, and graph hashing in packages/comfyui-bridge/src/graph-validator.ts and packages/comfyui-bridge/src/workflow-registry.ts
- [x] T075 [US6] Implement frozen-plan load/recheck/stage/submit/status/retain/cancel bridge in packages/comfyui-bridge/src/execution-plan.ts
- [x] T076 [US6] Register node catalog/info/validate/readiness and submit-execution-plan tools while preserving legacy tools in apps/comfyui-mcp/src/server.ts and apps/comfyui-mcp/src/index.ts
- [x] T077 [US6] Implement project generation readiness aggregation and safe route in packages/project-core/src/workflow-agent/readiness-service.ts and apps/project-web/app/api/projects/[projectId]/generation-readiness/route.ts
- [x] T078 [US6] Refactor startup supervisor for owned PostgreSQL/ComfyUI/Web/Worker health and cleanup without node/model installation in scripts/project-dev.mjs
- [x] T079 [US6] Converge new environment flags and document legacy compatibility in .env.example, README.md, and apps/project-web/README.md
- [x] T080 [US6] Verify real-disable and legacy rollback, query-only submitted work, readiness honesty, and zero calls; record evidence in specs/015-workflow-agent/verification.md

**Checkpoint**: Operators can understand readiness and disable/roll back without losing evidence.

---

## Phase 9: Polish, Full Regression, and Handoff

**Purpose**: Complete cross-story security, compatibility, migration, and acceptance evidence.

- [x] T081 [P] Extend secret/path/raw-graph leakage and LIVE safety coverage in tests/unit/security.test.ts and tests/integration/live-safety.test.ts
- [x] T082 [P] Update every PostgreSQL integration TRUNCATE list for new tables and enforce `_test` database guards in tests/integration/workflow-agent-postgres.test.ts and existing affected suites
- [x] T083 [P] Lock existing workflow/registry bytes and validate cloned H3 output-prefix materialization without source mutation in tests/contract/minimax-h3-workflow.test.ts
- [x] T084 Add exact redacted First/Last Node catalog fixture only if captured from current runtime; otherwise retain non-selectable blocker and document the gap in tests/fixtures/comfyui/ and specs/015-workflow-agent/verification.md
- [x] T085 Run format, lint, typecheck, complete tests, serial PostgreSQL suite, Prisma validation, migration rehearsal, production build, secret scan, and diff check; record commands/results/call counts in specs/015-workflow-agent/verification.md
- [x] T086 Audit spec FR-001 through FR-035 and SC-001 through SC-010 against code/tests, then update completed task checkboxes and remaining gaps in specs/015-workflow-agent/tasks.md and specs/015-workflow-agent/verification.md

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no dependency and preserves the working boundary.
- Phase 2 depends on Phase 1 and blocks every user story.
- Phase 3 (US1) depends on Phase 2 and is the planning MVP.
- Phase 4 (US2) depends on US1 frozen-plan output.
- Phase 5 (US3) depends on US2 Batch targets and adapter dispatch.
- Phase 6 (US4) depends on US1 planning/invalidation; its deterministic repair can be tested before
  US3, but final artifact reuse verification depends on US3.
- Phase 7 (US5) depends on US2/US3 execution outcomes and reuses existing Draft/Human QA/Assembly.
- Phase 8 (US6) depends on stable registry/adapter contracts from Phase 2 and execution identity from
  US2; its read-only catalog work can be developed earlier.
- Phase 9 depends on all selected stories.

### Within Each Story

- Tests are added first and must fail for the intended missing behavior.
- Contract/data model precede services; services precede routes/UI; integration follows core logic.
- Tasks sharing a file run sequentially even if their conceptual work could be parallel.
- Every checkpoint includes zero-call verification; real provider acceptance is explicitly excluded.

### Parallel Opportunities

- Phase 1 T003-T004 can run in parallel after T001-T002.
- Phase 2 schema tests, registry tests, migration tests, and adapter tests marked [P] are independent.
- In each story, test files marked [P] can be prepared concurrently.
- US6 catalog/graph test design can proceed after foundational contracts while US2-US5 services are
  implemented, but source integration waits for stable plan identity.

---

## Implementation Strategy

### MVP First

1. Complete setup and foundational contracts/migration.
2. Complete US1 deterministic planning and validate it independently at zero calls.
3. Freeze the planning/API/registry contracts before modifying Worker or UI.

### Incremental Delivery

1. Planning preview and blockers.
2. Atomic mixed Batch and adapter dispatch using stubs.
3. Cross-Shot final-frame materialization and reuse.
4. Repair loop.
5. Continuation and unified review UI.
6. Readiness/startup/rollback.
7. Full convergence and later separately authorized real MVP acceptance.

## Notes

- Existing four dirty files belong to prior Director work and must be preserved/audited, not reset.
- `apps/project-web/next-env.d.ts` is generated-state drift; do not stage it blindly.
- Fake stays available for tests/legacy but is absent from the new normal UI/registry.
- First-Frame never becomes selectable from planning notes alone; exact catalog and readiness are
  prerequisites, and real technical success is the only READY promotion.
- No task in this file authorizes a real external call.
