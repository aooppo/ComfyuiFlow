# Implementation Plan: Workflow Agent and Cross-Shot Execution

**Branch**: `codex/015-workflow-agent` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Insert a deterministic Workflow Agent between immutable Shot requirements and generation execution.
The modular monolith gains a versioned generation registry, per-Shot immutable execution plans,
trusted graph compilation, cross-Shot dependency materialization, structured repair proposals, and
adapter dispatch. One owner confirmation atomically freezes a mixed-implementation Batch. Existing
V1 plans and Batches remain on the legacy path, existing H3 workflow and registry bytes stay
unchanged, and all implementation verification is zero-call.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22

**Primary Dependencies**: Zod 4, Prisma 6, PostgreSQL, Next.js 15, React 19, MCP SDK 1.30,
existing FFmpeg/FFprobe media tooling

**Storage**: PostgreSQL for business state and append-only lineage; existing `StorageProvider` for
binary artifacts and extracted dependency frames; server-owned JSON registries for allowed
implementations and trusted workflows

**Testing**: Vitest unit/contract/integration tests, isolated serial PostgreSQL, migration rehearsal,
Fake/stub adapters, browser acceptance, Prisma validation, Prettier, ESLint, TypeScript, production
Next build, secret scan, `git diff --check`

**Target Platform**: Local single-user macOS/Linux runtime with PostgreSQL, a standalone
single-concurrency worker, optional loopback ComfyUI, and browser UI

**Project Type**: TypeScript modular-monolith web application with a standalone worker and an
application-owned ComfyUI MCP bridge

**Performance Goals**: Deterministic planning for 1-20 Shots completes locally without external
calls; worker claims one runnable target per lease; repeated normalized planning produces identical
ordering and hashes

**Constraints**: Additive schema only; no new package or service; no arbitrary LLM-authored graph;
no automatic retry, resubmission, or provider fallback; no secrets/paths/raw graph in public DTOs;
all real generation remains disabled without fresh action-time authorization

**Scale/Scope**: One local owner, one active generation worker, 1-20 Shots per Storyboard, mixed
implementations per Batch, acyclic Shot dependencies, one generation attempt per target

## Constitution Check

### Before Design

| Gate                                             | Design response                                                                                                                  | Status |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Prove the video path first                       | Reuse the evidenced H3 reference path; first-frame remains an explicitly labeled real-task TRIAL                                 | PASS   |
| Separate creative intelligence from generation   | ShotRequirementSpec is provider-neutral; Workflow Agent is deterministic; AI Director only handles owner-triggered rewrite/split | PASS   |
| Provider-neutral and honest capability contracts | Provider, model, executor, implementation, readiness, evidence, and unavailable capability states are distinct                   | PASS   |
| Zero-call defaults and bounded LIVE execution    | Planning and automated tests are zero-call; one confirmation freezes exact calls/cost; no retry/fallback                         | PASS   |
| Durable provenance and verification              | Plans, evidence, dependencies, consumption, extracted frames, artifacts, QA, and decisions are append-only/hash-bound            | PASS   |
| Required delivery workflow                       | Constitution check, spec, clarify, plan, tasks, analyze, implement, and converge are followed                                    | PASS   |

No constitution amendment or complexity exception is required.

### After Design

The design keeps the existing modular monolith, PostgreSQL, storage, worker, provider-neutral AI
interfaces, and MCP boundary. New public contracts are strict and versioned. New persisted records
are additive and immutable after freeze. Legacy readers and execution remain available for one
release cycle. All gates remain PASS.

## Architecture and Ownership

1. `packages/contracts` owns strict public/cross-package Zod schemas, discriminated unions, stable
   lifecycle values, and safe error codes. New schemas live in `src/workflow-agent.ts`; the current
   V1 schemas in `src/index.ts` are not widened or reinterpreted.
2. `packages/project-core/src/workflow-agent/` owns deterministic requirement analysis, capability
   resolution, whole-Storyboard implementation selection, trusted plan compilation, validation,
   repair options, persistence, invalidation, reuse, cost, and confirmation.
3. `packages/project-core` keeps the existing Director, generation, authorization, artifact, QA,
   assembly, storage, media, and worker foundations and introduces a `GenerationAdapterRegistry`.
4. `packages/comfyui-bridge` owns normalized live node metadata, allowlisted graph validation,
   trusted graph materialization, readiness, staging, status, cancel, and artifact retention.
5. `apps/comfyui-mcp` exposes safe read-only metadata/validation tools and submission by frozen
   execution-plan identity. New product execution never passes arbitrary local paths or raw graphs.
6. `apps/project-worker` selects adapters per frozen target. Legacy Batches still construct and use
   the current fixed provider path.
7. `apps/project-web` exposes thin planning, preferences, repair, confirmation, status, and final
   review routes and a Chinese business-language Workflow Planning Panel.

See [research.md](./research.md), [data-model.md](./data-model.md), and [contracts/](./contracts/).

## Deterministic Planning Pipeline

