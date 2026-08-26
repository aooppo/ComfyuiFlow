# Research: Workflow Agent and Cross-Shot Execution

## Decision 1: Internal Module, Not a New Service

**Decision**: Implement Workflow Agent under `packages/project-core/src/workflow-agent/`.

**Rationale**: Planning depends on current Prisma transactions, project policy, immutable plan
history, cost authorization, and existing generation services. Keeping it inside the modular monolith
avoids a second datastore, distributed transaction, and deployment unit.

**Alternatives considered**: Microservice, Python service, LangChain/LangGraph, or new package. None
has a second consumer and each adds an unnecessary operational boundary.

## Decision 2: Reuse GenerationSpec for V2 Shot Requirements

**Decision**: Add a V2 requirement contract and nullable V2 columns to `GenerationSpec`.

**Rationale**: The table already owns project, Storyboard version, source Shot, stable key, ordinal,
references, hashes, and plan-version lineage. Contract-version branching preserves V1 history.

**Alternatives considered**: Duplicate ShotRequirement table or historical row rewrite. Both create
identity drift or violate append-only compatibility.

## Decision 3: Separate Provider, Model, Implementation, and Workflow

**Decision**: Add a versioned `generation/registry.json` and persist implementation/evidence identity
separately from trusted workflow registry entries.

**Rationale**: Current `generationProviderRegistry` conflates model, provider, workflow, capability,
price, and readiness. The same model family through different providers needs independent adapter,
evidence, region, billing, and status.

**Alternatives considered**: Expand the current two-profile map or put all facts in workflow
manifests. Neither represents direct providers or honest per-implementation evidence.

## Decision 4: Preserve V1 Bytes and Contracts

**Decision**: Do not widen `GenerationProviderProfileIdSchema` or modify existing H3 workflow JSON
and `workflows/registry.json` bytes. V2 has new strict schemas and a separate generation registry.

**Rationale**: V1 wire values, hashes, fixed graph, and historical Batches are durable evidence.

**Alternatives considered**: In-place V1 schema/registry evolution. That silently changes historical
meaning and weakens rollback.

## Decision 5: Deterministic Whole-Storyboard Selection

**Decision**: Apply hard filters, then stable dynamic programming across the dependency-ordered
Storyboard using versioned scores and switch penalties.

**Rationale**: Greedy per-Shot choice creates unnecessary provider/model switching and unstable ties.

**Alternatives considered**: LLM selection or greedy ranking. LLM selection adds hidden calls and
non-determinism; greedy ranking ignores cross-Shot cost.

## Decision 6: Trusted Graph Compilation Only

**Decision**: Compose only server-owned reference workflows, patterns, and allowlisted blocks against
a versioned scoped live catalog. LLM outputs never become graph JSON.

**Rationale**: Existing bridge verifies registered workflow hashes and binding pointers. The new
validator closes missing class/field/type/DAG/output/path checks and realpath symlink containment.

**Alternatives considered**: Browser- or AI-supplied graphs. Both expose file, download, endpoint,
credential, and command surfaces.

## Decision 7: First-Frame Is Evidence-Gated

**Decision**: Declare the First-Frame implementation as a TRIAL candidate but keep it non-selectable
until a redacted exact node-catalog fixture, graph validation, preprocessing, price, and readiness pass.

**Rationale**: The repository currently has no exact `MinimaxHailuo03FirstLastFrameNode`
`object_info` fixture. Node existence does not prove fields, types, output index, or remote success.

**Alternatives considered**: Handwritten graph based on planning notes or marking READY from node
presence. Both would claim unverified capability.

## Decision 8: Per-Target Adapter Dispatch with Legacy Wrapper

**Decision**: New Batches resolve a `GenerationAdapter` by frozen adapter ID/version; legacy Batches
retain or wrap the existing constructor-wide `GenerationProvider`.

