# Tasks: Wan2.2 Stability Recovery

**Input**: Design documents from `specs/003-wan22-stability-recovery/`

**Tests**: Required because the candidate must preserve workflow hashes, zero-call defaults,
one-submission limits, and query-only reconciliation.

## Phase 1: Setup

**Purpose**: Lock the failed baseline before adding a replacement.

- [x] T001 Add failing v1 preservation and stable v2 candidate contract tests in `tests/contract/wan22-workflow.test.ts`

---

## Phase 2: Foundational

**Purpose**: Add shared safety tests before changing runtime behavior.

- [x] T002 [P] Add concise positive-prompt compiler coverage in `tests/integration/live-safety.test.ts`
- [x] T003 [P] Add ten-minute polling and no-resubmission recovery coverage in `tests/integration/live-safety.test.ts`

**Checkpoint**: Tests describe the new candidate and recovery behavior before implementation.

---

## Phase 3: User Story 1 — Receive a safer candidate without learning ComfyUI (Priority: P1) 🎯 MVP

**Goal**: Register an immutable, plain-language stable candidate while preserving the failed v1.

**Independent Test**: Load both workflow manifests, prove v1 bytes/hash are unchanged and disabled,
materialize v2 with both references, and inspect its zero-call dry-run.

- [x] T004 [US1] Add `workflows/wan22-ti2v-5b-dual-reference-stable.api.json` with official 20-step sampling, a new fixed seed, and expanded negative quality exclusions
- [x] T005 [US1] Preserve and disable v1 while registering hash-locked stable v2 in `workflows/registry.json` and document both in `workflows/README.md`
- [x] T006 [US1] Compile only positive state, action, camera, and composition guidance in `packages/spike-core/src/prompt-compiler.ts`, `packages/spike-core/src/index.ts`, and `apps/spike-cli/src/index.ts`
- [x] T007 [US1] Update `tests/contract/wan22-workflow.test.ts` and `tests/integration/dry-run.test.ts` to prove v2 bindings, profile, zero calls, and v1 preservation

**Checkpoint**: A non-technical owner can select v2 without reading the graph, and validation makes zero calls.

---

## Phase 4: User Story 2 — Run one controlled recovery attempt (Priority: P1)

**Goal**: Observe one slow local task long enough without changing one-call authorization semantics.

**Independent Test**: Fake a task that completes after the old polling bound and verify one submit,
one retained artifact, and no reconciliation resubmit.

- [x] T008 [US2] Set the CLI live-run polling bound to ten minutes in `apps/spike-cli/src/index.ts`
- [x] T009 [US2] Finalize polling-limit ambiguity and legacy reconciliation regression coverage in `packages/spike-core/src/run-service.ts` and `tests/integration/live-safety.test.ts`
- [x] T010 [US2] Add the stable candidate request and exact zero-call verification procedure to `specs/003-wan22-stability-recovery/quickstart.md` and `specs/003-wan22-stability-recovery/verification.md`

**Checkpoint**: The runtime can wait for the observed five-minute task or reconcile it without a second submission.

---

## Phase 5: User Story 3 — Continue honestly if quality still fails (Priority: P2)

**Goal**: Produce review evidence without auto-promoting or retrying.

**Independent Test**: Use the retained artifact path to create a first/middle/final contact sheet,
record an owner decision, and confirm FAIL leaves the gate closed.

- [x] T011 [US3] Document deterministic first/middle/final FFmpeg review-frame extraction in `specs/003-wan22-stability-recovery/quickstart.md`
- [x] T012 [US3] Preserve explicit owner-only PASS/FAIL gating coverage in `tests/integration/live-safety.test.ts`

**Checkpoint**: Technical completion remains distinct from Human QA and never initiates another attempt.

---

## Phase 6: Polish & Zero-Call Readiness

- [x] T013 Run lint, typecheck, tests, build, formatting, secret scan, live readiness, native no-queue validation, and the exact asset dry-run; record results in `specs/003-wan22-stability-recovery/verification.md`
- [ ] T014 After a new exact owner authorization, execute at most one Director call and one stable-v2 ComfyUI submission, retain/inspect the artifact, and append Human QA evidence in `specs/003-wan22-stability-recovery/verification.md`

---

## Dependencies & Execution Order

- T001-T003 establish failing safety expectations.
- T004-T007 complete User Story 1 and block the runtime work.
- T008-T010 complete User Story 2 without a real provider call.
- T011-T012 complete review preparation independently of LIVE execution.
- T013 validates the complete zero-call scope.
- T014 is separately gated by a new user authorization and cannot run automatically.

## Parallel Opportunities

- T002 and T003 affect distinct assertions and can be prepared together before runtime changes.
- Documentation for T011 can proceed after the media profile is fixed while T008-T009 are tested.

## Implementation Strategy

1. Preserve the failed baseline and add tests first.
2. Deliver v2 plus plain-language dry-run as the zero-call MVP.
3. Extend polling and review evidence without weakening authorization.
4. Complete T013 and stop at the exact authorization boundary.
5. Run T014 only after the owner approves the new scope hash.
