# Tasks: Whole-Film Continuity Wizard

**Input**: Design documents in `specs/013-continuity-wizard/`

## Phase 1: Contract and migration foundation

- [x] T001 [P] Add continuity/keyframe/draft public Zod contracts in `packages/contracts/src/index.ts`
- [x] T002 [P] Add failing registry and N+1-boundary unit tests in `tests/unit/continuity-registry.test.ts` and `tests/unit/continuity-service.test.ts`
- [x] T003 [P] Add failing API/provider contract tests in `tests/contract/continuity-api.test.ts` and `tests/contract/keyframe-provider.test.ts`
- [x] T004 Add additive continuity, keyframe, execution-binding, and draft models to `packages/project-core/prisma/schema.prisma`
- [x] T005 Add restrictive append-only migration in `packages/project-core/prisma/migrations/202608250014_continuity_wizard/migration.sql`
- [x] T006 Regenerate Prisma Client and validate/format schema without rewriting historical data

## Phase 2: User Story 1 - Beginner continuity setup (P1)

**Goal**: Derive and save extensible business-language continuity rules without prompt editing.

**Independent Test**: The approved three-shot Storyboard produces environment, character,
product/prop, camera, and style subjects tied to exact approved asset versions; saving appends a new
version and default DTOs contain no technical prompt/path/credential fields.

- [x] T007 [US1] Implement the controlled subject registry in `packages/project-core/src/continuity-registry.ts`
- [x] T008 [US1] Implement input schemas and finite business commands in `packages/project-core/src/continuity-contracts.ts`
- [x] T009 [US1] Implement deterministic manifest/Storyboard suggestion and canonical hashing in `packages/project-core/src/continuity-service.ts`
- [x] T010 [US1] Implement immutable profile-version append, project ownership, idempotency, and optimistic concurrency
- [x] T011 [US1] Export continuity services from `packages/project-core/src/index.ts`
- [x] T012 [US1] Add GET/suggestion/version routes under `apps/project-web/app/api/storyboards/**` and `apps/project-web/app/api/continuity-profiles/**`
- [x] T013 [US1] Make focused registry/service/API tests pass

## Phase 3: User Story 2 - Shared shot boundaries and preflight (P1)

**Goal**: One N+1 timeline finds and resolves conflicts with zero external calls.

**Independent Test**: A glass on the table at Shot 2 end and in hand at Shot 3 start returns one
subject/boundary blocker; inherit produces one shared boundary ID and state hash for both shots.

- [x] T014 [US2] Build exactly N+1 immutable boundaries and shot start/end references in the continuity service
- [x] T015 [US2] Implement stable blocker/warning classification for holds, undeclared changes, missing state, and stale sources
- [x] T016 [US2] Implement inherit/change/reference commands as new versions rather than mutations
- [x] T017 [US2] Implement append-only profile APPROVED/REJECTED/REVOKED decisions bound to preflight hash
- [x] T018 [US2] Add preflight/decision API routes and contract coverage
- [x] T019 [US2] Make shared-identity, conflict, concurrency, and zero-call tests pass

## Phase 4: User Story 3 - Bounded keyframe contact sheet (P1)

**Goal**: Preview, authorize, generate once, retain, and owner-review one keyframe per boundary.

**Independent Test**: Fake execution for three shots creates exactly four verified images, no external
calls, no retries, one artifact per boundary, and no approval until four explicit owner decisions.

- [x] T020 [P] [US3] Define independent provider contracts and deterministic Fake adapter in `packages/ai-providers/src/keyframe-image-provider.ts`
- [x] T021 [P] [US3] Add disabled-by-default Codex Manager multipart image-edit adapter with strict timeout and one-result validation
- [x] T022 [US3] Implement provider registry, explicit capability/price snapshot, and fail-closed LIVE readiness
- [x] T023 [US3] Implement N+1 plan preview/persistence and canonical target/reference hashes in `packages/project-core/src/keyframe-service.ts`
- [x] T024 [US3] Implement expiring authorization and pre-I/O one-attempt consumption semantics
- [x] T025 [US3] Implement sequential stop-on-failure execution, verified storage, attempt/artifact lineage, and no retry/fallback
- [x] T026 [US3] Implement append-only keyframe approval/rejection and all-approved frozen plan state
- [x] T027 [US3] Add preview/create/authorize/execute/decision/content routes under `apps/project-web/app/api/keyframe-*`
- [x] T028 [US3] Add environment examples for explicit keyframe live flag, gateway route, model snapshot, capabilities, price fact, and timeout
- [x] T029 [US3] Make Fake, disabled-LIVE, price-stale, failed/ambiguous, budget, storage, and API tests pass with zero real calls

## Phase 5: Beginner-facing UI (P1)

**Goal**: Complete setup, timeline conflict resolution, and contact-sheet review without technical fields.

