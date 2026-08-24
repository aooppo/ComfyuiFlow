# Tasks: Replace Wan with MiniMax H3 Partner Node

**Input**: Design documents from `/specs/004-minimax-h3-partner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Contract and integration tests are required because this migration changes a paid,
hash-locked generation boundary.

## Phase 1: Setup

- [x] T001 Preserve the existing Wan feature specifications as historical evidence and make `specs/004-minimax-h3-partner/` the active Spec Kit feature in `.specify/feature.json`
- [x] T002 [P] Document installed H3 Partner Node, node contract, exact Wan deletion targets, and owner-managed credits in `specs/004-minimax-h3-partner/`

## Phase 2: Foundational workflow migration

- [x] T003 [P] Create a hash-locked two-reference H3 API graph in `workflows/minimax-h3-reference-to-video.api.json` per `contracts/minimax-h3-workflow.md`
- [x] T004 Replace executable Wan entries with the sole enabled H3 workflow manifest in `workflows/registry.json`
- [x] T005 Retire `workflows/wan22-ti2v-5b-dual-reference.api.json` and `workflows/wan22-ti2v-5b-dual-reference-stable.api.json` after their historical evidence remains available in `specs/003-wan22-stability-recovery/`

## Phase 3: User Story 1 - Generate a reference-conditioned H3 shot (Priority: P1)

**Goal**: Let the existing bridge materialize and readiness-check a constrained H3 reference
workflow without any paid submission.

**Independent Test**: The registry materializes two staged file names into ordered H3 references,
the prompt labels them correctly, and readiness reports no required local models.

- [x] T006 [P] [US1] Replace Wan workflow contract coverage with H3 graph, hash, ordered-reference, duration, output, and no-local-model assertions in `tests/contract/minimax-h3-workflow.test.ts`
- [x] T007 [P] [US1] Update dry-run and discovery integration assertions for the H3 default profile and zero calls in `tests/integration/dry-run.test.ts` and `tests/integration/discovery.test.ts`
- [x] T008 [US1] Adjust prompt compilation only as needed to make `Image 1` and `Image 2` semantic labels explicit in `packages/spike-core/src/prompt-compiler.ts`
- [x] T009 [US1] Verify the current local ComfyUI `object_info` exposes `MinimaxHailuo03ReferenceNode` and `SaveVideo` with zero generation calls, then run registered readiness via `apps/comfyui-mcp/src/server.ts`

## Phase 4: User Story 2 - Remove retired Wan runtime assets (Priority: P2)

**Goal**: Reclaim only the exact Wan model storage after the H3 path is ready.

**Independent Test**: The active H3 readiness check remains successful after only the three listed
Wan files are removed.

- [x] T010 [US2] Update active workflow documentation and discovery status from Wan to H3 in `README.md`, `DISCOVERY.md`, and `workflows/README.md`
- [x] T011 [US2] Re-check H3 workflow readiness with zero generation calls, then delete only the three absolute Wan model paths recorded in `specs/004-minimax-h3-partner/research.md`
- [x] T012 [US2] Verify those three Wan paths are absent and no other local ComfyUI model file was targeted; record the reclaimed bytes and no-call evidence in `specs/004-minimax-h3-partner/verification.md`

## Phase 5: User Story 3 - Make paid-use prerequisites explicit (Priority: P3)

**Goal**: Make it impossible to mistake implementation validation for authorized paid generation.

**Independent Test**: The quickstart separates owner account/credit setup, free readiness, and a
separately authorized live call.

- [x] T013 [US3] Verify payment/credit and authorization prerequisites are complete and do not introduce credentials into `.env.example`, `README.md`, or `specs/004-minimax-h3-partner/quickstart.md`

## Phase 6: Polish and cross-cutting verification

- [x] T014 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm secret:scan`, `pnpm spike discover`, and `git diff --check`; record results in `specs/004-minimax-h3-partner/verification.md`
- [x] T015 Run Spec Kit convergence against `specs/004-minimax-h3-partner/` and append only any genuinely unmet work.

## Dependencies & Execution Order

- T003–T005 depend on T001–T002.
- T006–T009 depend on the registered H3 graph.
- T010–T012 depend on successful zero-call H3 readiness.
- T013–T015 follow the migration and verification work.

## Implementation Strategy

1. Establish the H3 graph and registry first.
2. Prove it with only contract/readiness/dry-run tests.
3. Remove the exact Wan assets only after the proof passes.
4. Do not log in, pay, upload assets to Comfy, or submit H3 during this feature.
