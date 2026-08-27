# Tasks: Dynamic Capability Generation Mainline

**Input**: Design documents from `/specs/017-capability-generation-mainline/`

**Tests**: Required. Every production-path change needs unit/contract/integration coverage and final zero-call validation.

## Phase 1: Safety, Governance, and Backup

- [x] T001 Record clean baseline, branch boundary, Feature 016 supersession, and zero-call boundary in `specs/017-capability-generation-mainline/verification.md`
- [x] T002 Stop related local processes and create readable scoped PostgreSQL dump plus timestamped storage SHA manifest in `scripts/feature-017-reset.mjs`
- [x] T003 [P] Add source scan rejecting retired workers/providers/routes/versioned product symbols and production Fake identity in `tests/contract/generation-mainline-source-scan.test.ts`
- [x] T004 [P] Add regression fixture/evidence preservation test for fixed H3 graph bytes and SHA in `tests/fixtures/generation/`

## Phase 2: Canonical Foundation

- [x] T005 Replace `packages/project-core/prisma/schema.prisma` with the canonical append-only model set and constraints
- [x] T006 Replace migration archaeology with one clean baseline in `packages/project-core/prisma/migrations/202608270001_capability_generation_mainline/migration.sql`
- [x] T007 Add canonical capability registry and RuntimeContract cross-reference validation in `packages/project-core/src/capability-registry.ts`
- [x] T008 Add frozen planning/spec/reference/graph contracts and deterministic digest materialization in `packages/project-core/src/generation-planning-service.ts`
- [x] T009 Add exact AdapterRegistry `adapterRef + runtimeRef` resolution contract in `packages/project-core/src/generation-adapter.ts`
- [ ] T010 [P] Add unit tests for registry references, deterministic graph materialization, and exact adapter resolution in `tests/unit/capability-registry.test.ts` and `tests/unit/generation-adapter-registry.test.ts`
- [ ] T011 [P] Add PostgreSQL append-only and clean-schema integration tests in `tests/integration/generation-mainline-postgres.test.ts`

## Phase 3: User Story 1 - Frozen Attempt Lifecycle (Priority: P1)

**Goal**: One frozen target can make at most one generation submission and one independently authorized AI-QA call.

**Independent Test**: Use the injected test adapter to complete a target and demonstrate consumption-before-submit, no duplicate restart submission, and terminal ambiguity.

- [ ] T012 [P] [US1] Add failing lifecycle contract tests in `tests/contract/generation-mainline-execution-api.test.ts`
- [ ] T013 [P] [US1] Add failing Worker/restart/ambiguity/one-submit unit tests in `tests/unit/generation-worker.test.ts`
- [ ] T014 [US1] Implement authorization, batch, target, consumption, and attempt services in `packages/project-core/src/generation-execution-service.ts`
- [ ] T015 [US1] Implement unique generic `GenerationWorker` over frozen inputs in `packages/project-core/src/generation-worker.ts`
- [ ] T016 [US1] Implement server-owned artifact retention, FFprobe, frame extraction, and independent AI-QA lineage in `packages/project-core/src/generation-artifact-service.ts`
- [ ] T017 [US1] Implement Owner decision, Owner-FAIL-only retry preview, and idempotent assembly in `packages/project-core/src/generation-review-service.ts`
- [ ] T018 [US1] Replace MCP execution bridge tools and runtime validation in `apps/comfyui-mcp/src/server.ts`
- [ ] T019 [US1] Compose only the unique worker and generic ComfyUI adapter in `apps/project-worker/src/index.ts`
- [ ] T020 [US1] Add execution, artifact, AI-QA, Owner/retry, assembly, and MCP boundary tests in `tests/contract/` and `tests/integration/`

## Phase 4: User Story 2 - Dynamic Planning and Review UI (Priority: P1)

**Goal**: Storyboard users see capability-driven planning and formal review only.

**Independent Test**: A LIVE-disabled browser/API test can plan and review a batch without any retired controls or external calls.

- [ ] T021 [P] [US2] Replace public Zod exports with canonical schemas in `packages/contracts/src/capability-workflow.ts` and `packages/contracts/src/index.ts`
- [ ] T022 [US2] Replace legacy API routes with canonical planning, batch, artifact, Owner, retry, assembly, and registry routes in `apps/project-web/app/api/`
- [ ] T023 [US2] Replace retired Storyboard panels with dynamic planning and formal batch review in `apps/project-web/components/storyboards/`
- [ ] T024 [US2] Add route-removal and Storyboard zero-call browser/source acceptance in `tests/contract/capability-workflow-ui.test.ts`

