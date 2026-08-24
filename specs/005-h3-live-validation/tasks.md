# Tasks: DECOROLALA H3 Live Validation

## Phase 1: Setup

- [x] T001 Make `specs/005-h3-live-validation/` active and record the designated source task in `spec.md`
- [x] T002 [P] Record the five paths, SHA-256 values, product facts, H3 capability, and execution boundary in `research.md` and `contracts/h3-live-attempt.md`

## Phase 2: Foundational multi-reference support

- [x] T003 Extend asset/request/provenance roles from two to the five registered advertisement roles in `packages/contracts/src/index.ts` and `packages/spike-core/src/assets.ts`
- [x] T004 Extend preflight ingestion, duplicate rejection, required-role validation, and exact prompt scoping in `packages/spike-core/src/preflight.ts`
- [x] T005 Extend workflow materialization and authorized staged inputs for product and identity views in `packages/comfyui-bridge/src/workflow-registry.ts` and `packages/comfyui-bridge/src/execution.ts`
- [x] T006 Extend MCP/CLI staging and submission assembly without adding arbitrary roles or endpoints in `apps/comfyui-mcp/src/server.ts`, `apps/spike-cli/src/mcp-client.ts`, and `apps/spike-cli/src/index.ts`

## Phase 3: User Story 1 - Prepare the exact five-reference advertisement

- [x] T007 [US1] Add the hash-locked five-reference 15-second graph in `workflows/minimax-h3-decorolala-ad-15s-v1.api.json` and preserve the disabled two-reference graph in `workflows/registry.json`
- [x] T008 [US1] Create the H3 full-reference prompt and exact local request in `var/user-inputs/request-minimax-h3-decorolala-ad-15s-v1.json`
- [x] T009 [P] [US1] Prove reference order, profile, graph hash, prompt binding, and historical preservation in `tests/contract/minimax-h3-workflow.test.ts`
- [x] T010 [P] [US1] Prove five-asset zero-call preview and active-workflow discovery in `tests/integration/dry-run.test.ts` and `tests/integration/discovery.test.ts`
- [x] T011 [US1] Run final format/lint/type/test/build/secret/diff checks plus exact live readiness/dry-run and record the final scope hash in `verification.md`

## Phase 4: User Story 2 - Execute at most one paid H3 generation

- [x] T012 [US2] Present the exact five-reference/prompt/profile/hash/call/cost handoff and obtain action-time owner confirmation for the scope in `contracts/h3-live-attempt.md`
- [x] T013 [US2] After confirmation, create fresh grants and execute at most one Director request and one H3 submission, recording append-only evidence in `verification.md` (attempt failed at Partner Node authentication; no retry)

## Phase 5: User Story 3 - Review and gate Phase 1

- [x] T014 [US3] Retain and FFprobe the artifact, extract first/middle/final review frames, and append technical evidence in `verification.md`
- [x] T015 [US3] Present the playable output and record owner `PASS`, `FAIL`, or `RISK_ACCEPTED`; create no retry in `verification.md`

## Dependencies & Execution Order

- T003–T006 depend on T001–T002.
- T007–T011 depend on the generalized bindings.
- T012 must follow the final zero-call evidence.
- T013 requires T012 exact confirmation.
- T014–T015 require a completed retained artifact; a failure ends the attempt without replacement.

## Parallel Opportunities

- T002 can proceed alongside specification quality validation.
- T009 and T010 cover separate contract/integration layers.

## Implementation Strategy

1. Finish T001–T011 with zero provider/generation calls.
2. Stop and show the exact action-time handoff.
3. Execute T013 once only after confirmation.
4. Complete technical and Human QA without retry, then decide whether Phase 1 may start.

## Format Validation

All tasks use checkbox, sequential task ID, applicable parallel/story labels, and concrete file paths.

## Phase 6: Convergence

- [x] T016 Add strict H3 full-reference prompt structure validation and scope-drift regression coverage in `packages/contracts/src/index.ts`, `packages/spike-core/src/preflight.ts`, and `tests/integration/dry-run.test.ts` per FR-005 and SC-002 (partial)
- [x] T017 Update current user-facing workflow, reference-order, profile, prompt, and gate documentation in `README.md`, `DISCOVERY.md`, and `workflows/README.md` per FR-002, FR-004, FR-009, and SC-001 (partial)
- [x] T018 Correct generalized-capacity wording to the implemented five registered roles in `specs/005-h3-live-validation/plan.md` and this task file per plan constraints (contradicts)

## Phase 7: Authentication hardening discovered by the live attempt

- [x] T019 Add a secret-safe Comfy Partner Node credential path and a zero-generation authentication preflight so direct API submissions cannot consume a paid-call authorization when `AUTH_TOKEN_COMFY_ORG` / `API_KEY_COMFY_ORG` is absent
- [x] T020 Prove the authenticated submission payload and redaction behavior with contract/integration tests, then repeat only the zero-generation readiness checks before requesting a new owner authorization

## Phase 8: Minimum-cost validation revision

- [x] T021 Record that H3 rejects 2 seconds and resolve the owner cost-saving intent to the minimum supported 4 seconds in `research.md` and `contracts/h3-short-validation.md`
- [x] T022 Add the immutable single-shot 4-second prompt/request and hash-locked graph in `var/user-inputs/request-minimax-h3-decorolala-validation-4s-v1.json` and `workflows/minimax-h3-decorolala-validation-4s-v1.api.json`
- [x] T023 Disable but preserve the 15-second workflow and make only the 4-second validation graph active in `workflows/registry.json`
- [x] T024 Prove short-prompt validation, graph bindings/profile/history, active discovery, exact real-asset dry-run, and full quality checks with zero Provider/generation calls
- [x] T025 After Partner credential readiness passes, present the new scope, `$0.5148` estimate, and one-attempt boundary; do not create grants or submit without a fresh exact confirmation

## Phase 9: Four-second paid validation attempt

- [x] T026 Obtain fresh exact owner confirmation for scope `051fd0759c720b885c778e45e49ed8b0f9fd293f241d70f5b44a4021c3bb6a7f`, at most one Director call and one H3 submission, estimated `$0.5148`, and no retry
- [x] T027 Only after T026, create fresh single-use grants, execute once, retain/inspect any artifact, and record append-only evidence without retry or fallback
