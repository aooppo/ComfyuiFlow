# Tasks: ComfyUI Vertical Spike

**Input**: Design documents from `/specs/001-comfyui-vertical-spike/`

**Tests**: Required by SC-007 and the delivery quality gates. Provider tests must use fakes and must
never contact OpenAI or a real ComfyUI generation service.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the smallest TypeScript workspace used by the bridge and spike CLI.

- [x] T001 Create pnpm workspace manifests and scripts in `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`
- [x] T002 [P] Configure linting, formatting, Vitest, and build defaults in `eslint.config.mjs`, `.prettierrc.json`, and `vitest.config.ts`
- [x] T003 [P] Add runtime ignores and safe environment documentation in `.gitignore` and `.env.example`
- [x] T004 Create application/package directory manifests in `apps/comfyui-mcp/package.json`, `apps/spike-cli/package.json`, `packages/contracts/package.json`, `packages/comfyui-bridge/package.json`, `packages/ai-providers/package.json`, and `packages/spike-core/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schemas, configuration, workflow safety, and append-only evidence.

**Critical**: No user story implementation begins until this phase passes without provider calls.

- [x] T005 [P] Define input asset, shot, workflow, authorization, job, artifact, and review Zod schemas in `packages/contracts/src/index.ts`
- [x] T006 [P] Implement canonical JSON and SHA-256 helpers in `packages/spike-core/src/integrity.ts`
- [x] T007 [P] Implement secret-safe local endpoint and environment parsing in `packages/spike-core/src/config.ts`
- [x] T008 Implement append-only JSONL event/grant storage with hash chaining in `packages/spike-core/src/evidence-store.ts`
- [x] T009 Implement exact-scope one-call authorization creation and consume-before-call semantics in `packages/spike-core/src/authorization.ts`
- [x] T010 Implement workflow registry loading, hash verification, and allowlisted JSON Pointer binding in `packages/comfyui-bridge/src/workflow-registry.ts`
- [x] T011 [P] Add an empty-by-default registry and operator guidance in `workflows/registry.json` and `workflows/README.md`
- [x] T012 [P] Add foundational tests for schemas, hashing, configuration, authorization, evidence, and workflow binding in `tests/unit/foundation.test.ts`

**Checkpoint**: Shared contracts reject unsafe endpoints, arbitrary workflows, scope mismatches, grant
reuse, and hash drift.

---

## Phase 3: User Story 1 - Verify Readiness Without Spending (Priority: P1) MVP

**Goal**: Discover exact prerequisites and produce a complete zero-call dry-run.

**Independent Test**: Run discovery against the local unavailable service and dry-run against a
fixture-backed ready service; both report all prerequisites and `providerCalls = 0`, with no
`POST /prompt` or OpenAI request.

### Tests for User Story 1

- [x] T013 [P] [US1] Create fake ComfyUI HTTP state machine and workflow fixtures in `tests/fixtures/fake-comfyui.ts` and `tests/fixtures/workflows/ready.api.json`
- [x] T014 [P] [US1] Write ComfyUI read-only client contract tests in `tests/contract/comfyui-readiness.test.ts`
- [x] T015 [P] [US1] Write MCP tool listing/readiness contract tests in `tests/contract/mcp-readiness.test.ts`
- [x] T016 [P] [US1] Write end-to-end zero-call CLI dry-run test in `tests/integration/dry-run.test.ts`

### Implementation for User Story 1

- [x] T017 [US1] Implement read-only system, node, and queue calls with normalized errors in `packages/comfyui-bridge/src/comfyui-client.ts`
- [x] T018 [US1] Implement workflow/model/binding readiness evaluation in `packages/comfyui-bridge/src/readiness.ts`
- [x] T019 [US1] Register `comfyui_list_workflows`, `comfyui_check_readiness`, and `comfyui_get_queue` in `apps/comfyui-mcp/src/server.ts`
- [x] T020 [US1] Implement provider-neutral `AiModelProvider` and deterministic dry-run Director in `packages/ai-providers/src/provider.ts` and `packages/ai-providers/src/dry-run-provider.ts`
- [x] T021 [US1] Implement immutable asset ingestion and one-shot request preflight in `packages/spike-core/src/assets.ts` and `packages/spike-core/src/preflight.ts`
- [x] T022 [US1] Implement MCP stdio client and zero-call invocation preview in `apps/spike-cli/src/mcp-client.ts` and `apps/spike-cli/src/dry-run.ts`
- [x] T023 [US1] Add `discover` and `dry-run` commands with JSON output in `apps/spike-cli/src/index.ts`

**Checkpoint**: US1 is usable independently and truthfully reports the current local workflow/model
blockers without making a provider call.

---

## Phase 4: User Story 2 - Generate One Real Reference-Conditioned Shot (Priority: P1)

**Goal**: Make the bounded one-Director/one-generation path executable only after exact owner
authorization and retain a verified video artifact; automated tests use fakes only.

**Independent Test**: Against fake OpenAI and fake ComfyUI, create two one-call grants, execute one
run, assert one Director request and one `/prompt`, retain an FFprobe-valid fixture MP4, and prove
all validation/failure/ambiguous paths make zero automatic retries.

### Tests for User Story 2

- [x] T024 [P] [US2] Write OpenAI adapter structured-output and invalid-output contract tests in `tests/contract/openai-director.test.ts`
- [x] T025 [P] [US2] Write ComfyUI upload/submit/status/cancel/artifact contract tests in `tests/contract/comfyui-live-tools.test.ts`
- [x] T026 [P] [US2] Write consume-before-call, one-submit, failure-stop, and ambiguous reconciliation tests in `tests/integration/live-safety.test.ts`
- [x] T027 [P] [US2] Add and validate a tiny generated MP4 fixture in `tests/fixtures/media/shot.mp4` and `tests/unit/media.test.ts`

### Implementation for User Story 2

- [x] T028 [US2] Implement OpenAI Responses structured Director adapter with fixed snapshot and `store: false` in `packages/ai-providers/src/openai-provider.ts`
- [x] T029 [US2] Implement input upload, client-chosen prompt UUID submission, status, targeted cancel, and artifact download in `packages/comfyui-bridge/src/comfyui-client.ts`
- [x] T030 [US2] Implement safe workflow materialization and artifact selection in `packages/comfyui-bridge/src/execution.ts`
- [x] T031 [US2] Register stage, submit, status, artifact, and cancel tools with LIVE gate enforcement in `apps/comfyui-mcp/src/server.ts`
- [x] T032 [US2] Implement FFprobe media validation and immutable artifact retention in `packages/spike-core/src/media.ts`
- [x] T033 [US2] Implement fail-closed one-shot orchestration and query-only ambiguous reconciliation in `packages/spike-core/src/run-service.ts`
- [x] T034 [US2] Add grant, run, status, and cancel commands in `apps/spike-cli/src/index.ts`

**Checkpoint**: The code path is complete under fakes. Do not execute it against OpenAI or real
ComfyUI until a compatible workflow/model and two separately reviewed grants exist.

---

## Phase 5: User Story 3 - Make a Feasibility Decision (Priority: P2)

**Goal**: Keep technical completion and owner feasibility judgment distinct and enforce the
productization gate.

**Independent Test**: Record PASS, FAIL, and RISK_ACCEPTED fixture reviews without modifying run
evidence; only completed-plus-PASS or explicit risk acceptance opens the gate.

### Tests for User Story 3

- [x] T035 [P] [US3] Write append-only review and productization-gate tests in `tests/unit/review.test.ts`
- [x] T036 [P] [US3] Write CLI review/status integration tests in `tests/integration/review.test.ts`

### Implementation for User Story 3

- [x] T037 [US3] Implement feasibility review events and gate evaluation in `packages/spike-core/src/review.ts`
- [x] T038 [US3] Add `review` command and separate technical/human status output in `apps/spike-cli/src/index.ts`

**Checkpoint**: A successful provider task alone never becomes human PASS.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Make the spike reproducible, auditable, and ready for an owner-supplied real workflow.

- [x] T039 [P] Add redaction and committed-secret scanning tests in `tests/unit/security.test.ts`
- [x] T040 [P] Document MCP launch/configuration and fake-vs-real boundaries in `README.md`
- [x] T041 Validate documented commands and current blocked discovery output in `specs/001-comfyui-vertical-spike/quickstart.md` and `DISCOVERY.md`
- [x] T042 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, secret scan, and `git diff --check`, recording zero real provider calls in `specs/001-comfyui-vertical-spike/verification.md`
- [x] T043 Run Spec Kit convergence against FR-001 through FR-020 and SC-001 through SC-007, appending only genuine residual work to `specs/001-comfyui-vertical-spike/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup has no dependencies.
- Foundational depends on Setup and blocks all stories.
- US1 depends on Foundational and is the zero-spend MVP.
- US2 depends on Foundational plus US1 workflow/readiness components.
- US3 depends on the event store but can be tested with a fixture run independent of real US2
  execution.
