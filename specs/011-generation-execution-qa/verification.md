# Verification: Generation Execution and QA

**Branch**: `codex/011-generation-execution-qa`
**Baseline**: `2739a07`
**Date**: 2026-08-25
**Automated provider mode**: Fake only; no H3, ComfyUI, or CodexManager network call

## Delivery result

The Phase 5-6 implementation is complete through the Fake execution and QA loop. The LIVE path is
implemented but remains disabled and unaccepted until a separate action-time owner confirmation.
No implementation or verification step in this delivery invoked H3 or CodexManager.

## Spec Kit convergence

- Constitution was reviewed and remained unchanged. Exact target scope, bounded call counts,
  consume-before-call behavior, append-only evidence, owner-only QA, and default-off LIVE gates are
  consistent with the existing governance.
- Specify and Clarify freeze the 1-20 approved-shot subset, five H3 slots, failure-pause behavior,
  query-only reconciliation, and combined authorization with separate generation and AI QA budgets.
- Plan, data model, contracts, research, quickstart, and dependency-ordered tasks cover FR-001 through
  FR-022.
- Analyze found no unresolved requirement/plan/task contradiction before implementation.
- Converge found no remaining unbuilt zero-call acceptance work. SC-011 is intentionally pending
  because it is the separately authorized LIVE acceptance gate, not an automated delivery task.

## Automated gates

| Gate                             | Result | Evidence                                                                                                                          |
| -------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                       |   PASS | `pnpm format:check`                                                                                                               |
| Lint                             |   PASS | `pnpm lint`                                                                                                                       |
| Type checking                    |   PASS | root and Project Web TypeScript checks                                                                                            |
| Default test suite               |   PASS | 36 files passed, 5 skipped; 117 tests passed, 23 skipped                                                                          |
| Sequential PostgreSQL suite      |   PASS | 4 files and 20 tests passed with one worker                                                                                       |
| Prisma schema                    |   PASS | schema validation succeeded                                                                                                       |
| Migration rehearsal              |   PASS | all 11 migrations applied; rehearsal database reports up to date                                                                  |
| Production build                 |   PASS | all workspace packages and Next.js application built successfully                                                                 |
| Secret scan                      |   PASS | repository secret scan passed                                                                                                     |
| Diff hygiene                     |   PASS | `git diff --check` returned no errors                                                                                             |
| Historical workflow preservation |   PASS | baseline and current historical 4-second workflow SHA-256 both `6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a` |

## Real browser Fake acceptance

The local application was exercised against an isolated PostgreSQL test database and isolated source
and generated-object directories:

1. An approved one-shot plan opened in the Generate & QA workspace.
2. Fake Preview returned one compatible shot, five visible semantic references, an immutable prompt
   summary, a `$0.0000` estimate, and a ceiling of one generation plus one AI QA consumption.
3. Switching to H3 with LIVE disabled made the shot non-selectable with stable
   `LIVE_DISABLED` and `WORKFLOW_NOT_READY` blockers.
4. One combined Fake authorization created a queued batch with zero consumed calls.
5. The standalone worker produced one retained playable MP4, passed technical inspection, retained
   FIRST/MIDDLE/FINAL review frames, and recorded a structured advisory Fake AI QA `WARN`.
6. Before owner action the batch remained `AWAITING_HUMAN_QA`; submitting the isolated test Owner
   PASS appended the decision and changed the job to `QA_PASS` and the batch to `COMPLETED`.
7. The rendered page exposed one video content route, three review frames, no browser warning/error,
   and no absolute path, credential, raw workflow, or Provider payload.

The two persisted call consumptions are Fake ledger evidence only. Actual external-call totals for
this delivery are H3 `0`, ComfyUI `0`, CodexManager `0`, and paid generation `0`.

## LIVE handoff gate

LIVE remains blocked by default. Before a real acceptance attempt, revalidate the current H3 price,
credentials, credits, all five exact inputs and hashes, compiled prompt, workflow SHA, MCP readiness,
and the one-generation/one-conditional-AI-QA ceiling. Then stop and obtain action-time owner
confirmation. The permitted LIVE sequence is at most one H3 submission and, only after one
technically valid artifact, at most one CodexManager AI QA call. There is no retry, fallback,
automatic owner decision, assembly, or publication authority.