- [x] T030 [US1] Add dedicated continuity page and server data loader under the Storyboard route
- [x] T031 [US1] Add step navigation links from Storyboard and Shot Plan
- [x] T032 [US1] Implement reusable subject cards with whole-film/change/unimportant choices and auto-prefill
- [x] T033 [US2] Implement horizontal shot timeline with inherited/change/conflict/soft-reference states and business actions
- [x] T034 [US3] Implement keyframe preview confirmation with exact calls, cost/as-of/expiry, no-retry, and capability limits
- [x] T035 [US3] Implement N+1 contact sheet, image decisions, and frozen-version status
- [x] T036 Collapse prompt, SHA, reference slot, workflow, and model details behind `高级信息` throughout the default flow
- [x] T037 Add responsive/accessibility styles and plain Chinese labels in `apps/project-web/app/globals.css`
- [x] T038 Make component/render/i18n contract tests pass for an owner who never opens advanced information

## Phase 6: User Story 4 - Continuity-aware video execution (P1)

**Goal**: Bind approved boundaries/keyframes honestly to a one-attempt-per-shot video batch.

**Independent Test**: H3 reports ordinary reference, rejects a hard locked-end rule, replaces Scene
with the approved start keyframe, binds the end as soft QA target, and previews three maximum calls
without submitting.

- [x] T039 [US4] Add explicit video control tier to generation provider contracts/registry; register H3 as ORDINARY_REFERENCE
- [x] T040 [US4] Extend execution preview inputs/DTOs with optional approved keyframe plan binding and backward-compatible null history
- [x] T041 [US4] Validate approved/still-current profile, boundary, keyframe, source asset, Storyboard, plan, and Provider snapshots
- [x] T042 [US4] Replace H3 Scene slot with start keyframe while preserving exact four other semantic references
- [x] T043 [US4] Bind end keyframe as soft QA comparison target and include all hashes in preview/scope/target identity
- [x] T044 [US4] Block hard requirements above provider tier and expose understandable soft-risk warnings
- [x] T045 [US4] Persist continuity bindings on batch/targets and revalidate before each submission
- [x] T046 [US4] Ensure hard/ambiguous failure pauses later jobs while visual advisory warning never retries or pauses
- [x] T047 [US4] Make execution stale/capability/H3/budget/backward-compatibility tests pass

## Phase 7: User Story 5 - Warned draft versus formal assembly (P2)

**Goal**: Watch a local whole-film draft with warnings without changing Human PASS or formal output.

**Independent Test**: Three technically valid videos with one warning and no Human PASS create a
clearly labeled draft; formal assembly stays ineligible and all source/history rows remain unchanged.

- [x] T048 [P] [US5] Add draft source-selection/hash tests in `tests/unit/generation-plan-draft.test.ts`
- [x] T049 [US5] Implement latest technically valid artifact selection and warning snapshots in `packages/project-core/src/generation-plan-draft-service.ts`
- [x] T050 [US5] Reuse local FFmpeg/FFprobe/storage primitives for idempotent immutable draft assembly
- [x] T051 [US5] Add draft state/create/content routes separate from formal assembly routes
- [x] T052 [US5] Add warning-labeled draft playback/history to Shot Plan UI without changing formal controls
- [x] T053 [US5] Make draft/formal separation, missing/corrupt source, idempotency, and Range tests pass

## Phase 8: Verification and convergence

- [x] T054 Run focused unit/contract/PostgreSQL/integration suites and prove zero LIVE image/video/AI calls
- [x] T055 Run Prisma validation and forward migration rehearsal against a Phase 12 snapshot
- [x] T056 Run formatting, type checking, ESLint, secret scan, full Vitest, and production build
- [ ] T057 Run in-app browser QA for the actual three-shot beginner flow using Fake keyframes only
- [x] T058 Verify historical retry, QA, and formal assembly records remain unchanged/readable
- [x] T059 Run Spec Kit cross-artifact analysis, repair material findings, and write `verification.md`
- [x] T060 Run convergence against FR-001..FR-028 and SC-001..SC-010; leave real LIVE acceptance pending fresh owner confirmation

## Dependencies and execution order

- T001-T006 block persistence/services.
- T007-T013 block timeline/preflight and UI.
- T014-T019 block keyframe planning.
- T020-T029 block keyframe UI and video binding.
- T039-T047 require approved keyframe service/contracts.
- T048-T053 require existing generated-artifact and formal assembly behavior but can proceed after schema.
- T054-T060 follow all implementation tasks.

## Safety boundary

- No task authorizes a LIVE Codex Manager image request, H3 video request, or AI QA request.
- Fake provider is the only keyframe executor used by automated/browser acceptance.
- Real three-shot image/video acceptance requires a new action-time confirmation showing exact current
  scope, call ceilings, price facts, expiry, and no-retry policy.
