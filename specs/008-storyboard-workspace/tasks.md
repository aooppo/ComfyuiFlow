# Tasks: Three-Shot Storyboard Workspace

**Input**: Design documents from `/specs/008-storyboard-workspace/`

**Tests**: Test-first tasks are required because this feature changes immutable history, project
isolation, candidate authority, and approval gates.

## Phase 1: Shared Contracts and Safety Foundation

- [x] T001 [P] Add failing recursive canonical JSON/hash tests in `tests/unit/storyboard-contracts.test.ts`
- [x] T002 [P] Add failing Storyboard Provider compatibility and three-shot determinism tests in `tests/contract/storyboard-provider.test.ts`
- [x] T003 Define versioned Storyboard request/result and shot DTOs in `packages/contracts/src/index.ts`
- [x] T004 Implement recursive canonical JSON/hash utilities and align candidate hashing in `packages/project-core/src/canonical-json.ts` and `packages/project-core/src/asset-candidate-contracts.ts`
- [x] T005 Extend provider capabilities additively and implement the zero-call Fake Storyboard Provider in `packages/ai-providers/src/provider.ts`, `fake-storyboard-provider.ts`, and `index.ts`
- [x] T006 Add server-only Phase 2 Storyboard gate configuration with false default in `.env.example` and `packages/project-core/src/storyboard-gate.ts`

**Checkpoint**: Contracts compile, Fake always emits deterministic three-shot content, legacy one-shot contracts remain unchanged, and the gate defaults closed.

## Phase 2: Storyboard Persistence Foundation

- [x] T007 [P] Add failing schema/state/approval invariant tests in `tests/unit/storyboards.test.ts`
- [x] T008 [P] Add failing API error, ETag, and route contract tests in `tests/contract/storyboards-api.test.ts`
- [x] T009 Define Storyboard API/service schemas and stable errors in `packages/project-core/src/storyboard-contracts.ts`
- [x] T010 Add Storyboard entities, relations, indexes, and project composite keys to `packages/project-core/prisma/schema.prisma`
- [x] T011 Add compatible Storyboard migration, composite foreign keys, and immutable triggers in `packages/project-core/prisma/migrations/202608250005_storyboard_workspace/migration.sql`
- [x] T012 Export Storyboard contracts, services, gate, and canonical helpers from `packages/project-core/src/index.ts`

**Checkpoint**: Prisma validates, migration applies to an isolated database, and immutable Storyboard content has database backstops.

## Phase 3: User Story 1 - Create a Three-Shot Draft (P1)

**Independent Test**: An active project creates a Storyboard and deterministic Fake proposal, reloads it, and records zero external calls.

- [x] T013 [P] [US1] Add failing service integration tests for create/generate/reload/archived-project behavior in `tests/integration/storyboards.test.ts`
- [x] T014 [US1] Implement Storyboard create/list/get, Fake run provenance, and atomic proposal append in `packages/project-core/src/storyboard-service.ts`
- [x] T015 [US1] Implement project Storyboard list/create and Fake generate routes under `apps/project-web/app/api/projects/[projectId]/storyboards/` and `apps/project-web/app/api/storyboards/[storyboardId]/generate/route.ts`
- [x] T016 [US1] Add Storyboards project entry, list page, and creation/Fake flow in `apps/project-web/components/storyboards/` and `apps/project-web/app/projects/[projectId]/storyboards/`

## Phase 4: User Story 2 - Edit and Compare Immutable Versions (P1)

**Independent Test**: Two writers save from one head; one appends a version, one receives a conflict, and all historical content remains readable.

- [x] T017 [P] [US2] Add failing concurrent append, stale ETag, and history tests in `tests/integration/storyboard-versioning.test.ts`
- [x] T018 [US2] Implement owner version append, head compare-and-swap, version reads, history, and comparison projections in `packages/project-core/src/storyboard-service.ts`
- [x] T019 [US2] Implement Storyboard/version GET and append routes with ETag/If-Match under `apps/project-web/app/api/storyboards/` and `apps/project-web/app/api/storyboard-versions/`
- [x] T020 [US2] Implement the separate three-shot editor, ordering, save-conflict recovery, history, and comparison UI in `apps/project-web/components/storyboards/` and `apps/project-web/app/projects/[projectId]/storyboards/[storyboardId]/page.tsx`

## Phase 5: User Story 3 - Preview, Resolve, and Approve Assets (P2)

**Independent Test**: Gate-closed resolve/approve makes zero writes; gate-open selection is revalidated, frozen, explicitly approved, and revocable.

- [x] T021 [P] [US3] Add failing gate-closed, candidate revalidation, manifest hash, approval, revocation, and cross-project tests in `tests/integration/storyboard-assets.test.ts`
- [x] T022 [US3] Implement aggregated candidate preview and result DTO alignment in `packages/project-core/src/asset-candidate-policy.ts` and `packages/project-core/src/asset-candidate-service.ts`
- [x] T023 [US3] Implement gate-checked resolution, exact binding, manifest freezing, approval, and revocation in `packages/project-core/src/storyboard-service.ts`
- [x] T024 [US3] Implement candidate preview, manifest, and decision routes under `apps/project-web/app/api/storyboard-versions/[versionId]/`
- [x] T025 [US3] Implement candidate gaps, manual selections, manifest state, approval/revocation, and generation-not-authorized messaging in `apps/project-web/components/storyboards/`

## Phase 6: PostgreSQL, Documentation, and Convergence

- [x] T026 Add isolated PostgreSQL concurrency, immutable trigger, composite FK, restart, manifest, and approval tests in `tests/integration/storyboards-postgres.test.ts`
- [x] T027 Update `README.md`, `apps/project-web/README.md`, and `specs/008-storyboard-workspace/verification.md` with boundaries, migration evidence, Human QA, and the zero-call ledger
- [x] T028 Run Spec Kit analyze plus repository format, lint, type, unit/contract/integration, Prisma, isolated PostgreSQL, build, secret, and diff gates; record exact evidence in `specs/008-storyboard-workspace/verification.md`
- [x] T029 Run Spec Kit converge against FR-001–FR-022 and SC-001–SC-010, append any genuine residual tasks, implement them, and rerun convergence

## Dependencies and Parallel Execution

- T001/T002 may run in parallel; T003–T006 complete the shared contract checkpoint.
- T007/T008 may run in parallel; T009–T012 block all user stories.
- US1 precedes US2 because editing requires an existing Storyboard head.
- US3 preview may begin after T012, but formal resolve/approve remains blocked until `007` Phase 2 Gate evidence passes.
- T026 and browser Human QA use isolated data and must not run against the default business database.

## Traceability

- US1: FR-001–FR-005, FR-020–FR-022; SC-001, SC-007, SC-009.
- US2: FR-006–FR-009, FR-018–FR-021; SC-002, SC-003, SC-008.
- US3: FR-010–FR-019, FR-022; SC-003–SC-006, SC-008–SC-010.

Completion never grants a live Provider call, ComfyUI submission, video generation, semantic QA
approval, or final assembly authority.