```text
ShotRequirementSpec V2
  -> RequirementAnalyzer (rules only)
  -> CapabilityResolver (hard filters + stable blocker codes)
  -> WholeStoryboardSelector (stable DAG dynamic programming)
  -> PatternResolver (READY reference > READY pattern > valid TRIAL)
  -> Compiler (trusted graph or registered direct request)
  -> Validator (contract/runtime/security/cost)
  -> DRAFT ShotExecutionPlan + RepairProposal[]
```

Canonical hashing uses the existing canonical JSON utility with explicit schema/compiler/policy
versions. Credentials never enter a hash. Registry, scoped catalog, patterns, blocks, prices,
readiness, evidence, parameters, safe bindings, and policy versions do.

The selector applies hard compatibility filters before scores. It follows `LOCKED > PREFERRED >
Storyboard default > Project default > AUTO`; uses requirement importance 4/3/2/1; prefers READY
over TRIAL; incorporates the 95% Wilson lower bound for same-version real technical evidence; applies
model/provider/implementation switch penalties 30/15/5; then compares cost, latency, and stable
implementation ID.

## Graph and Registry Design

- Add `generation/registry.json` for ProviderProfile, ModelProfile, Implementation, price,
  authentication-profile ID, regions, quota/readiness checks, adapter IDs, capabilities, constraints,
  reference workflow IDs, patterns, and blocks.
- Keep the four existing entries and bytes in `workflows/registry.json` unchanged. The generation
  registry references the exact enabled H3 workflow ID/SHA and owns additive First-Frame pattern data.
- Node Catalog normalizes only allowlisted nodes from `/system_stats` and `/object_info`, removes
  credential/default secrets, and persists both scoped catalog hash and full source hash for audit.
- A target graph file is resolved by real path and checked to remain inside the registry root, closing
  the current symlink escape gap.
- Graph validation covers bounded graph size, classes, fields, required inputs, ranges/options, edge
  types, output indices/types, cycles, reachability, allowlist, unsafe literals, and derived output
  prefix. Static pass never promotes an Implementation to READY.
- Current H3 reference compiler reuses the exact source graph and prompt compiler without changing
  historical bytes. It overrides SaveVideo prefix only in the cloned materialized graph and hashes it.
- First-Frame remains unavailable until an exact redacted `MinimaxHailuo03FirstLastFrameNode`
  catalog fixture is captured and validated. Node existence or plan text is insufficient.

## Execution and Dependency Design

- Batch confirmation performs one transaction that rechecks current inputs and freezes plans,
  snapshots, symbolic dependencies, cost/call ceilings, authorization, targets, and jobs.
- The worker loads the Batch DAG and claims the first dependency-ready target in stable topological,
  ordinal, and Shot-key order under the existing single-worker advisory lock and lease.
- `EXECUTE` targets dispatch through the frozen adapter ID; `REUSE_ARTIFACT` targets verify the exact
  existing artifact and create no job or consumption.
- Previous-final-frame binding is materialized only after upstream technical validity. FFprobe finds
  the last decodable frame index/PTS; FFmpeg extracts that exact frame; storage verification and SHA
  persistence precede downstream materialization.
- `planTemplateSha256` freezes symbolic upstream target/plan/extractor policy.
  `materializedExecutionSha256` lives on the Batch target and additionally freezes actual artifact
  and frame hashes for that execution.
- Adapter failures are typed: deterministic local/pre-dispatch blockers do not become AMBIGUOUS;
  unknown network submission results do. Reconcile may query only the original task ID or
  idempotency key and never calls submit.
- Default QA continuation advances after technical validity and PASS/WARN/NOT_ASSESSABLE, pauses on
  technical failure, ambiguity, budget exhaustion, or high-confidence hard failure, and ends in one
  unified Owner review using the existing preview-draft path before final Assembly.

## Repair and Invalidation Design

- Direct blockers produce deterministic `RepairProposal[]` for `CHANGE_IMPLEMENTATION`,
  `RELAX_REQUIREMENT`, `REWRITE_SHOT`, `SPLIT_SHOT`, and `REPLACE_ASSET`.
- Change/relax operations are local and zero-call. Rewrite/split use the existing Director run,
  authorization, attempt, proposal, and decision lifecycle with `proposalKind=SHOT_REPAIR`.
- Adoption appends a StoryboardVersion, keeps unaffected shot keys, derives split child keys from the
  proposal hash, revalidates copied bindings, regenerates requirements, and replans only the direct
  and transitive dependency closure.
- Any change to a requirement, prompt override, selected implementation, upstream plan, or bound
  artifact invalidates the affected frozen plan and its dependency closure. Immutable payloads are
  never overwritten.

## Initial Implementation Availability

- `minimax-h3-reference-comfyui-partner-v1`: registry-defined; READY backfill only when exact
  same-version workflow/runtime/evidence matches. A new install without evidence remains TRIAL.
- `minimax-h3-first-frame-comfyui-partner-v1`: declared TRIAL candidate but not selectable until the
  exact captured catalog fixture, graph validation, preprocessing, current price, and readiness pass.
