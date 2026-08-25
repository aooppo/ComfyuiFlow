# Tasks: Approved Shot Plan Assembly

**Input**: Design documents in `specs/012-shot-plan-assembly/`

## Phase 1: Setup and Contract Baseline

- [x] T001 Confirm current generation-history changes and dirty worktree boundaries without reverting unrelated files
- [x] T002 [P] Add contract-focused failing tests in `tests/contract/generation-plan-assembly-api.test.ts`
- [x] T003 [P] Add source-selection and source-set hash failing tests in `tests/unit/generation-plan-assembly.test.ts`

## Phase 2: Foundational Data and Storage

- [x] T004 Add append-only assembly models and relations in `packages/project-core/prisma/schema.prisma`
- [x] T005 Add additive migration in `packages/project-core/prisma/migrations/202608250013_plan_assembly/migration.sql`
- [x] T006 Regenerate Prisma Client and verify schema formatting/validation

## Phase 3: User Story 1 - Know When Assembly Is Ready (P1)

**Goal**: Resolve exact owner-PASS sources for the approved version and list missing ordinals.

**Independent Test**: PASS for shots 1-2 and blank/FAIL for shot 3 returns `eligible=false` and
`missingOrdinals=[3]` without any write or external call.

- [x] T007 [US1] Implement pure latest-owner-PASS selection and canonical hashing in `packages/project-core/src/generation-plan-assembly-service.ts`
- [x] T008 [US1] Implement safe read-only plan assembly state and history projection in the same service
- [x] T009 [US1] Export the service from `packages/project-core/src/index.ts`
- [x] T010 [US1] Add GET route in `apps/project-web/app/api/generation-plans/[planId]/assemblies/route.ts`
- [x] T011 [US1] Make source-selection and GET contract tests pass

## Phase 4: User Story 2 - Create and Use a Combined Preview (P1)

**Goal**: Explicitly concatenate exact accepted sources locally, retain the output, play, and download.

**Independent Test**: One POST creates a validated silent portrait MP4 in ordinal order; a duplicate
POST returns the same assembly with no duplicate row or file.

- [x] T012 [US2] Implement verified source resolution, temporary FFmpeg assembly, and FFprobe checks in `packages/project-core/src/generation-plan-assembly-service.ts`
- [x] T013 [US2] Implement append-only idempotent persistence and race handling in the service
- [x] T014 [US2] Implement POST creation in `apps/project-web/app/api/generation-plans/[planId]/assemblies/route.ts`
- [x] T015 [US2] Add verified Range content route in `apps/project-web/app/api/generation-plan-assemblies/[assemblyId]/content/route.ts`
- [x] T016 [US2] Make POST/content contract tests and local media integration coverage pass
- [x] T017 [US2] Add eligibility, explicit local assembly, preview, and download UI in `apps/project-web/components/storyboards/shot-plan-editor.tsx`
- [x] T018 [US2] Add responsive assembly styles in `apps/project-web/app/globals.css`

## Phase 5: User Story 3 - Preserve History and Retry Baselines (P2)

**Goal**: Keep all prior assemblies and generation attempts inspectable while newer PASS sources make
only a new assembly version current.

**Independent Test**: A newer Shot 3 PASS marks the previous assembly stale but leaves its content
playable; the 17:42 failed artifact and QA notes remain unchanged.

- [x] T019 [US3] Add current/stale history rendering and source lineage in `apps/project-web/components/storyboards/shot-plan-editor.tsx`
- [x] T020 [US3] Refresh assembly eligibility after Human QA decisions without auto-assembling
- [x] T021 [US3] Verify the 17:42 Shot 3 record remains FAIL and document the exact future retry baseline without submitting a paid attempt

## Phase 6: Verification and Convergence

- [x] T022 Run focused unit/contract/integration tests and prove zero Provider/AI QA calls
- [x] T023 Run Prisma validation/migration rehearsal, type checks, ESLint, and Next.js production build
- [x] T024 Run in-app browser QA for the real missing-Shot-3 and historical-baseline states, plus automated all-PASS media/preview coverage without altering owner decisions
- [x] T025 Run Spec Kit consistency analysis, repair material findings, and write `specs/012-shot-plan-assembly/verification.md`
- [x] T026 Converge every acceptance criterion and hand off without executing any paid retry

## Dependencies and Execution Order

- T004-T006 block all service/API implementation.
- T007-T011 complete eligibility before T012-T018 create or display output.
- T019-T021 depend on the current assembly and history projection.
- T022-T026 depend on all implementation tasks.

## Safety Boundary

- No task authorizes H3, ComfyUI, CodexManager, AI QA, or any other external call.
- No task changes the historical owner FAIL for the 17:42 Shot 3 artifact.
- A future paid Shot 3 retry requires its own zero-call preview and fresh action-time owner confirmation.
