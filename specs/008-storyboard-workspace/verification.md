# Phase 3 Storyboard Verification Ledger

**Date**: 2026-08-25

## Baseline and automated evidence

| Check                             | Exact command                                                                                                                                                                                                                                      | Result                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Type                              | `pnpm typecheck`                                                                                                                                                                                                                                   | Pass                                                                                      |
| Lint                              | `pnpm lint`                                                                                                                                                                                                                                        | Pass                                                                                      |
| Format                            | `pnpm format:check`                                                                                                                                                                                                                                | Pass                                                                                      |
| Unit/contract/default integration | `pnpm test`                                                                                                                                                                                                                                        | 32 files / 102 tests pass; 4 database suites / 13 tests skip without the explicit DB gate |
| Prisma                            | `pnpm project:db:validate`                                                                                                                                                                                                                         | Pass                                                                                      |
| Isolated PostgreSQL               | `DATABASE_URL=.../comfyuiflow_test RUN_PROJECT_DB_TESTS=1 pnpm vitest run tests/integration/phase2-convergence-postgres.test.ts tests/integration/storyboards-postgres.test.ts tests/integration/generation-plans-postgres.test.ts --maxWorkers=1` | 3 files / 10 tests pass                                                                   |
| Production build                  | `pnpm project:build`                                                                                                                                                                                                                               | Pass; all Storyboard pages and APIs included                                              |
| Secret and diff                   | `pnpm secret:scan && git diff --check`                                                                                                                                                                                                             | Pass                                                                                      |

The database files intentionally run serially because each test suite truncates the same isolated
`*_test` database. They are never pointed at the default business database.

## Implementation and database evidence

- Stable Storyboard identity, append-only versions, parent linkage, head compare-and-swap, immutable
  database triggers, project composite foreign keys, manifests, bindings, and decisions are present.
- PostgreSQL tests prove concurrent head conflict, immutable readback, gate-closed zero writes,
  gate-open manifest/approval/revocation, and cross-project rejection.
- A Phase 1 snapshot rehearsal applied the original migration, inserted one project/file/asset,
  deployed every later migration, and read back `Legacy snapshot | Legacy image | <same SHA-256> |
PRESERVED`. The dedicated `comfyuiflow_migration_test` database was removed after the rehearsal.

## Browser technical observation

In the isolated local browser workspace, the following path completed without console errors:

1. Created a project and opened the separate Storyboards page.
2. Created a Storyboard and ran Fake Director; exactly three shots appeared with an explicit
   `0 external calls` message.
3. Edited shot 1 and saved; version 2 was appended and survived refresh.
4. Compared v2 with v1 and observed the historical title difference.
5. Ran candidate preview; no formal selection was created.
6. Attempted to freeze a manifest while the Phase 2 gate was closed; the API returned 409 and the UI
   explained that formal binding and approval remain closed.

This technical evidence is supplemented by the Owner Human QA decision below.

## Spec Kit convergence

The final pass traced FR-001–FR-022 and SC-001–SC-010 to contracts, services, database constraints,
routes, UI, and verification evidence. No additional unbuilt implementation task was found. SC-008
was completed by the Owner without changing the default-closed Phase 2 runtime gate.

## External Call Ledger

| Boundary                     |      Calls |
| ---------------------------- | ---------: |
| Storyboard Fake Provider     | 0 external |
| Asset Understanding Provider |          0 |
| AI candidate ranking         |          0 |
| ComfyUI                      |          0 |
| Video generation             |          0 |

## Human QA

- Reviewer: Owner (`01a03663-5cc7-7ad3-8ba2-e37e927639e1`)
- Decision: PASS
- Notes: The Owner explicitly confirmed items 1–9 PASS, including three-shot create/edit/history,
  dual-tab conflict, candidate preview, completed understanding review, refresh readback, and the
  Gate-closed path. The gate remains false by default; gate-open formal writes retain separate
  automated and isolated-browser technical evidence.
