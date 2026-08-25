# Phase 4 Shot Planner Verification Ledger

**Date**: 2026-08-25

## Automated evidence

| Check                           | Exact command                                                                                                                                                                                                                                           | Result                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Type                            | `pnpm typecheck`                                                                                                                                                                                                                                        | Pass                                                                   |
| Lint                            | `pnpm lint`                                                                                                                                                                                                                                             | Pass                                                                   |
| Format                          | `pnpm format:check`                                                                                                                                                                                                                                     | Pass                                                                   |
| Default automated suite         | `pnpm test`                                                                                                                                                                                                                                             | 32 files pass, 4 database suites skip; 102 tests pass, 13 skip         |
| Prisma                          | `pnpm project:db:generate && pnpm project:db:validate`                                                                                                                                                                                                  | Pass                                                                   |
| Isolated PostgreSQL             | `DATABASE_URL=.../comfyuiflow_test RUN_PROJECT_DB_TESTS=1 pnpm exec vitest run tests/integration/phase2-convergence-postgres.test.ts tests/integration/storyboards-postgres.test.ts tests/integration/generation-plans-postgres.test.ts --maxWorkers=1` | 3 files / 10 tests pass                                                |
| Production build while dev runs | `pnpm project:build` with the `.next` development server active                                                                                                                                                                                         | Pass; build uses `.next-build` and includes all Shot Plan routes/pages |
| Secret/diff                     | `pnpm secret:scan && git diff --check`                                                                                                                                                                                                                  | Pass                                                                   |

## Determinism, persistence, and migration

- Unit tests prove identical normalized inputs produce the same three specifications, prompt text,
  ordered references, and hashes. Strict contracts reject unknown Provider/model/workflow/node/path
  payload fields.
- PostgreSQL tests prove concurrent idempotent creation, distinct run identity with identical
  content, append-only owner versions, CAS conflict with zero partial rows, immutable triggers,
  composite project foreign keys, restart readback, per-shot preflight, archived-project rejection,
  approval/revocation, and `generationAuthorized: false`.
- A dedicated `comfyuiflow_migration_test` rehearsal applied migrations through Phase 3, inserted
  `Project 1 / Storyboard 1 / StoryboardVersion 1 / StoryboardShot 3 / Manifest 1 / Decision 1`, then
  applied only migration 007. Counts remained `1 / 1 / 1 / 3 / 1 / 1`; Storyboard content hash
  remained `aa…aa`, Manifest final-bindings hash remained `dd…dd`, approval remained `APPROVED`, and
  the new GenerationPlan count was `0`. The temporary database was removed after comparison.

## Isolated browser technical QA

Using an isolated `*_test` database and a temporary gate-enabled server, the real UI completed:

1. Project and deterministic three-shot Storyboard creation, candidate preview, frozen empty-reference
   Manifest, and explicit Storyboard approval.
2. Shot Plan creation with exactly three specifications, continuity facts, provider-neutral
   capabilities, version identity, `external calls 0`, and persistent “Generation is not authorized.”
3. Owner prompt edit appended v2 and survived refresh; v1/v2 comparison exposed the exact prompt diff.
4. Preflight passed with no blockers; Shot Plan approval and revocation both persisted while generation
   remained unauthorized.
5. Two tabs started at the same ETag: tab A appended v3; stale tab B received 412, displayed the stable
   conflict message, and reloaded the winning v3 without persisting its stale edit.
6. Browser console errors: 0. No Provider, workflow, ComfyUI, job, Artifact, or QA call/record was made.

This is technical browser evidence, not the Owner's Phase 4 Human QA decision.

## Spec Kit analyze and converge

FR-001–FR-022 and SC-001–SC-010 were traced to contracts, the additive migration, Planner, service,
routes, UI, unit/contract/PostgreSQL tests, migration rehearsal, build, and browser evidence. The
convergence pass added per-shot blockers, archived decision rejection, source rechecks inside approval
transactions, and invalidation of Storyboard approval when a new Storyboard version is appended.
No remaining code task was found.

## External Call Ledger

| Boundary         | Calls |
| ---------------- | ----: |
| AI Planner       |     0 |
| Provider         |     0 |
| AI ranking       |     0 |
| ComfyUI          |     0 |
| Video generation |     0 |

## Phase 4 Human QA

- Reviewer: Owner
- Decision: `PASS`
- Recorded: 2026-08-25
- Scope: Owner accepted the Phase 4 Shot Plan workspace and the visible distinction between
  Storyboard approval, Shot Plan approval, and generation authorization. This decision does not
  authorize Provider, ComfyUI, or video-generation calls. Phase 2/3 PASS from task
  `01a03663-5cc7-7ad3-8ba2-e37e927639e1` is retained and is not being requested again.
