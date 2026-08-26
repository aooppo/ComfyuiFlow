# Tasks: Simplified Gates and Capability-Driven Workflow

**Input**: Design documents from `/specs/016-capability-driven-workflow/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required by FR-032 and SC-001 through SC-012. Add failing tests before each
implementation slice and keep every automated path at zero external Director, AI QA, ComfyUI
Partner, and video-provider calls.

**Organization**: Tasks are grouped by user story so each story has an independently verifiable
outcome. Feature 016 is additive over Feature 015; legacy plans and evidence remain readable.

## Phase 1: Setup and Baseline Preservation

**Purpose**: Establish the Feature 016 branch boundary, preserve audited pre-existing changes, and
freeze the zero-call compatibility baseline.

- [x] T001 Record baseline commit `71e9def`, the four audited pre-existing changes, branch boundary, and zero-call scope in specs/016-capability-driven-workflow/verification.md
- [x] T002 Run and record the Feature 015 registry, Workflow Agent, execution, Worker, Director, and historical-read baseline in specs/016-capability-driven-workflow/verification.md
- [x] T003 [P] Preserve exact legacy Registry V1 and fixed-slot H3 bytes in tests/fixtures/generation/legacy-h3-registry.json and tests/contract/minimax-h3-workflow.test.ts
- [x] T004 [P] Add the additive V3/V2 public contract export boundary without changing prior exports in packages/contracts/src/workflow-agent.ts and packages/contracts/src/index.ts

---

## Phase 2: Foundational Registry V2, Persistence, and Shared Execution Boundary

**Purpose**: Create the immutable identity, input-contract, lifecycle, cost, persistence, and shared
adapter foundations required by every user story.

**Critical**: No user-story implementation begins until this phase and its contract tests pass.

- [x] T005 [P] Add failing strict-schema, secret-exclusion, immutable-version, lifecycle, input-invariant, and cost-policy tests for FR-005 through FR-015 in tests/unit/capability-registry-contracts.test.ts
- [x] T006 [P] Add failing registry cross-reference, exact-version resolution, production-fixture exclusion, and legacy-byte preservation tests in tests/unit/capability-registry.test.ts
- [x] T007 Implement Runtime, Provider, Model, Adapter, Compiler, Implementation, InputContract, CostPolicy, publication, evidence, ShotRequirementSpecV3, PlanningInputSnapshot, GenerationSpecV3, GenerationPlanV3, and GenerationAuthorizationV3 schemas in packages/contracts/src/capability-workflow.ts
- [x] T008 Implement canonical Registry V2 loading, validation, immutable version lookup, lifecycle filtering, stable rejected reasons, and legacy historical projection in packages/project-core/src/workflow-agent/capability-registry.ts
- [x] T009 [P] Add failing Prisma migration, append-only guard, exact-version evidence, V3 lineage, and legacy-read tests in tests/integration/capability-workflow-postgres.test.ts
- [x] T010 Add Registry V2, discovery/publication/evidence, requirement/snapshot, immutable Generation Spec, plan, and authorization entities without destructive legacy changes in packages/project-core/prisma/schema.prisma and packages/project-core/prisma/migrations/202608260020_capability_driven_workflow/migration.sql
- [x] T011 Implement immutable registry publication/evidence persistence and V3 plan lineage repositories in packages/project-core/src/workflow-agent/registry-publication-service.ts and packages/project-core/src/workflow-agent/execution-plan-service.ts
- [x] T012 [P] Add failing shared adapter-factory, Web/Worker parity, version-mismatch, test-only rejection, and typed pre-dispatch tests for FR-023 and FR-024 in tests/unit/generation-adapter-registry.test.ts and tests/unit/project-worker-loop.test.ts
- [x] T013 Implement one versioned adapter factory and generic `comfyui-mcp-v2` adapter with readiness, submit, status, cancel, reconcile, and artifact retrieval in packages/project-core/src/generation-adapter.ts
- [x] T014 [P] Add reviewed initial Registry V2 fixtures for legacy historical H3 plus text-to-video, reference-to-video, first/last-frame, local-compute, and test-only identities in generation/registry-v2.json and tests/fixtures/generation/capability-registry-v2.json
- [x] T015 Export foundational services, regenerate Prisma client, and record format/generate/validate, migration rehearsal, focused tests, and `git diff --check` in packages/project-core/src/index.ts and specs/016-capability-driven-workflow/verification.md

**Checkpoint**: Registry V2 and shared execution identities exist, V1 remains byte/read compatible,
and no fixture identity can resolve in production.

---

## Phase 3: User Story 1 - Prepare Only What Each Shot Needs (Priority: P1) MVP

**Goal**: Analyze each selected Shot independently, treating project/semantic/character preparation
as optional evidence unless the Shot and selected implementation have a real hard requirement.

**Independent Test**: Plan one no-person environment Shot, one product Shot, and one recurring-character
Shot; obtain different explainable requirement sets with no project-wide preparation approval.

### Tests for User Story 1

- [x] T016 [P] [US1] Add failing no-person, product, character, environment, style, motion, audio, optional-evidence, and stable-reason requirement tests for FR-001 through FR-004 in tests/unit/workflow-agent-requirements-v3.test.ts
- [x] T017 [P] [US1] Add failing immutable binding order, exact version/hash, filename-independence, omitted/unresolved reason, and 100-run digest tests in tests/unit/planning-input-snapshot.test.ts
- [x] T018 [P] [US1] Add failing zero-call planning API tests proving approvals are not eligibility predicates while every Shot still receives one immutable Generation Spec and raw prompt/runtime bypass is rejected in tests/contract/workflow-planning-v3-api.test.ts
- [x] T019 [P] [US1] Add failing PostgreSQL tests proving one blocked Shot does not block unrelated READY Shots and snapshots are superseded rather than edited in tests/integration/capability-workflow-postgres.test.ts

### Implementation for User Story 1

- [x] T020 [US1] Implement deterministic per-Shot purpose and necessity analysis with explicit no-person omission in packages/project-core/src/workflow-agent/requirement-analyzer-v3.ts
- [x] T021 [US1] Implement deterministic candidate gathering from project files, semantic versions, character states, and exact upstream frames without filename/path guessing in packages/project-core/src/workflow-agent/planning-input-service.ts
- [x] T022 [US1] Implement immutable PlanningInputSnapshot construction, ordering, source/capability digests, and per-Shot blockers/recommendations in packages/project-core/src/workflow-agent/planning-snapshot-service.ts
- [x] T023 [US1] Remove project-wide and intermediate approval predicates while automatically deriving immutable Generation Spec V3 handoffs and retaining legacy behavior in packages/project-core/src/workflow-agent/workflow-planning-application-service.ts and packages/project-core/src/workflow-agent/validator.ts
- [x] T024 [US1] Add selected-shot zero-call V3 planning and preview routes with safe DTOs and `no-store` behavior in apps/project-web/app/api/storyboard-versions/[versionId]/workflow-plans/route.ts and apps/project-web/app/api/workflow-plans/[planId]/route.ts
- [x] T025 [US1] Replace preparation-gate language with per-Shot required/optional/omitted input explanations in apps/project-web/components/storyboards/workflow-planning-panel.tsx and apps/project-web/components/i18n/language-provider.tsx
- [x] T026 [US1] Verify the three-Shot independent scenario, 100-run deterministic requirement/snapshot hashes, zero project-wide blockers, and zero external calls in specs/016-capability-driven-workflow/verification.md

**Checkpoint**: A saved current Storyboard head can be planned per Shot with only truthful conditional
requirements and without intermediate owner approvals.

---

## Phase 4: User Story 2 - Select an Implementation by Capability (Priority: P1)

**Goal**: Resolve and compile text-only, ordered-reference, frame-controlled, and continuation Shots
from published capabilities instead of one fixed H3 workflow.

**Independent Test**: Plan text-only, image/video/audio reference, first/last-frame, and previous-final-
frame Shots; each selects a compatible exact implementation or returns one stable blocker.

### Tests for User Story 2

- [x] T027 [P] [US2] Add failing capability-filter, lifecycle, exact-version, monetary/local-compute cost, and no-special-H3 selection tests for FR-014 through FR-016 and FR-021 in tests/unit/capability-implementation-resolver.test.ts
- [x] T028 [P] [US2] Add failing Hailuo text-to-video, ordered 0-9 image/0-3 video/0-3 audio, audio-only rejection, empty-media invariant, and prompt-label tests for FR-017 through FR-019 in tests/unit/hailuo03-compilers.test.ts
- [x] T029 [P] [US2] Add failing required-first/optional-last and exact previous-final-frame lineage/hash tests for FR-020 in tests/unit/frame-controlled-compiler.test.ts and tests/unit/dependency-final-frame.test.ts
- [x] T030 [P] [US2] Add failing arbitrary graph/node/endpoint/credential/path/command rejection and bounded compiler-output tests for FR-022 in tests/contract/capability-compiler-security.test.ts
- [x] T031 [P] [US2] Add failing Web/Worker exact implementation, compiler, adapter, runtime, provider, and plan-digest parity tests for FR-024 in tests/contract/generation-adapter-registry.test.ts

### Implementation for User Story 2

- [x] T032 [US2] Implement hard capability/invariant/cost/lifecycle filtering with stable rejection reasons and no silent fallback in packages/project-core/src/workflow-agent/capability-resolver-v2.ts
- [x] T033 [US2] Implement deterministic exact-version selection across READY and explicitly scoped TRIAL implementations in packages/project-core/src/workflow-agent/implementation-selector-v2.ts
- [x] T034 [US2] Implement bounded provider-neutral compiler dispatch and compiled preview digests in packages/project-core/src/workflow-agent/compiler-registry.ts
- [x] T035 [US2] Implement initial Hailuo 03 text-to-video, reference-to-video, and first/last-frame compiler profiles without fixed business slot meanings in packages/project-core/src/workflow-agent/compilers/hailuo03.ts
- [x] T036 [US2] Materialize exact ordered media bindings and provider-native prompt labels while rejecting empty/audio-only invalid reference sets in packages/project-core/src/workflow-agent/planning-snapshot-service.ts
- [x] T037 [US2] Bind exact upstream artifact/frame/version/hash dependencies and keep downstream Shots unready until lineage is materialized in packages/project-core/src/dependency-frame-extractor.ts and packages/project-core/src/workflow-agent/execution-plan-service.ts
- [x] T038 [US2] Replace fixed `minimax-h3` UI choices with server-provided implementation capabilities, lifecycle, blocker, and cost-policy views in apps/project-web/components/storyboards/workflow-planning-panel.tsx
- [x] T039 [US2] Verify text-only, reference, audio-invalid, first/last, previous-final-frame, local-compute, and no-fixed-slot scenarios with identical Web/Worker resolution and zero calls in specs/016-capability-driven-workflow/verification.md

**Checkpoint**: New plans are selected and compiled solely from published exact-version capabilities;
legacy fixed-slot H3 remains historical-read only.

---

## Phase 5: User Story 3 - Discover Safely, Publish Deliberately (Priority: P1)

**Goal**: Normalize runtime capabilities into non-selectable candidates, then require explicit reviewed
publication and exact-version evidence before TRIAL or READY selection.

**Independent Test**: Discover multiple node schemas, publish one reviewed candidate, and prove only
the published/evidenced exact version becomes selectable.

### Tests for User Story 3

- [x] T040 [P] [US3] Add failing raw-schema provenance, dynamic-group cardinality, stable source digest, schema-change, secret removal, and DISCOVERED-only tests in tests/contract/capability-discovery.test.ts
- [x] T041 [P] [US3] Add failing publication completeness, immutable version, compiler validation, cost/provider review, and stable failure-code tests in tests/unit/registry-publication.test.ts
- [x] T042 [P] [US3] Add failing DISCOVERED-to-PUBLISHED/TRIAL/READY evidence isolation, failed evidence retention, and no-auto-promotion PostgreSQL tests in tests/integration/capability-workflow-postgres.test.ts
- [x] T043 [P] [US3] Add failing discovery/publication API authorization, no-store/secret-redaction, idempotency, and zero-generation-call tests in tests/contract/capability-registry-api.test.ts

### Implementation for User Story 3

- [x] T044 [US3] Extend normalized ComfyUI node discovery with raw provenance, source digest, modality groups, and cross-field facts in packages/comfyui-bridge/src/node-catalog.ts and packages/comfyui-bridge/src/capability-discovery.ts
- [x] T045 [US3] Implement append-only discovery candidate persistence and schema-change supersession without inferred provider/price/readiness in packages/project-core/src/workflow-agent/capability-discovery-service.ts
- [x] T046 [US3] Implement reviewed publication validation for provider/model/adapter/compiler/input/cost/readiness facts and immutable TRIAL creation in packages/project-core/src/workflow-agent/registry-publication-service.ts
- [x] T047 [US3] Implement exact-version fixture/readiness/authorized-real evidence recording and explicit READY promotion without blind retry in packages/project-core/src/workflow-agent/implementation-evidence-service.ts
- [x] T048 [US3] Add discovery, candidate review, publication, evidence, and promotion APIs with stable domain responses in apps/project-web/app/api/generation-registry/discovery-candidates/route.ts and apps/project-web/app/api/generation-registry/implementations/route.ts
- [x] T049 [US3] Add operator review UI showing runtime/provider/model/adapter/compiler/cost separation and FIRST REAL TRIAL labeling in apps/project-web/app/generation-registry/page.tsx and apps/project-web/components/generation-registry/generation-registry-panel.tsx
- [x] T050 [US3] Verify discovery creates zero selectable implementations, publication is immutable, exact-version evidence gates READY, local compute needs no USD price, and all automated paths make zero calls in specs/016-capability-driven-workflow/verification.md

**Checkpoint**: Runtime discovery reduces integration duplication without granting trust, spending
authority, or production selectability.

---

## Phase 6: User Story 4 - Confirm Paid Work Once (Priority: P1)

**Goal**: Produce one zero-call preview and one atomic confirmation for an exact selectable Shot subset,
while retaining the LIVE kill switch, bounded authority, no retry, and final Owner QA.

**Independent Test**: Confirm READY/TRIAL Shots from a mixed plan and prove any stale digest/version/
price/readiness fact creates no partial Batch and no submission.

### Tests for User Story 4

- [x] T051 [P] [US4] Add failing V3 preview/subset/authorization DTO, exact version/digest/call/cost/QA ceiling, and stable stale-response tests in tests/contract/generation-execution-v3-api.test.ts
- [ ] T052 [P] [US4] Add failing atomic selected-subset freeze, blocked dependency closure, expired price, local-compute, stale plan, idempotency, and zero-partial-row PostgreSQL tests in tests/integration/capability-workflow-postgres.test.ts
- [ ] T053 [P] [US4] Add failing Worker LIVE gate, consume-before-attempt, exact adapter/compiler parity, exhausted cap, ambiguous attempt, and no-retry/fallback tests in tests/unit/project-worker-loop.test.ts and tests/integration/live-safety.test.ts
- [x] T054 [P] [US4] Add failing browser/source acceptance for save-to-preview-to-one-confirmation, partial Shot selection, technical/AI QA status, and explicit final Owner decision in tests/contract/capability-workflow-ui.test.ts

### Implementation for User Story 4

- [x] T055 [US4] Implement V3 zero-call preview from exact immutable Generation Specs with selected Shot closure, versions, bindings, compiled digests, calls, cost/resources, expiry, and no-retry policy in packages/project-core/src/generation-execution-service.ts
- [x] T056 [US4] Implement all-or-none GenerationAuthorizationV3 and Batch creation bound to exact plan digest/Shot set with stale-fact revalidation in packages/project-core/src/generation-execution-service.ts and packages/project-core/src/generation-execution-contracts.ts
- [x] T057 [US4] Extend Batch preview/confirmation routes for V3 subset requests while preserving V1/V2 historical reads in apps/project-web/app/api/generation-plan-versions/[versionId]/execution-preview/route.ts and apps/project-web/app/api/generation-batches/route.ts
- [ ] T058 [US4] Resolve the same server-owned implementation and shared adapter factory in Web and Worker, consuming authorization before network attempts in apps/project-worker/src/index.ts and packages/project-core/src/generation-worker.ts
- [ ] T059 [US4] Keep failed/ambiguous attempts append-only, consume authorized calls correctly, and prohibit automatic retry or provider substitution in packages/project-core/src/generation-worker.ts
- [x] T060 [US4] Simplify owner UI to one selectable-Shot preview and one exact Batch confirmation with lifecycle/cost/resource/trial warnings in apps/project-web/components/storyboards/workflow-planning-panel.tsx and apps/project-web/components/storyboards/generation-batch-panel.tsx
- [x] T061 [US4] Preserve explicit technical checks, AI QA annotation, and final Owner PASS/FAIL/RISK_ACCEPTED before assembly in apps/project-web/components/storyboards/final-owner-review-panel.tsx and packages/project-core/src/generation-qa-service.ts
- [ ] T062 [US4] Verify atomic subset confirmation, stale rejection, Director/video authority separation, one-call cap semantics, final Owner QA, and zero automated external calls in specs/016-capability-driven-workflow/verification.md

**Checkpoint**: The normal path has no duplicate creative/preparation approvals, but every external
Batch remains exact, bounded, action-time authorized, and owner-reviewed.

---

## Phase 7: User Story 5 - Remove Fake from the Product (Priority: P2)

**Goal**: Remove all owner-callable Fake Director/proposal/generation paths while retaining explicitly
test-only fixtures and backward-readable historical evidence.

**Independent Test**: Owner UI exposes no Fake option, retired APIs create no rows, production
resolution rejects fixtures, and historical Fake records still render unchanged.

### Tests for User Story 5

- [x] T063 [P] [US5] Add failing owner UI/source tests for no Fake button/profile/provider and historical Fake labeling in tests/contract/capability-workflow-ui.test.ts and tests/contract/workflow-agent-ui.test.ts
- [ ] T064 [P] [US5] Add failing stable retired-response/no-write tests for Fake generate, preview, run, proposal, decision, and adoption methods while preserving historical GET reads in tests/contract/fake-product-retirement.test.ts
- [ ] T065 [P] [US5] Add failing production fixture exclusion and historical Fake proposal/plan/batch/artifact read compatibility tests in tests/integration/storyboard-director-v2-postgres.test.ts and tests/integration/capability-workflow-postgres.test.ts

### Implementation for User Story 5

- [x] T066 [US5] Remove owner-facing Director/Fake proposal controls and legacy “Generate three shots” entry points while retaining historical read rendering in apps/project-web/components/storyboards/storyboard-director-panel.tsx and apps/project-web/components/storyboards/shot-plan-editor.tsx
- [x] T067 [US5] Reject Fake preview/run/proposal/adopt/decision writes with stable `410` responses and no side effects while preserving real Director writes and historical GET reads in apps/project-web/app/api/storyboards/[storyboardId]/generate/route.ts, apps/project-web/app/api/storyboards/[storyboardId]/director-preview/route.ts, apps/project-web/app/api/storyboards/[storyboardId]/director-runs/route.ts, apps/project-web/app/api/storyboards/[storyboardId]/director-proposals/route.ts, apps/project-web/app/api/storyboard-director-proposals/[proposalId]/adopt/route.ts, and apps/project-web/app/api/storyboard-director-proposals/[proposalId]/decisions/route.ts
- [x] T068 [US5] Exclude Fake Director and `TEST_ZERO_CALL` implementations from production factories/resolution while retaining explicit test injection in apps/project-web/lib/project-services.ts and apps/project-worker/src/index.ts
- [x] T069 [US5] Preserve historical Fake DTOs and read-only projections with explicit historical labels in packages/project-core/src/storyboard-director-service.ts and packages/project-core/src/generation-plan-service.ts
- [ ] T070 [US5] Verify zero owner-callable Fake paths, zero new Fake rows, complete historical reads, zero external calls, and retained deterministic fixtures in specs/016-capability-driven-workflow/verification.md

**Checkpoint**: Fake remains useful as internal evidence only and cannot be mistaken for a product
creative or generation capability.

---

## Phase 8: Polish, Migration, Full Regression, and Handoff

**Purpose**: Close security, compatibility, deterministic performance, browser, documentation, and
constitution traceability across all stories.

- [ ] T071 [P] Extend secret/path/raw-graph/test-fixture leakage and arbitrary-execution protections for Registry V2 and V3 previews in tests/unit/security.test.ts and tests/integration/live-safety.test.ts
- [x] T072 [P] Update PostgreSQL cleanup lists and `_test` database guards for every new table in tests/integration/capability-workflow-postgres.test.ts and all affected integration suites
- [ ] T073 [P] Add 100-run deterministic selection/snapshot/dependency/cost/reason/hash coverage and require at least 95 of 100 zero-call 20-Shot previews to complete within 2 seconds in tests/unit/capability-workflow-determinism.test.ts
- [ ] T074 [P] Update operator and owner workflow documentation, rollout flag, rollback, historical compatibility, and real-TRIAL authorization boundary in README.md, apps/project-web/README.md, .env.example, and specs/016-capability-driven-workflow/quickstart.md
- [ ] T075 Run focused and full unit/contract tests, serial PostgreSQL integration, Prisma format/generate/validate, shadow migration rehearsal, lint, typecheck, production build, secret scan, and `git diff --check`; record commands and external-call counts in specs/016-capability-driven-workflow/verification.md
- [ ] T076 Perform zero-call in-app browser acceptance for conditional inputs, capability selection, candidate publication fixture, one Batch confirmation, Fake absence, historical reads, and final Owner review; record screenshots and Human QA boundary in specs/016-capability-driven-workflow/verification.md
- [ ] T077 Audit FR-001 through FR-033 and SC-001 through SC-012 against tasks, code, and tests; update completed checkboxes and remaining gaps in specs/016-capability-driven-workflow/tasks.md and specs/016-capability-driven-workflow/verification.md

---

## Phase 9: Convergence

- [x] T078 Add bilingual owner-readable explanations and next actions for V3 planning requirement/blocker reason codes while retaining raw stable codes only inside the technical record in apps/project-web/components/storyboards/workflow-planning-panel.tsx and apps/project-web/components/i18n/language-provider.tsx per FR-003 / T025 (partial)
- [x] T079 Integrate deterministic eligible semantic-asset candidates into the V3 planning application so an exact ACTIVE, ACCEPTED, READY requirement can auto-bind without the retired Storyboard approval/manifest gate in packages/project-core/src/workflow-agent/workflow-planning-application-service.ts per FR-005, T021, and T023 (partial)

---

## Phase 10: Create-Time AI Director Authorization (User Story 0)

**Goal**: Turn the disclosed “Create and call AI” action into one atomic Storyboard plus bounded
CodexManager Local Director Run while preserving separate proposal adoption and zero-call automated
acceptance.

- [x] T080 [P] Add create-preview/create-and-queue DTO and source/API contract tests covering exact Provider/model, three-Shot maximum, US$5 ceiling, expiry, one call, idempotency, and no retry in tests/contract/storyboard-create-ai-api.test.ts
- [x] T081 [P] Add PostgreSQL all-or-none, duplicate-request, stale preview, no-reference, and exact Run/authorization/reference snapshot tests in tests/integration/storyboard-director-v2-postgres.test.ts
- [x] T082 Add strict create-time Director preview and confirmation contracts in packages/project-core/src/storyboard-director-contracts.ts
- [x] T083 Refactor exact eligible-reference snapshot construction and implement zero-call project-scoped create preview in packages/project-core/src/storyboard-director-service.ts
- [x] T084 Implement atomic Storyboard, empty immutable initial revision, Director Run, references, and one-use authorization persistence with idempotent readback in packages/project-core/src/storyboard-director-service.ts
- [x] T085 Add thin project create-preview and create-and-queue HTTP dispatch in apps/project-web/app/api/projects/[projectId]/storyboards/director-preview/route.ts and apps/project-web/app/api/projects/[projectId]/storyboards/route.ts
- [x] T086 Replace the empty-create form with a debounced zero-call preview, exact disclosed facts, and one “Create and call AI” button in apps/project-web/components/storyboards/storyboard-library.tsx
- [x] T087 Restore current real-Director run/proposal status plus explicit adopt/reject controls without exposing Fake controls in apps/project-web/components/storyboards/storyboard-director-panel.tsx and apps/project-web/components/storyboards/storyboard-editor.tsx
- [x] T088 Run zero-call automated and browser acceptance, verify the resident Worker remains ready without clicking the LIVE create action, and record exact external-call counts in specs/016-capability-driven-workflow/verification.md
- [x] T089 Fix the post-commit create response so persisted BigInt reference sizes are converted to JSON-safe numbers, add PostgreSQL response-serialization regression coverage, and verify the original completed Run by idempotent replay without another Provider call

---

## Phase 11: User Story 6 - Approve This First Real Trial Scope (Priority: P1)

**Goal**: Let the owner approve a short-lived exact TRIAL subset without granting execution authority,
then isolate that scope per Shot during replanning.

**Independent Test**: Approve two of three exact TRIAL Shots, replan, and prove only those two lose
`TRIAL_SCOPE_REQUIRED`; exercise expiry, revocation, version/composition drift, idempotent replay,
history, and zero external calls.

### Tests for User Story 6

- [x] T090 [P] [US6] Add strict create/history/revoke DTO and route/source contracts, exact scope facts, non-technical UI copy, and zero-execution-authority assertions in packages/contracts/src/capability-workflow.ts and tests/contract/capability-trial-scope-api.test.ts
- [x] T091 [P] [US6] Add per-Shot partial allowlist, version/composition drift, expiry, revocation, idempotent replay/no-extra-write, re-approval, and audit-history PostgreSQL tests in tests/integration/capability-trial-scope-postgres.test.ts
- [x] T092 [P] [US6] Extend resolver/unit coverage proving an approved exact ref is local to one Shot and no global TRIAL allowlist is constructed in tests/unit/capability-implementation-resolver.test.ts

### Implementation for User Story 6

- [x] T093 [US6] Add append-only TrialScopeApproval, TrialScopeApprovalItem, and TrialScopeRevocation persistence plus additive migration in packages/project-core/prisma/schema.prisma and packages/project-core/prisma/migrations/202608260040_trial_scope_approval/migration.sql
- [x] T094 [US6] Implement exact server-owned scope composition, idempotent create/read/revoke, derived status, and zero-call audit service in packages/project-core/src/workflow-agent/trial-scope-approval-service.ts
- [x] T095 [US6] Derive one active exact allowedTrialRefs set per Shot and validate version/composition/expiry/revocation in packages/project-core/src/workflow-agent/workflow-planning-application-service.ts
- [x] T096 [US6] Add no-store approval history/create and append-only revoke HTTP routes in apps/project-web/app/api/storyboard-versions/[versionId]/trial-scope-approvals/route.ts and apps/project-web/app/api/trial-scope-approvals/[approvalId]/revoke/route.ts
- [x] T097 [US6] Add the non-technical Chinese/English first-real-trial approval UI, selected Shot/version disclosure, expiry/revoke/re-approve history, and keep real execution confirmation separate in apps/project-web/components/storyboards/workflow-planning-panel.tsx
- [x] T098 [US6] Run focused contract/unit/PostgreSQL/type/lint/Prisma checks and zero-call browser acceptance on Storyboard `35791cfe-2aa8-5a21-81bf-ef30e8ffccb4`, stop at zero-call preview, verify resident Web/Worker, and record evidence plus remaining Feature 016 gaps in specs/016-capability-driven-workflow/verification.md

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no dependency and freezes the baseline.
- Phase 2 depends on Phase 1 and blocks all user stories.
- Phase 3 (US1) depends on Phase 2.
- Phase 4 (US2) depends on Phase 2 and consumes US1 requirement/snapshot contracts.
- Phase 5 (US3) depends on Phase 2; its published implementations feed US2 production resolution.
- Phase 6 (US4) depends on US1, US2, and the reviewed publication path from US3.
- Phase 7 (US5) depends on Phase 2 and must complete before final browser acceptance.
- Phase 8 depends on all desired stories and performs full convergence.
- Phase 10 depends on the real Director authorization/Worker boundary and retains separate proposal
  adoption; its automated acceptance must remain zero-call.
- Phase 11 depends on US2 exact resolution and V3 planning persistence; it must complete before any
  first real TRIAL execution can be proposed.

### User Story Dependencies

- **US1 (P1)**: Independently proves conditional per-Shot preparation after the foundation.
- **US2 (P1)**: Uses US1 semantic requirements and can be verified with reviewed registry fixtures.
- **US3 (P1)**: Can be built beside US1, but publication must land before production selection is enabled.
- **US4 (P1)**: Integrates US1 requirements, US2 resolution/compiler, and US3 publication/evidence.
- **US5 (P2)**: Can be implemented after the foundation but must preserve US4 historical projections.
- **US6 (P1)**: Uses US2/US4 planning lineage but grants planning scope only; it is independent from
  and strictly weaker than paid execution authorization.

### Within Each User Story

- Write the story's tests first and confirm they fail for the intended reason.
- Add contracts and persistence before services, routes, Worker integration, and UI.
- Any task sharing a file with an earlier task runs sequentially even if another task is marked `[P]`.
- Finish the independent checkpoint and record zero-call evidence before moving to the next phase.

### Parallel Opportunities

- T003 and T004 are independent baseline tasks.
- T005/T006/T009/T012/T014 cover separate foundational files.
- Each story's `[P]` tests can be authored together before its sequential implementation tasks.
- US1 analysis and US3 discovery can proceed independently after Phase 2, but this execution plan
  keeps phase checkpoints sequential for a single agent and shared-file safety.

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 to remove project-wide preparation gates in zero-call planning.
3. Complete US2 with reviewed Registry V2 fixtures for capability-driven selection.
4. Validate the independent scenarios before enabling any V3 rollout flag.

### Incremental Delivery

1. Registry foundation preserves every legacy read.
2. Conditional per-Shot planning lands behind a server-controlled V3 rollout flag.
3. Controlled discovery/publication supplies reviewed exact-version implementations.
4. Atomic subset confirmation becomes the new generation path.
5. Fake writes and owner controls retire only after historical compatibility tests pass.

### Real Validation Boundary

No task in this file authorizes a real Director, ComfyUI Partner, AI QA, or video-provider call.
After all zero-call gates pass, any proposed TRIAL must separately show the exact Shot scope,
implementation/provider/compiler versions, price or local-compute policy, call cap, expiry, and
no-retry rule, then obtain a fresh action-time owner confirmation.

## Notes

- `[P]` means different files and no dependency on another incomplete task in the same phase.
- Every task follows `- [ ] T### [P?] [US?] Description with exact file path`.
- Mark tasks `[x]` only after implementation and the stated verification succeed.
- Preserve unrelated changes and all append-only historical evidence.
