# Tasks: Shot Planner and GenerationSpec

## Phase 1: Phase 2/3 Closure and Shared Contracts

- [x] T001 Record owner Human QA 1–9 PASS and current zero-call evidence in `specs/007-asset-understanding/verification.md` and `specs/008-storyboard-workspace/verification.md`
- [x] T002 Isolate Next development and production build output in `apps/project-web/next.config.ts`, `apps/project-web/package.json`, `.gitignore`, and `tests/contract/next-build-isolation.test.ts`
- [x] T003 [P] Add strict GenerationSpec and plan input/result schemas in `packages/contracts/src/index.ts`
- [x] T004 [P] Add plan API schemas, ETag parsing, errors, and safe DTOs in `packages/project-core/src/generation-plan-contracts.ts`
- [x] T005 Export the new contracts and services without changing legacy interfaces in `packages/project-core/src/index.ts`

## Phase 2: Persistence and Deterministic Planner Foundation

- [x] T006 [P] Add deterministic contract/hash/provider-field rejection tests in consolidated `tests/unit/generation-specs.test.ts`
- [x] T007 [P] Add route, ETag, idempotency, and safe-error tests in `tests/contract/generation-plans-api.test.ts`
- [x] T008 Add GenerationPlan entities and project relations in `packages/project-core/prisma/schema.prisma`
- [x] T009 Add the additive migration, project-composite keys, and immutable triggers in `packages/project-core/prisma/migrations/202608250007_generation_plans/migration.sql`
- [x] T010 Implement the pure deterministic three-shot transformation in `packages/project-core/src/deterministic-shot-planner.ts`

## Phase 3: User Story 1 - Create a Deterministic Plan (P1)

**Independent Test**: Two distinct create requests over the same approved input retain distinct plan identities and identical normalized specifications/hashes with zero external calls.

- [x] T011 [P] [US1] Add create/replay/rejection service scenarios in `tests/integration/generation-plans-postgres.test.ts`
- [x] T012 [US1] Implement approved input loading, idempotent create, exact references, and append transaction in `packages/project-core/src/generation-plan-service.ts`
- [x] T013 [US1] Implement create/read/history HTTP routes under `apps/project-web/app/api/storyboard-versions/[versionId]/generation-plans/` and `apps/project-web/app/api/generation-plans/`
- [x] T014 [US1] Add a Shot Plan entry and read-only three-spec overview in consolidated `apps/project-web/components/storyboards/shot-plan-editor.tsx` and the Storyboard editor

## Phase 4: User Story 2 - Edit, Compare, and Preflight (P1)

**Independent Test**: One owner append wins, a stale writer makes zero writes, history compares correctly, and preflight returns current blockers without durable writes.

- [x] T015 [P] [US2] Add concurrent append, immutable trigger, preflight blocker, and zero-write PostgreSQL tests in `tests/integration/generation-plans-postgres.test.ts`
- [x] T016 [US2] Implement append, history comparison, and live-fact preflight in `packages/project-core/src/generation-plan-service.ts`
- [x] T017 [US2] Implement version append/history/preflight routes under `apps/project-web/app/api/generation-plans/` and `apps/project-web/app/api/generation-plan-versions/`
- [x] T018 [US2] Implement prompt editing, conflict recovery, history comparison, reference facts, and preflight UI in consolidated `apps/project-web/components/storyboards/shot-plan-editor.tsx`

## Phase 5: User Story 3 - Approve and Revoke (P2)

**Independent Test**: A current preflight-passing head can be approved and revoked through append-only decisions while generation authorization remains false.

- [x] T019 [P] [US3] Add decision idempotency, current-head, failed-preflight, approval, revocation, and zero-call tests in `tests/integration/generation-plans-postgres.test.ts`
- [x] T020 [US3] Implement append-only decisions and projections in `packages/project-core/src/generation-plan-service.ts`
- [x] T021 [US3] Implement decision route under `apps/project-web/app/api/generation-plan-versions/[versionId]/decisions/route.ts`
- [x] T022 [US3] Add approval/revocation history and generation-not-authorized messaging in consolidated `apps/project-web/components/storyboards/shot-plan-editor.tsx`

## Phase 6: Convergence and Delivery

- [x] T023 Add migration snapshot preservation rehearsal and project-isolation coverage in `tests/integration/generation-plans-postgres.test.ts` plus `verification.md`
- [x] T024 [P] Add forbidden field/path/payload and zero-call security checks in consolidated `tests/unit/generation-specs.test.ts`, `tests/unit/security.test.ts`, and contract suites
- [x] T025 Update `README.md`, `apps/project-web/README.md`, and `specs/009-shot-planner-generation-spec/verification.md` with boundaries and exact evidence
- [x] T026 Run format, lint, type, unit/contract/integration, Prisma, isolated PostgreSQL, build-with-dev-running, secret, and diff gates and record results in `verification.md`
- [x] T027 Run technical browser QA for create/edit/history/preflight/approve/revoke and record the explicit Phase 4 Human QA boundary in `verification.md`
- [x] T028 Run Spec Kit analyze and converge against FR-001–FR-022 and SC-001–SC-010; append and complete genuine residual tasks

## Dependencies

- T003–T005 freeze the public boundary before schema/service work.
- T006/T007 are test-first and may run in parallel; T008–T010 block all user stories.
- US1 blocks US2; US2 blocks approval in US3.
- No task authorizes an external call, Provider selection, ComfyUI submission, or video generation.

## Traceability

- US1: FR-001–FR-005, FR-007–FR-010, FR-015–FR-017, FR-020–FR-022; SC-001, SC-002, SC-004, SC-005, SC-008, SC-009.
- US2: FR-005–FR-012, FR-015–FR-018, FR-020–FR-022; SC-003–SC-008.
- US3: FR-013–FR-020; SC-005, SC-007, SC-009.
- T023–T028 cover migration, compatibility, security, quality, and acceptance criteria across all stories.