## Phase 5: User Story 3 - Recoverable Local Reset (Priority: P1)

**Goal**: Local old data is backed up, then the active database/storage is intentionally empty and canonical.

**Independent Test**: The reset script refuses active processes or missing evidence; after reset the new empty database has only canonical tables and active storage has no legacy files.

- [x] T025 [US3] Implement guarded local dump, storage manifest, offline move, reset, and post-reset inspection in `scripts/feature-017-reset.mjs`
- [x] T026 [US3] Execute and record the verified 5448 backup/reset/schema/storage readback in `specs/017-capability-generation-mainline/verification.md`

## Phase 6: User Story 4 - Exact LIVE Preview (Priority: P2)

**Goal**: Produce but do not execute an exact zero-call Shot 1 Preview.

**Independent Test**: Missing/expired facts block preview; complete preview gives all frozen references and produces no external call.

- [ ] T027 [P] [US4] Add Test A source-hash, price/expiry, and no-call preview tests in `tests/contract/live-test-a-preview.test.ts`
- [ ] T028 [US4] Implement exact Preview/preflight service with no batch or Worker start in `packages/project-core/src/live-test-a-preview-service.ts`
- [ ] T029 [US4] Add live-preview API/UI facts display in `apps/project-web/app/api/` and `apps/project-web/components/storyboards/`

## Phase 7: Polish, Verification, and Handoff

- [x] T030 Remove retired generation/V3 modules, migrations, production exports, tests, and route files while keeping Feature 016 evidence and fixed-H3 test evidence in `packages/`, `apps/`, and `tests/`
- [ ] T031 Run formatter, lint, typecheck, full Vitest, PostgreSQL integration, Prisma validate, production build, secret scan, and `git diff --check`; record results in `specs/017-capability-generation-mainline/verification.md`
- [x] T032 Perform LIVE-disabled browser acceptance and record provider/ComfyUI/AI-QA call counts in `specs/017-capability-generation-mainline/verification.md`
- [x] T033 Commit the cohesive Feature 017 schema/code/tests/specification set and confirm clean branch in `specs/017-capability-generation-mainline/verification.md`
- [ ] T034 Keep Worker stopped; verify fresh Test A operational facts, create exact Preview, and stop for fresh action-time authorization in `specs/017-capability-generation-mainline/verification.md`

## Dependencies & Execution Order

T001-T004 precede destructive reset. T005-T011 establish the canonical model before T012-T020. T021-T024 depend on the new contracts and services. T025-T026 depend on the canonical migration. T027-T029 require reset and zero-call services. T030-T034 run only after all product paths and tests are complete.

## Parallel Opportunities

T003/T004, T010/T011, T012/T013, T021, and T027 may proceed independently once their prerequisite contracts exist. All tasks that change the schema, unique Worker, or Storyboard aggregate are sequential.

## Phase 8: Convergence

- [ ] T035 [P] Replace `packages/project-core/prisma/schema.prisma` with the canonical model plus required Project/Asset/Storyboard foundation, regenerate the one baseline migration/client, and prove the Prisma model set, migration, and post-reset inspection agree.
- [ ] T036 [US2] Implement the canonical Storyboard planning, batch, artifact, Owner decision, retry preview, and assembly API/UI surfaces; replace every remaining retired-route fetch and prove the zero-call browser flow.
- [ ] T037 Remove every retired production generation provider, adapter, workflow-agent/Hailuo implementation, V3 record access, export, route, UI label, and production fake identity; retain only the explicitly quarantined historical fixture and test-only fakes; make T003 source scan enforce this boundary.
- [ ] T038 [US1] Complete the canonical persisted lifecycle services for artifact retention, FFprobe/frame evidence, independently authorized AI-QA, Owner decisions, Owner-FAIL-only retry previews, and idempotent assemblies with PostgreSQL and restart/ambiguity coverage.
- [ ] T039 [US3] After T035-T038, perform the approved guarded local reset and record database/storage/browser readbacks showing only the canonical empty product state and no external calls.
- [ ] T040 Complete the final verification matrix, secret/diff checks, cohesive commit, worker-stopped exact Test A preview, and fresh action-time authorization stop; do not make a provider or AI-QA call.