- Polish depends on the implemented stories selected for this branch.

### User Story Dependencies

```text
Setup -> Foundation -> US1 readiness/dry-run -> US2 bounded execution
                         `---------------------> US3 review fixtures
US2 technical completion ----------------------> US3 real review
```

### Parallel Opportunities

- T002/T003 and the package manifests in T004 touch separate files.
- T005/T006/T007/T011 can proceed independently before integration into T008-T010.
- US1 fake-server, client-contract, MCP-contract, and CLI tests can be authored in parallel.
- US2 OpenAI, ComfyUI, orchestration, and media tests can be authored in parallel.
- US3 test files can be written in parallel before T037/T038.
- Documentation and security tests can run in parallel in the polish phase.

## Parallel Example: User Story 1

```text
T013: fake ComfyUI and workflow fixtures
T014: readiness HTTP client contract tests
T015: MCP listing/readiness contract tests
T016: CLI dry-run integration test
```

## Parallel Example: User Story 2

```text
T024: fake OpenAI structured-output contract
T025: fake ComfyUI live tool contract
T026: authorization/fail-stop orchestration
T027: media fixture and FFprobe validation
```

## Implementation Strategy

### Zero-spend MVP first

1. Complete T001-T012.
2. Complete T013-T023.
3. Stop and validate current local blockers and `providerCalls = 0`.

### Bounded path second

1. Complete T024-T034 using fake providers only.
2. Complete T035-T042 and verify the human gate.
3. Stop before any real run.
4. Execute the separately authorized real attempt only after workflow/model readiness and explicit
   owner approval; do not treat the implementation task as authorization.

### Productization gate

Do not start Next.js, Prisma/PostgreSQL, multi-shot, AI QA, Qwen, or assembly work until a playable
real artifact plus owner PASS exists, or the owner explicitly records risk acceptance.

## Task Format Validation

All original 43 tasks use the required checkbox, sequential task ID, optional `[P]`, required story
label in story phases, and at least one exact file path. Convergence tasks T044-T047 retain the same
checklist and traceability format.

## Phase 7: Convergence

- [x] T044 Return normalized `NO_REGISTERED_WORKFLOW` and endpoint reachability blockers from `pnpm spike discover` with zero generation calls per US1/AC1-2 and SC-001 (partial)
- [x] T045 Persist source asset hashes, creative description, Director provider/model, prompt/schema version, workflow identity/hash, and verified artifact lineage in append-only run evidence per FR-015 and SC-004 (partial)
- [x] T046 Add query-only ambiguous submission reconciliation for the preselected prompt ID without any submit path in `packages/spike-core/src/run-service.ts` and `apps/spike-cli/src/index.ts` per FR-013 and plan query-only reconciliation (partial)
- [x] T047 Append a terminal `FAILED` run event when artifact retention or FFprobe validation fails in `packages/spike-core/src/run-service.ts` with integration coverage per FR-016 (partial)

## Phase 8: Convergence

- [x] T048 Append terminal `FAILED` evidence for Director request failures and status polling transport failures in `packages/spike-core/src/run-service.ts` with integration coverage per FR-011, FR-012, and US2 failure visibility (partial)

## Phase 9: Convergence

- [x] T049 Aggregate per-workflow hash, binding, node, and model readiness into `pnpm spike discover` so a reachable server plus registered workflow cannot be misreported ready per SC-001 and US1/AC2 (partial)
- [x] T050 Reject identical character and scene source hashes during preflight with a zero-call `DUPLICATE_INPUT_ASSETS` failure per the duplicate-input edge case and FR-004 (partial)
- [x] T051 Append terminal `FAILED` evidence when Director authorization is missing, expired, reused, or scope-mismatched before any Provider request in `packages/spike-core/src/run-service.ts` per the authorization edge case and FR-010 through FR-012 (partial)
