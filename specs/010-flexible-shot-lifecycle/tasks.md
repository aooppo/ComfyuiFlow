# Tasks: Flexible Shot Lifecycle

## Phase 1: Living Specifications and Shared Boundaries

- [x] T001 Update obsolete exactly-three approval/planning rules while retaining the Fake Director three-shot rule in `specs/008-storyboard-workspace/{spec.md,plan.md,data-model.md,contracts/storyboard-api.md,quickstart.md}` and `specs/009-shot-planner-generation-spec/{spec.md,plan.md,research.md,contracts/generation-plan-api.md,quickstart.md}`
- [x] T002 [P] Add 1–20 shot/spec contract and compatibility tests in `tests/unit/storyboard-contracts.test.ts`, `tests/unit/generation-specs.test.ts`, and `tests/contract/storyboard-provider.test.ts`
- [x] T003 [P] Add lifecycle API/error contract tests in `tests/contract/storyboards-api.test.ts`
- [x] T004 Expand shared ordinal/cardinality schemas and stable lifecycle errors in `packages/contracts/src/index.ts` and `packages/project-core/src/{storyboard-contracts.ts,generation-plan-contracts.ts}`

## Phase 2: Persistence and Lifecycle Foundation

- [x] T005 Add Storyboard ACTIVE/ARCHIVED lifecycle fields and indexes in `packages/project-core/prisma/schema.prisma`
- [x] T006 Add an additive preservation-safe migration in `packages/project-core/prisma/migrations/202608250008_flexible_shot_lifecycle/migration.sql`
- [x] T007 Add variable-shot and lifecycle service regression tests in `tests/unit/storyboards.test.ts` and `tests/integration/storyboards.test.ts`
- [x] T008 Add variable-plan deterministic/preflight regression tests in `tests/unit/generation-specs.test.ts` and `tests/integration/generation-plans.test.ts`

## Phase 3: User Story 1 - Shape a Variable-Length Storyboard (P1)

**Independent Test**: Add, remove, reorder, save, and reload a four-shot owner version while the prior three-shot version remains unchanged.

- [x] T009 [US1] Enforce 1–20 unique contiguous shots and generate structured requirements for every current ordinal in `packages/project-core/src/storyboard-service.ts`
- [x] T010 [US1] Add client-side shot creation, removal, reordering, boundary messaging, and approval eligibility in `apps/project-web/components/storyboards/storyboard-editor.tsx` and `apps/project-web/components/storyboards/types.ts`
- [x] T011 [US1] Add responsive variable-shot controls and translations in `apps/project-web/app/globals.css` and `apps/project-web/components/i18n/language-provider.tsx`

## Phase 4: User Story 2 - Plan Every Approved Shot (P1)

**Independent Test**: Create, edit, preflight, approve, and compare plans sourced from 1-, 4-, and 20-shot Storyboards with one deterministic spec per source shot.

- [x] T012 [US2] Generalize deterministic planning and source identity validation to 1–20 shots in `packages/project-core/src/deterministic-shot-planner.ts` and `packages/project-core/src/generation-plan-service.ts`
- [x] T013 [US2] Generalize Shot Plan display, comparison, and decision messaging for variable spec counts in `apps/project-web/components/storyboards/shot-plan-editor.tsx`
- [x] T014 [US2] Extend isolated PostgreSQL one/four/twenty-shot, hash, immutable, and zero-write coverage in `tests/integration/storyboards-postgres.test.ts` and `tests/integration/generation-plans-postgres.test.ts`

## Phase 5: User Story 3 - Remove or Recover Storyboards Safely (P2)

**Independent Test**: Hard-delete an empty Storyboard, archive a versioned Storyboard, prove all writes fail while archived, restore it, and read back unchanged versions/plans/hashes.

- [x] T015 [US3] Implement list filtering, dependency-aware hard delete, optimistic archive/restore, and archived write guards in `packages/project-core/src/storyboard-service.ts` and `packages/project-core/src/generation-plan-service.ts`
- [x] T016 [US3] Implement lifecycle routes under `apps/project-web/app/api/storyboards/[storyboardId]/` and status filtering in `apps/project-web/app/api/projects/[projectId]/storyboards/route.ts`
- [x] T017 [US3] Add non-destructive card action menus, confirmation, archived view, and restore UI in `apps/project-web/components/storyboards/storyboard-library.tsx`, `apps/project-web/components/storyboards/types.ts`, `apps/project-web/app/globals.css`, and translations
- [x] T018 [US3] Add PostgreSQL delete/archive/restore preservation, stale conflict, archived write-block, and project-isolation coverage in `tests/integration/storyboards-postgres.test.ts` and `tests/integration/generation-plans-postgres.test.ts`

## Phase 6: Convergence and Delivery

- [x] T019 Update `README.md`, `apps/project-web/README.md`, and `specs/010-flexible-shot-lifecycle/verification.md` with lifecycle, variable-shot, migration, zero-call, and Human QA boundaries
- [x] T020 Run format, lint, type, default tests, Prisma generation/validation, isolated PostgreSQL, migration preservation, production build, secret scan, and diff checks and record evidence in `specs/010-flexible-shot-lifecycle/verification.md`
- [x] T021 Run browser QA for add/remove/reorder/save and lifecycle controls; combine it with isolated database 1/4/20 plan and archive/delete/restore evidence, then record the Owner Human QA boundary in `specs/010-flexible-shot-lifecycle/verification.md`
- [x] T022 Run Spec Kit converge against FR-001–FR-019 and SC-001–SC-010; append and complete genuine residual tasks

## Dependencies

- T001–T004 freeze the shared boundary before persistence or implementation.
- T005/T006 block lifecycle implementation and PostgreSQL coverage.
- US1 blocks US2 because the planner consumes approved variable-length Storyboard versions.
- US3 can be implemented after the lifecycle migration and shares write guards with US1/US2.
- No task authorizes Provider selection, ComfyUI submission, video generation, automatic retry, or deletion of durable history.

## Parallel Opportunities

- T002 and T003 may run in parallel because they target separate contract suites.
- UI work T011 may proceed after T004 while service work T009 is underway.
- Variable planner UI T013 may proceed after T004 while service work T012 is underway.
- Documentation T019 may begin after contracts stabilize, but evidence is completed only after T020/T021.

## Traceability

- US1: FR-001–FR-006, FR-009–FR-010, FR-017–FR-019; SC-001–SC-002, SC-004–SC-005, SC-008–SC-010.
- US2: FR-007–FR-010, FR-017–FR-019; SC-003–SC-005, SC-008–SC-010.
- US3: FR-011–FR-018; SC-004, SC-006–SC-010.
