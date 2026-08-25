# Tasks: Real AI Director Proposal Workflow

## Phase 1: Setup

- [x] T001 Record the reviewed constitution and Terra design decisions in specs/014-real-ai-director/
- [x] T002 Verify isolated dependencies and baseline quality gates in package.json

## Phase 2: Foundational Contracts and Persistence

- [x] T003 [P] Add strict Storyboard V2 contracts while preserving V1 in packages/contracts/src/index.ts
- [x] T004 [P] Add Provider V2 capability and Fake implementation in packages/ai-providers/src/
- [x] T005 Add additive Director entities and AI_DIRECTOR provenance in packages/project-core/prisma/schema.prisma
- [x] T006 Add migration without historical rewrites in packages/project-core/prisma/migrations/
- [x] T007 [P] Add V1/V2 contract and migration-preservation tests in tests/

## Phase 3: User Story 1 - Preview and Authorization

- [x] T008 [US1] Add server-owned profiles and preview DTOs in packages/project-core/src/storyboard-director-contracts.ts
- [x] T009 [US1] Implement deterministic eligibility, hash verification and preview in packages/project-core/src/storyboard-director-service.ts
- [x] T010 [US1] Implement atomic confirmation, If-Match, price and idempotency checks in packages/project-core/src/storyboard-director-service.ts
- [x] T011 [P] [US1] Add preview and run routes in apps/project-web/app/api/storyboards/[storyboardId]/
- [x] T012 [US1] Add zero-write/stale/concurrent preview tests in tests/integration/storyboard-director-v2-postgres.test.ts

## Phase 4: User Story 2 - One Attempt and Immutable Proposal

- [x] T013 [US2] Implement Terra structured-output adapters with one request in packages/ai-providers/src/
- [x] T014 [US2] Implement authorization-first lease and attempt execution in packages/project-core/src/storyboard-director-worker.ts
- [x] T015 [US2] Add Director queue processing to apps/project-worker/src/worker-loop.ts and apps/project-worker/src/index.ts
- [x] T016 [P] [US2] Add run/proposal read routes in apps/project-web/app/api/
- [x] T017 [US2] Test strict failures, JSON/SSE, one request, crash and ambiguity in tests/

## Phase 5: User Story 3 - Compare, Decide and Adopt

- [x] T018 [US3] Implement immutable decisions and drift-safe atomic adoption in packages/project-core/src/storyboard-director-service.ts
- [x] T019 [P] [US3] Add decision and adoption routes in apps/project-web/app/api/storyboard-director-proposals/
- [x] T020 [US3] Add Chinese proposal workflow to apps/project-web/components/storyboards/storyboard-director-panel.tsx
- [x] T021 [US3] Integrate panel in apps/project-web/components/storyboards/storyboard-editor.tsx
- [x] T022 [US3] Test no-mutation proposal, rejection, edited adoption and stale tabs in tests/

## Phase 6: User Story 4 - Explicit Terra Profiles

- [x] T023 [US4] Enforce LIVE gate, current price facts and exact gpt-5.6-terra profiles in packages/project-core/src/storyboard-director-profiles.ts
- [x] T024 [US4] Test browser/provider override isolation and expired-price failure in tests/

## Phase 7: Polish and Verification

- [x] T025 Run Prisma, format, lint, typecheck, complete tests, serial PostgreSQL and production build
- [x] T026 Run Fake browser acceptance and record zero external calls in specs/014-real-ai-director/verification.md
- [x] T027 Run secret scan, diff check, Spec Kit convergence and preserve Phase 13 unfinished state

## Dependencies and Independent Tests

Foundations block all stories. US1 blocks US2; US2 blocks US3. Fake US1-US3 are the zero-call MVP.
US1 proves preview/authorization; US2 proves one immutable proposal; US3 proves reject/adopt boundaries;
US4 proves exact Terra profiles fail closed without LIVE and current price facts.

## Phase 8: Convergence

- [x] T028 Add a Terra-specific CodexManager SSE single-request test per US4/AC1 (partial)
- [x] T029 Display all rejected Director reference candidates and reasons in the Chinese preview UI per FR-008 (partial)