**Rationale**: Current Worker and Batch assume one provider/workflow. Mixed Batches require per-target
dispatch without breaking historical rows.

**Alternatives considered**: One Batch per provider or worker restart per profile. Both break one
confirmation and dependency/cost scope.

## Decision 9: Typed Submission Failures

**Decision**: Distinguish deterministic pre-dispatch/Provider rejection from unknown post-network
submission result. Only the latter is AMBIGUOUS; neither can retry or fallback.

**Rationale**: Current Worker catches every submit exception as AMBIGUOUS, which hides safe local
blockers and makes recovery less precise.

## Decision 10: Worker/FFmpeg Exact Final Frame

**Decision**: FFprobe finds the final decodable frame index and rational PTS/time base; FFmpeg extracts
that exact frame into a dedicated dependency-frame record.

**Rationale**: Current QA FINAL uses `duration - 0.15s` and is unsuitable for execution binding.

**Alternatives considered**: Reuse QA frame or add extraction nodes to ComfyUI. Neither proves exact
identity and the latter enlarges graph/version risk.

## Decision 11: Template Hash on Plan, Materialized Hash on Target

**Decision**: `ShotExecutionPlan.planTemplateSha256` freezes symbolic dependency policy;
`GenerationBatchTarget.materializedExecutionSha256` freezes actual upstream artifact/frame input.

**Rationale**: A reusable plan can execute in multiple Batches and upstream media may not exist at
confirmation. Materialization is Batch-specific and is written once before consumption.

**Alternatives considered**: Put materialized hash on the plan or bind any latest artifact. The first
prevents safe reuse; the second permits silent substitution.

## Decision 12: Separate Plan Lifecycle from Planning Outcome

**Decision**: Persist plan lifecycle (`DRAFT/FROZEN/INVALIDATED/SUPERSEDED`) separately from outcome
(`READY/TRIAL/BLOCKED/WAITING_FOR_UPSTREAM_REPAIR`).

**Rationale**: A single status cannot express both immutability and current executability.

## Decision 13: Reuse Existing Director Lifecycle for Creative Repair

**Decision**: Add run/proposal kinds and repair impact fields to current Director entities.

**Rationale**: Rewrite/split requires the same one-call authorization, attempt-before-I/O,
strict-output, proposal, decision, and adoption semantics already implemented in Feature 014.

**Alternatives considered**: A Repair Agent and duplicate state machine.

## Decision 14: Reuse Draft for Unified Review

**Decision**: Use the existing technically-valid GenerationPlanDraft as the unified preview, then
persist explicit per-artifact Human decisions before Final Assembly.

**Rationale**: Existing final Assembly intentionally requires Owner PASS. Auto-continuation must not
reinterpret historical QA or fabricate approval.

## Decision 15: Technical Evidence Controls Availability

**Decision**: Implementation lifecycle is DISCOVERED -> TRIAL -> READY/BLOCKED -> RETIRED. Only
same-version real submitted technical evidence can promote it.

**Rationale**: Playability proves technical compatibility, not creative acceptance. Fake, static
validation, pre-submit cancellation, AI QA, and Owner judgments are excluded.

## Decision 16: Non-Destructive Migration and Dual Engine

**Decision**: Add tables/columns/enums/indexes plus necessary nullability relaxations, route by
`engineVersion`, and retain the legacy path for one release cycle.

**Rationale**: Current Batch provider/workflow and GenerationSpec prompt/capability fields are NOT
NULL, so mixed V2 rows require a safe relaxation. Historical values remain untouched.

**Alternatives considered**: Redundant replacement tables or hard cutover.

## Decision 17: Zero-Call Implementation Acceptance

**Decision**: Tests use fixtures, recorded metadata, Fake/stub adapters, and isolated PostgreSQL.

**Rationale**: Source implementation authorization is not provider-call authorization. Real H3,
Director Repair, and AI QA require a later exact action-time scope/cost/readiness confirmation.
