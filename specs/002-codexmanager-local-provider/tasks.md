# Tasks: CodexManager Local Test Provider

**Input**: Design documents from `specs/002-codexmanager-local-provider/`

## Phase 1: Setup

**Purpose**: Establish fixed provider registration and test fixtures without enabling real calls.

- [x] T001 Add CodexManager local provider constants and exports in `packages/ai-providers/src/codexmanager-local-provider.ts` and `packages/ai-providers/src/index.ts`

---

## Phase 2: Foundational

**Purpose**: Add server-only runtime configuration required by every story.

- [x] T002 Extend fixed loopback gateway, credential state, and LIVE gate configuration in `packages/spike-core/src/config.ts`
- [x] T003 [P] Add missing-secret and secret-redaction coverage in `tests/unit/security.test.ts`

**Checkpoint**: The local Provider can be identified and configured without exposing a secret or accepting an arbitrary URL.

---

## Phase 3: User Story 1 — Use the local gateway for safe tests (Priority: P1) 🎯 MVP

**Goal**: Make `codexmanager-local` the default Director Provider for dry-run and bounded LIVE wiring.

**Independent Test**: A dry-run reports `codexmanager-local`, the registered model, loopback destination classification, and zero calls; a fake LIVE adapter produces valid provider provenance.

- [x] T004 [US1] Add fake-client Responses/image/structured-output contract tests in `tests/contract/codexmanager-local-provider.test.ts`
- [x] T005 [US1] Implement the strict local Responses adapter in `packages/ai-providers/src/codexmanager-local-provider.ts`
- [x] T006 [US1] Make local Provider identity part of dry-run scope and preview in `packages/spike-core/src/preflight.ts` and `tests/integration/dry-run.test.ts`
- [x] T007 [US1] Wire the local Provider as the default bounded LIVE Director in `apps/spike-cli/src/index.ts`

**Checkpoint**: User Story 1 is independently testable with fake clients and zero real model calls.

---

## Phase 4: User Story 2 — Fail honestly when unavailable (Priority: P2)

**Goal**: Report missing/unreachable local configuration and never fall back to official OpenAI.

**Independent Test**: Fake missing credentials, transport failure, and invalid output each produce one explicit failure with no second Provider request.

- [x] T008 [US2] Add configuration, transport, invalid-output, model-rejection, and no-fallback tests in `tests/contract/codexmanager-local-provider.test.ts`
- [x] T009 [US2] Implement bounded local readiness validation and fail-closed errors in `packages/ai-providers/src/codexmanager-local-provider.ts`
- [x] T010 [US2] Update CLI configuration errors to name `codexmanager-local` without exposing secrets in `apps/spike-cli/src/index.ts`

**Checkpoint**: User Story 2 fails closed and official OpenAI is never selected automatically.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T011 [P] Document the default Provider and environment setup in `README.md`, `DISCOVERY.md`, and `specs/002-codexmanager-local-provider/quickstart.md`
- [x] T012 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`, `pnpm secret:scan`, and `git diff --check`, then record zero-call evidence in `specs/002-codexmanager-local-provider/verification.md`

---

## Dependencies & Execution Order

- Phase 1 has no dependencies.
- Phase 2 depends on T001 and blocks both user stories.
- User Story 1 depends on Phase 2 and establishes the default test path.
- User Story 2 depends on the adapter added by User Story 1.
- Polish depends on both user stories.

## Parallel Opportunities

- T003 can proceed independently after the configuration field names are chosen.
- T011 can proceed while the final full verification suite runs, after behavior stabilizes.

## Implementation Strategy

1. Complete T001-T003 to establish the safe provider/config boundary.
2. Complete T004-T007 as the independently usable MVP with fake clients and dry-run.
3. Complete T008-T010 to prove fail-closed behavior.
4. Complete T011-T012 and run convergence before handoff.

---

## Phase 6: Gateway Model Alias Compatibility

- [x] T013 Update `codexmanager-local` to the gateway-supported `gpt-5.4` alias while preserving the official OpenAI snapshot in `packages/ai-providers/src/codexmanager-local-provider.ts`, `apps/spike-cli/src/index.ts`, and `packages/spike-core/src/preflight.ts`
- [x] T014 Update contract/dry-run tests and Provider documentation for honest alias provenance in `tests/contract/codexmanager-local-provider.test.ts`, `tests/integration/dry-run.test.ts`, and `specs/002-codexmanager-local-provider/`
- [x] T015 Run zero-call verification, consume one new exact Director authorization, perform one real compatibility request, and record the CodexManager request-log result in `specs/002-codexmanager-local-provider/verification.md`

## Phase 7: Gateway Response Transport Compatibility

- [x] T016 Send `stream:false` explicitly and accept either JSON or SSE response transport without issuing a second request in `packages/ai-providers/src/codexmanager-local-provider.ts`
- [x] T017 Add JSON/SSE, invalid-output, transport-failure, and one-request-only coverage in `tests/contract/codexmanager-local-provider.test.ts`
- [x] T018 Consume one newly approved exact Director authorization, complete one real structured request, and verify its HTTP 200 request-log record in `specs/002-codexmanager-local-provider/verification.md`

## Phase 8: Convergence

- [x] T019 Update `DISCOVERY.md`, `README.md`, and `specs/002-codexmanager-local-provider/verification.md` to record the authorized vertical-spike submission, poll-limit reconciliation, verified artifact, and owner FAIL decision per Constitution V and the delivery handoff requirements (partial)
