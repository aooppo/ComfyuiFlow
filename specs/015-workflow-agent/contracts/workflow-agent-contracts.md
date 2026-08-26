# Workflow Agent Contract

All cross-package payloads use strict versioned Zod schemas. Unknown fields are rejected. Public
payloads contain stable business identifiers and safe summaries only; credentials, endpoints, raw
graphs, local paths, provider task IDs, and full internal snapshots are excluded.

## Core Schema Families

- `ShotRequirementSpecV2`: project/Storyboard/source Shot identity, stable Shot key, timing, aspect,
  creative states, approved references, importance, and typed dependencies. No provider/model/
  workflow/capability decision.
- `GenerationRequirements`: deterministic technical interpretation with capabilities, controls,
  inputs, output, quality priorities, and blockers.
- `ProviderProfile`, `ModelProfile`, `GenerationImplementation`: server-owned registry definitions.
- `ShotModelSelection`: `AUTO`, ordered `PREFERRED`, or exact `LOCKED` choice.
- `CapabilitySnapshot` / `ImplementationSnapshot`: exact safe planning inputs and hashes.
- `ComfyUiGraphExecutionPlan` / `DirectProviderApiExecutionPlan`: strict executor union. Public DTOs
  return summaries, not payload JSON.
- `ShotExecutionPlan`: lifecycle, planning outcome, implementation, reason, cost/calls, dependency
  summary, and template-hash identity.
- `ExecutionInputSnapshot`: exact Batch target, upstream plan/artifact/frame, extractor, and hashes.
- `RepairProposal`: one of five actions with blocker, closure, creative effect, capability estimate,
  calls/cost, Director requirement, and deterministic hash.
- `BatchCostSnapshot`: integer micros, currency, pricing expiry, per-operation calls, maximum cost,
  and no-retry/fallback policy.
- `QaContinuationPolicy`: version, mode, hard criteria, confidence threshold, and decision mapping.

## Planning States

- `READY`: currently executable implementation with current readiness.
- `FIRST_REAL_TRIAL`: statically valid TRIAL selected for one formal generation attempt.
- `BLOCKED`: direct blocker and repair proposals; no GenerationJob.
- `WAITING_FOR_UPSTREAM_REPAIR`: no direct incompatibility; an upstream Shot is blocked.

## Stable Error Codes

V2 includes current legacy generation codes plus at least:

- `ADAPTER_NOT_IMPLEMENTED`
- `PROVIDER_NOT_CONFIGURED`
- `COST_UNAVAILABLE`
- `DEPENDENCY_CYCLE`
- `UPSTREAM_PLAN_INVALIDATED`
- `EXECUTION_PLAN_SHA_MISMATCH`
- `MATERIALIZED_INPUT_SHA_MISMATCH`
- `FIRST_LAST_FRAME_IMPLEMENTATION_NOT_AVAILABLE`
- `LOCKED_MODEL_INCOMPATIBLE`
- `REPAIR_PROPOSAL_STALE`
- `STATIC_GRAPH_INVALID`
- `CATALOG_STALE`
- `PRE_DISPATCH_BLOCKED`
- `PROVIDER_REJECTED`
- `SUBMISSION_AMBIGUOUS`
- `UPSTREAM_ARTIFACT_NOT_READY`
- `BATCH_COST_LIMIT_EXCEEDED`

## Determinism Contract

Identical normalized requirements, preferences, registry, catalog, readiness, evidence, price,
policy, and compiler versions produce identical filtering, whole-Storyboard choice, explanation,
repair order/hash, dependency order, cost snapshot, and plan template hash.

Credential values never affect a hash. Credential profile/version and configured/readiness state may.

## Repair Contract

- `CHANGE_IMPLEMENTATION`: changes model selection only; zero Director calls.
- `RELAX_REQUIREMENT`: records exact path, old/new importance, and owner rationale; zero calls.
- `REWRITE_SHOT`: one strict Director repair for the blocked Shot and necessary neighbor state.
- `SPLIT_SHOT`: one strict Director proposal with two or more contiguous replacements; child keys
  derive from proposal hash and child ordinal.
- `REPLACE_ASSET`: exact missing/invalid slot and navigation target; zero calls.

Adoption requires current Storyboard head, exact impact/proposal hashes, `If-Match`, and idempotency.
It appends history and never mutates the proposal.
