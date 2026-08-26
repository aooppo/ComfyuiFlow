# Workflow Planning and Execution API Contract

Routes are thin adapters over `project-core`. Mutations require project scope, idempotency, current
row/head preconditions, and safe versioned DTOs. Reads use `Cache-Control: no-store`.

## Planning

- `POST /api/generation-plan-versions/{versionId}/workflow-plans`
  - Input: per-Shot selection, prompt override, skip, and accepted relaxation references.
  - Output: zero-call aggregate preview with READY/TRIAL/BLOCKED/WAITING counts, safe per-Shot
    implementation summaries, DAG, calls, integer-micros costs, price validity, repair options, and
    `canConfirm`.
  - Writes only idempotent DRAFT plan records; no authorization/job/external call.

- `PATCH /api/generation-plans/{planId}/planning-preferences`
  - Input: current preference hash, safe preferences, `If-Match`, idempotency.
  - Output: appended plan version and affected replan closure.

## Repair

- `POST /api/shot-execution-plans/{planId}/repair-preview`
  - Returns deterministic options at zero calls.
- `POST /api/shot-execution-plans/{planId}/repair-runs`
  - Only rewrite/split; reuses separate Director preview/confirmation and authority.
- `POST /api/workflow-repair-proposals/{proposalId}/adopt`
  - Requires exact proposal/impact hash, safe edits where permitted, `If-Match`, and idempotency;
    appends StoryboardVersion and returns affected local replan.

## Batch Confirmation

Existing `POST /api/generation-batches` adds a V2 discriminated request with engine version, plan
version/input hash, selected target plan IDs/template hashes, dependency policy hash, price/cost/call
snapshot and expiry, maximum cost, continuation policy, owner confirmation, idempotency, and
`If-Match`.

Confirmation is all-or-nothing and fails before external I/O on stale plan, blocker, unknown cost,
expired price, over-budget scope, unavailable implementation, or hash mismatch.

## Status and Final Review

- Existing Batch detail adds dependency-aware target state, reuse disposition, safe provider/model/
  implementation labels, reserved/consumed cost, blocker closure, continuation, and review readiness.
- Existing artifact, draft, Human QA, and Assembly routes remain; Final Assembly still requires
  explicit Owner decisions.
- Cancel/reconcile target original jobs. Reconcile never submits.

## Safe Response Boundary

Default responses omit raw graph/request, node IDs/classes, endpoint, credential material, local path,
output directory, provider task ID, and full SHA. Collapsed evidence may expose safe versions,
shortened hashes, readiness/evidence summaries, and stable failure codes.