- First-plus-last-frame: DISCOVERED and unavailable until a separate real trial.
- Fake: test/legacy code only; absent from new registry and new owner UI.
- Official H3, Seedance, and direct providers: absent until adapter, schema, price, region,
  credential, and evidence exist; return stable unavailable codes rather than silent fallback.

## Project Structure

### Documentation (this feature)

```text
specs/015-workflow-agent/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── workflow-agent-contracts.md
│   ├── execution-api.md
│   └── comfyui-tools.md
└── tasks.md
```

### Source Code (repository root)

```text
generation/
└── registry.json

packages/contracts/src/
├── index.ts
└── workflow-agent.ts

packages/project-core/
├── prisma/
│   ├── schema.prisma
│   └── migrations/<additive-workflow-agent>/migration.sql
└── src/
    ├── workflow-agent/
    │   ├── registry.ts
    │   ├── requirement-analyzer.ts
    │   ├── capability-resolver.ts
    │   ├── implementation-selector.ts
    │   ├── pattern-resolver.ts
    │   ├── graph-builder.ts
    │   ├── direct-request-compiler.ts
    │   ├── validator.ts
    │   ├── repair-planner.ts
    │   ├── execution-plan-service.ts
    │   └── workflow-agent-service.ts
    ├── generation-adapter.ts
    ├── generation-execution-service.ts
    ├── generation-worker.ts
    ├── generated-artifact-service.ts
    ├── generation-qa-service.ts
    └── index.ts

packages/comfyui-bridge/src/
├── node-catalog.ts
├── graph-validator.ts
├── execution-plan.ts
└── index.ts

apps/comfyui-mcp/src/server.ts
apps/project-worker/src/index.ts

apps/project-web/
├── app/api/generation-plan-versions/[versionId]/workflow-preview/route.ts
├── app/api/generation-plan-versions/[versionId]/workflow-preferences/route.ts
├── app/api/generation-plan-versions/[versionId]/workflow-repairs/route.ts
├── app/api/workflow-repair-proposals/[proposalId]/adopt/route.ts
├── app/api/generation-batches/route.ts
└── components/storyboards/workflow-planning-panel.tsx

scripts/project-dev.mjs
tests/unit/
tests/contract/
tests/integration/
```

**Structure Decision**: Extend the existing packages and applications. Workflow Agent remains an
internal `project-core` module; no new workspace package, Python service, queue, or microservice is
introduced.

## Migration and Backward Compatibility

1. Add tables, fields, enums, indexes, constraints, and non-destructive nullability relaxations only.
2. Keep V1 GenerationSpec prompt/capability values untouched. Legacy readers parse V1 by contract
   version; new V2 rows use requirement payloads and nullable legacy fields.
3. Route Batches by `engineVersion`: `workflow-agent-v1` uses per-target plans; absent/`legacy-v1`
   uses current fixed provider/workflow fields.
4. Registry synchronization is idempotent. It may append evidence derived from matching historical
   technical jobs but never rewrites job, artifact, QA, or Owner decisions.
5. Retain old API routes, fixed H3 graph, continuity wizard, keyframe records, and legacy worker path
   for at least one release cycle.

## Environment and Rollback

- New product configuration is `GENERATION_ENGINE`, `REAL_GENERATION_ENABLED`, Project maximum
  cost, server-owned credentials, and ComfyUI endpoint/install directory.
- `project:dev` checks/starts project PostgreSQL, deploys migrations, checks loopback ComfyUI, starts
  configured ComfyUI only from `COMFYUI_INSTALL_DIR`, then starts Web and Worker. It never installs
  nodes/models or edits ComfyUI configuration.
- Rollback first sets `REAL_GENERATION_ENABLED=false`, then selects `legacy-v1`. Already-submitted
  work remains query/reconcile-only. New tables and evidence stay read-only; no destructive down
  migration is used.

## Verification Strategy

- Unit: strict schemas, canonical hashes, filters/ranking, Wilson score, switch penalties, DAG/cycle,
  closure/invalidation/reuse, graph validation, repair hashes, cost reservation, continuation policy.
- Contract: safe planning/repair/confirmation DTOs, node catalog and graph validation tools,
  submit-by-plan identity, adapter dispatch, no raw paths/graphs/secrets, unchanged legacy contracts.
- PostgreSQL integration: registry sync/evidence, plan lifecycle, atomic confirmation, mixed targets,
  topology, final-frame hash/materialization, invalidation, reuse, ambiguity, and cost ceilings.
- Browser: no Fake in new flow; AUTO/PREFERRED/LOCKED; blocker repair and local replan; one
  confirmation; auto-continuation; unified Owner review.
- Whole-project gates: format, lint, typecheck, unit/contract tests, serial database tests, migration
  rehearsal, production build, secret scan, `git diff --check`.
- Real MVP validation remains a separate Owner-authorized phase with the exact caps in the source
  plan; no real calls are part of Feature 015 implementation completion.

## Complexity Tracking

No constitution violation or additional project/service/package is introduced.
