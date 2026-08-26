# Quickstart and Acceptance: Workflow Agent

This validates implementation with fixtures and an isolated PostgreSQL database. It authorizes zero
AI Director, AI QA, ComfyUI, H3, or other provider calls.

## Prerequisites

1. Use `codex/015-workflow-agent` in `/Users/tj/Documents/ChatGPT/ComfyuiFlow-phase14`.
2. Preserve the four pre-existing Director preview edits; do not reset or overwrite them.
3. Keep `REAL_GENERATION_ENABLED=false` and use only Fake/stub adapters.
4. Use a database name ending in `_test` for destructive integration tests and run them serially.

## Automated Validation

Run format check, lint, typecheck, unit/contract tests, isolated PostgreSQL integrations, Prisma
generate/validate, migration rehearsal, production Web build, secret scan, and `git diff --check`.

Expected: all gates pass and Director, AI QA, ComfyUI, and video call ledgers remain zero.

## Scenario 1: Deterministic Planning

Seed a confirmed 1-20 Shot Storyboard, approved assets, recorded catalog, prices/readiness, and
READY/TRIAL implementations. Preview AUTO, PREFERRED, and LOCKED 100 times.

Expected: identical filters, choices, reasons, DAG, cost, and hashes. Incompatible LOCKED and
unavailable/cost-unknown choices return stable blockers and `canConfirm=false`.

## Scenario 2: Atomic Mixed Batch

Preview a fixture where Shot 1 uses READY reference and Shot 2 uses First-Frame TRIAL. Confirm once,
then repeat with stale hash and unknown cost.

Expected: valid confirmation atomically freezes every record; invalid requests write no partial
authorization, target, or job. No provider call occurs.

## Scenario 3: Dependency and Final Frame

Run a stub two-Shot Batch where Shot 2 depends on Shot 1. Verify Shot 2 is not claimable early. Extract
the final decoded media-fixture frame and verify index, rational PTS/time base, MIME, dimensions,
storage, and SHA. Materialize Shot 2 and compare hashes.

Expected: binding succeeds once; replacing upstream plan/artifact invalidates Shot 2 and causes zero
resubmission.

## Scenario 4: Blocked Repair and Reuse

Produce missing capability/input/adapter blockers. Apply implementation change, relaxation, and
replace-asset fixtures locally. Exercise Fake strict Director rewrite/split and adopt it. Verify only
the affected closure replans and an independent completed artifact is reused.

Expected: stale proposals fail; video authority is never used for Director work; unchanged artifacts
create no new job or consumption.

## Scenario 5: Continuation and Unified Review

Exercise PASS, WARN, NOT_ASSESSABLE, high-confidence hard FAIL, technical failure, AMBIGUOUS, and
cost-exhausted fixtures under both continuation modes.

Expected: default continues only for allowed outcomes; every stop precedes dependent submission; a
technically-valid Draft supports unified review, then explicit Owner decisions permit Final Assembly.

## Scenario 6: Browser Acceptance

Verify Fake is absent from the new flow; business states/costs are visible; technical evidence is
collapsed; raw graph/node/path/credential/task/hash details are hidden. Exercise preferences,
blocked repair, local replan, one confirmation, dependency progress, pause, and unified review.

Expected: an all-ready normal path has one video confirmation and no mandatory derived plan,
continuity, or keyframe approval gate.

## Suggested Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm project:db:generate
pnpm project:db:validate
DATABASE_URL=postgresql://comfyuiflow:comfyuiflow@127.0.0.1:5448/comfyuiflow_test \
  RUN_PROJECT_DB_TESTS=1 pnpm exec vitest run tests/integration \
  --no-file-parallelism --maxWorkers=1
pnpm project:build
pnpm secret:scan
git diff --check
```

## Real MVP Validation Boundary

Do not run real validation during implementation. A later real run must refresh Provider/model/
implementation/workflow, current price/expiry, quota/credits, credentials/readiness, Shots,
dependency policy, maximum calls/cost, and no-retry/fallback statement, then obtain fresh exact
action-time Owner confirmation. Absolute later caps are one Director repair, one H3 reference, one H3
First-Frame TRIAL, and only after technical success one AI QA per Shot.
