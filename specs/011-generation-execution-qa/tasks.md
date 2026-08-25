# Tasks: Generation Execution and QA

**Input**: Design documents from `specs/011-generation-execution-qa/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Contract, unit, PostgreSQL, browser, migration, build, and zero-call evidence are required.

## Phase 1: Setup and Living Boundaries

- [x] T001 Update Phase 4 cardinality/status drift and add Phase 5-6 overview in `specs/009-shot-planner-generation-spec/data-model.md`, `specs/010-flexible-shot-lifecycle/spec.md`, and `README.md`
- [x] T002 [P] Add execution/QA Zod contract tests in `tests/unit/generation-execution.test.ts` and `tests/contract/video-qa-provider.test.ts`
- [x] T003 [P] Add HTTP contract tests for Preview, Batch, Artifact, control, and Human QA routes in `tests/contract/generation-execution-api.test.ts`
- [x] T004 Add shared execution, Provider capability, Artifact, AI QA, and Human QA schemas in `packages/contracts/src/index.ts`

## Phase 2: Foundational Persistence and Provider Boundaries

- [x] T005 Add generation/authorization/artifact/QA enums and project-scoped models in `packages/project-core/prisma/schema.prisma`
- [x] T006 Add preservation-safe migration in `packages/project-core/prisma/migrations/202608250011_generation_execution_qa/migration.sql`
- [x] T007 [P] Add static Fake/H3 Provider registry, five-slot policy, H3 prompt compiler, and unit tests in `packages/project-core/src/generation-provider.ts`, `packages/project-core/src/h3-generation-prompt.ts`, and `tests/unit/generation-execution.test.ts`
- [x] T008 [P] Add generated storage, media-check, deterministic-frame helpers and tests in `packages/project-core/src/generated-artifact-service.ts` and `tests/integration/generation-execution-postgres.test.ts`
- [x] T009 [P] Extend provider-neutral AI capabilities with Fake and CodexManager frame-QA adapters and contract tests in `packages/ai-providers/src/` and `tests/contract/video-qa-provider.test.ts`
- [x] T010 Add the reusable MCP-only H3 client and Fake implementation in `packages/project-core/src/comfyui-mcp-generation-provider.ts`, `packages/project-core/src/generation-provider.ts`, `packages/comfyui-bridge/src/execution.ts`, and `apps/comfyui-mcp/src/server.ts`

## Phase 3: User Story 1 - Preview Compatible Shots (P1)

**Independent Test**: Repeated mixed-shot Preview returns identical hashes, five-slot facts, and stable blockers with zero writes/calls.

- [x] T011 [P] [US1] Add Preview compatibility/hash and stable-blocker tests in `tests/unit/generation-execution.test.ts`
- [x] T012 [P] [US1] Add Preview HTTP and isolated PostgreSQL read-only tests in `tests/contract/generation-execution-api.test.ts` and `tests/integration/generation-execution-postgres.test.ts`
- [x] T013 [US1] Implement deterministic Preview and file revalidation in `packages/project-core/src/generation-execution-service.ts`
- [x] T014 [US1] Implement Preview route in `apps/project-web/app/api/generation-plan-versions/[versionId]/execution-preview/route.ts`
- [x] T015 [US1] Add Generate & QA shot selection, blocker, prompt/reference, call-cap and cost disclosure UI in `apps/project-web/components/storyboards/shot-plan-editor.tsx`

## Phase 4: User Story 2 - Execute Exact Authorized Batch (P1)

**Independent Test**: Confirm a Fake four-shot subset and prove atomic scope, single-concurrency jobs, per-target consumptions, pause, cancel, reconciliation, and new linked attempt.

- [x] T016 [P] [US2] Add authorization/idempotency/state/retry and call-consumption unit tests in `tests/unit/generation-execution.test.ts`
- [x] T017 [P] [US2] Add sequential PostgreSQL batch claim, pause, expiry, isolation, restart, reconciliation, and history tests in `tests/integration/generation-execution-postgres.test.ts`
- [x] T018 [US2] Implement atomic confirmed Batch creation, authorization consumption, state projections, cancellation, and reconcile guards in `packages/project-core/src/generation-execution-service.ts`
- [x] T019 [US2] Implement single-concurrency GenerationWorker with Fake default and fail-pause behavior in `packages/project-core/src/generation-worker.ts` and `apps/project-worker/src/index.ts`
- [x] T020 [US2] Implement Batch, readback, reconcile, and cancel APIs in `apps/project-web/app/api/generation-batches/` and `apps/project-web/app/api/generation-jobs/`
- [x] T021 [US2] Add confirmation, progress polling, pause, cancel, evidence, and new-attempt UX in `apps/project-web/components/storyboards/shot-plan-editor.tsx`

## Phase 5: User Story 3 - Inspect and Decide QA (P1)

**Independent Test**: One Fake Job produces one valid Artifact, complete facts, three review frames, one advisory result, and append-only Owner PASS/FAIL.

- [x] T022 [P] [US3] Add Artifact/technical/frame/AI/Human QA tests in `tests/unit/generation-execution.test.ts`, `tests/contract/video-qa-provider.test.ts`, `tests/contract/generation-execution-api.test.ts`, and `tests/integration/generation-execution-postgres.test.ts`
- [x] T023 [P] [US3] Add PostgreSQL lineage, AI call consumption, decision, and assembly-eligibility tests in `tests/integration/generation-execution-postgres.test.ts`
- [x] T024 [US3] Implement Artifact retention, FFprobe checks, deterministic frames, AI QA persistence, and Human decisions in `packages/project-core/src/generated-artifact-service.ts` and `packages/project-core/src/generation-qa-service.ts`
- [x] T025 [US3] Connect Artifact and AI QA stages to GenerationWorker in `packages/project-core/src/generation-worker.ts`
- [x] T026 [US3] Implement Artifact metadata/content/frame and Human QA APIs in `apps/project-web/app/api/generated-artifacts/`
- [x] T027 [US3] Add playback, media facts, review frames, advisory criteria/limitations, and explicit PASS/FAIL UI in `apps/project-web/components/storyboards/shot-plan-editor.tsx`

## Phase 6: Polish, Verification, and LIVE Handoff

- [x] T028 Add the additive generic H3 workflow/registry documentation without changing historical bytes in `workflows/minimax-h3-project-shot-4s-v1.api.json`, `workflows/registry.json`, and `workflows/README.md`
- [x] T029 Add generated-storage/LIVE-gate/operator guidance and feature overview in `.env.example`, `README.md`, `apps/project-web/README.md`, and `specs/011-generation-execution-qa/verification.md`
- [x] T030 Run format, lint, type, default tests, sequential isolated PostgreSQL, migration preservation, production build, secret scan, diff check, and zero-call browser QA; record evidence in `specs/011-generation-execution-qa/verification.md`
- [x] T031 Run Spec Kit convergence against FR-001-FR-022 and SC-001-SC-011, append/complete genuine residual tasks, and leave LIVE execution pending action-time owner confirmation in `specs/011-generation-execution-qa/tasks.md` and `verification.md`

## Dependencies

- T001-T010 freeze shared contracts, persistence, Provider boundaries, and tests before user stories.
- US1 Preview blocks US2 because the confirmed Batch must recompute an exact Preview hash.
- US2 blocks US3 because Artifact and QA lineage begins at a single-attempt Job.
- T028 is additive and must never edit historical workflow bytes.
- T030 automated acceptance uses Fake only. No task authorizes a real H3 or CodexManager call.

## Parallel Opportunities

- T002/T003, T007/T008/T009, US-specific contract/unit tests, and documentation can run in parallel when they do not touch shared files.
- Database schema/migration and Provider pure functions can proceed independently until service integration.
- UI shells may begin after public contracts freeze, but final states depend on services and routes.

## Traceability

- US1: FR-001-FR-005, FR-017-FR-019, FR-021; SC-001-SC-002, SC-007, SC-009-SC-010.
- US2: FR-006-FR-010, FR-017-FR-022; SC-003-SC-004, SC-007, SC-009-SC-011.
- US3: FR-011-FR-017, FR-019, FR-021-FR-022; SC-005-SC-011.

## Implementation Strategy

Implement contracts and failing tests first, then persistence and pure Preview, then Fake Batch
execution, then Artifact/QA, then UI and convergence. The first complete delivery is the Fake
zero-call loop. LIVE remains disabled and cannot be treated as accepted until a later exact owner
confirmation is recorded.
