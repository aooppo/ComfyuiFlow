# Implementation Plan: Dynamic Hailuo 03 Capability V3

**Branch**: `codex/016-dynamic-hailuo-v3` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-capability-driven-workflow/spec.md`

## Summary

Complete the Future Dynamic Implementation directly. Per-Shot semantic requirements produce an
immutable `ReferencePlan`; a deterministic Hailuo 03 compiler materializes a real API-format ComfyUI
Graph; a validator freezes the Graph plus runtime/adapter contract before authorization; and a V3
Worker executes exactly that snapshot through MCP. Artifact, FFprobe, review-frame, AI QA, Owner
decision, retry, and assembly lineage are persisted and restored in the Storyboard UI. The fixed
five-image Graph remains a byte-frozen fixture/provider-evidence artifact only.

## Technical Context

**Language/Version**: TypeScript on the repository's current Node.js toolchain

**Primary Dependencies**: Next.js, Worker runtime, Zod, Prisma, PostgreSQL, MCP, FFmpeg

**Storage**: PostgreSQL for versioned registry, planning, authorization, execution, and provenance records; files/object references for media artifacts

**Testing**: Existing unit, contract, integration, and browser acceptance suites; zero-call fixtures for provider behavior

**Target Platform**: Web application plus background worker, connected to local or remote ComfyUI runtimes and future direct-service runtimes

**Project Type**: Multi-application TypeScript web/worker system

**Performance Goals**: For a zero-call Storyboard of up to 20 Shots, at least 95 of 100 planning runs return a complete preview within 2 seconds; discovery and validation do not block normal project editing; execution status remains observable without duplicate submissions

**Constraints**: Zero external generation calls by default; one exact authorization per paid submission scope; no automatic retry/fallback; append-only lineage; provider-neutral contracts; backward-readable historical plans

**Scale/Scope**: Registry, planning, Web API/UI, Worker execution, persistence, and tests across multiple modules

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle                      | Result | Design response                                                                                                                           |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Provider-neutral orchestration | PASS   | Runtime, provider, model, adapter, compiler, and implementation identities are independent.                                               |
| Zero-call default              | PASS   | Discovery, planning, compilation preview, and publication are local/read-only; submission remains separately authorized.                  |
| Server-side LIVE gate          | PASS   | Removing intermediate approvals does not remove the default-off server kill switch or persisted paid-call authorization.                  |
| Append-only provenance         | PASS   | Registry publications, compiler versions, planning snapshots, authorization, execution, and evidence are versioned and retained.          |
| Human ownership                | PASS   | Final Owner QA remains explicit; AI proposals and automated checks never self-promote final output.                                       |
| No hidden retries              | PASS   | Adapter contract forbids automatic retry, provider fallback, and duplicate submit.                                                        |
| Creative/execution separation  | PASS   | Shot Planner automatically creates immutable Generation Spec V3 records; no separate approval is added, and execution cannot bypass them. |

The user's request removes workflow-stage approval gates, not execution authority. The global server kill switch and exact paid-call confirmation are authorization boundaries rather than storyboard-readiness gates, so retaining them is constitutionally required and does not reintroduce the removed product friction.

## Architecture

### 1. Registry V2 identity model

The registry becomes a versioned catalog with six independent identities plus cost policy:

1. **Runtime Profile** — where execution occurs, such as a local ComfyUI instance, remote ComfyUI instance, or direct API runtime.
2. **Provider Profile** — who supplies inference and/or billing authority, such as local compute, ComfyUI Partner, or a direct provider account.
3. **Model Profile** — the model family and version, such as Hailuo 03, Seedance, or Wan.
4. **Adapter Profile** — the transport/protocol implementation. All ComfyUI-backed implementations use the shared `comfyui-mcp-v2` adapter.
5. **Compiler Profile** — the reviewed rules that map semantic shot requirements to a model/node-specific workflow and ordered inputs.
6. **Generation Implementation** — an immutable selectable combination of the five profiles above and a cost policy.

This prevents `comfyui-partner` from being overloaded as both provider and adapter, and prevents model-specific workflow knowledge from leaking into Web or Worker routing.

### 2. Shared ComfyUI adapter

Web and Worker resolve adapters from one shared factory. Route-local identity registration and Worker-local H3 adapter names are removed. The generic ComfyUI adapter owns only readiness, submit, status, cancel, reconcile, and artifact transport. It does not decide which model, node, slots, references, or prompt semantics apply.

### 3. Controlled discovery and publication

ComfyUI node discovery normalizes node schemas, including dynamic image/video/audio groups, into `DISCOVERED` candidates. Discovery never makes a candidate selectable. An operator reviews provider identity, model identity, input semantics, compiler profile, output mapping, cost policy, and safety constraints before publishing an immutable implementation version as `TRIAL`. Exact-version zero-call/fixture validation is required, and exact-version real evidence is required before promotion to `READY` when the implementation can make real calls.

Catalog or compiler changes create a new version; they do not mutate historical records.

### 4. Per-shot requirement analysis

`ShotRequirementSpecV3` describes semantic needs instead of fixed slots. The Workflow Agent determines whether a shot needs raw project assets, semantic versions, character states, environment/product/style references, upstream continuity frames, video motion references, audio references, or no character input. It records required, optional, omitted, and unresolved reasons.

Planning produces an immutable `PlanningInputSnapshot` containing exact asset/version references and order. A later generation plan can only bind inputs admitted by the selected implementation's published input contract.

The Shot Planner then emits one immutable, provider-neutral `GenerationSpecV3` per planned Shot. It
binds the Storyboard revision, requirement spec, planning input snapshot, implementation/compiler
versions, non-secret compiled-request digest, and expected output contract. This is the mandatory
creative-to-execution handoff required by the constitution, but it is derived automatically and has
no independent Owner approval state. Web and Storyboard services cannot submit raw prompts, workflow
graphs, or adapter payloads directly.

### 5. Dynamic Hailuo 03 compiler and validator

The first formal V3 slice uses `MinimaxHailuo03ReferenceNode`. Planner/LLM output stops at bounded
duration/ratio/resolution/seed/watermark choices plus semantic reference roles. `ReferencePlanV3`
canonicalizes exact source versions/hashes and orders image, video, and audio inputs. The compiler
then creates `LoadImage × N`, `LoadVideo × N`, `LoadAudio × N`, one Hailuo Reference node, and one
`SaveVideo` node with deterministic numeric node IDs and dynamic connection names.

The Graph validator independently checks the allowlisted node classes and exact edge topology;
0–9 image, 0–3 video, and 0–3 audio cardinalities; visual-reference and audio invariants; integer
4–15-second duration; supported ratios and 768P/2K; safe staged input names and output prefix; and
the frozen `/object_info` runtime-contract digest. It returns a canonical Graph SHA-256. The compiler
preview and validator are pure and zero-call. The legacy fixed five-slot H3 Graph remains byte-for-byte
readable as regression/provider evidence and is never the dynamic implementation identity.

### 6. Evidence-scoped implementation identity

Dynamic implementation identity is `(compiler id/version, validator id/version, capability-envelope
digest, adapter id/version, runtime-contract digest)`. Each Attempt additionally stores the unique
`materializedGraphSha256`. Registry readiness is evaluated per exact envelope slice. PASS compiler
and validator evidence plus zero-call runtime readiness are necessary but not enough for READY;
authorized runtime/E2E evidence from the exact version is also required. Until then the implementation
or unproven slice remains TRIAL/BLOCKED.

### 7. Gate and Fake-path simplification

New planning no longer requires project-wide READY states, Storyboard approval, Shot Plan approval, or a separate pre-generation approval. Users may generate any selected valid shot subset. The system blocks only for unresolved required inputs, unavailable implementation/runtime, server LIVE disabled, missing/expired/mismatched paid-call authorization, exhausted call/budget cap, or final Owner QA.

Owner-facing Fake Director/provider/proposal controls and generation paths are removed. Test fixtures remain clearly labeled and unreachable from production selection. Historical Fake records remain readable and auditable.

### 8. Append-only first-real-trial scope

Add a separate `TrialScopeApproval` aggregate between blocked capability planning and zero-call
execution preview. Approval creation resolves an already-persisted V3 plan back to the exact current
Storyboard version and Generation Specs, reloads the server-owned Registry V2 composition, and
freezes one item per selected Shot with the exact implementation/runtime/provider/model/adapter/
compiler references plus compiled-request and cost/composition digests. The request uses a stable
idempotency key and a bounded expiry; duplicate readback performs no additional writes.

Revocation is a separate append-only event. Planning loads active approval items for the exact
Storyboard version, validates expiry/revocation and the per-item immutable composition digest, then
passes a one-Shot-local `allowedTrialRefs` set to the resolver. It never constructs a global trial
allowlist. Approval and revocation services have no Provider, Worker, adapter, AI QA, ComfyUI, or
video execution dependency.

### 9. Frozen execution, artifact, retry, and assembly pipeline

One exact confirmation creates an immutable execution snapshot and authorization. The Worker claims
one target, appends AuthorizationConsumption and Attempt, then submits the already-frozen Graph via
the shared MCP V3 adapter. Submission time never recompiles. Ambiguous responses remain terminal and
require explicit reconcile or a new Owner-authorized retry; no automatic fallback/resubmit exists.

Completion downloads the artifact into managed storage, hashes it, runs FFprobe, extracts deterministic
first/middle/last frames, and only then exposes technical completion. AI QA runs inside its own cap;
`AI_QA_UNAVAILABLE` is advisory. Owner PASS/FAIL/RISK_ACCEPTED is a separate append-only decision.
FAIL exposes a zero-call retry preview, then a new grant and Attempt. Assembly keys on the canonical
ordered approved-artifact digest and is idempotent. The Storyboard UI reads this persisted aggregate,
polls only while non-terminal, plays artifacts/assemblies, shows history, and exposes downloads.

## Public Contracts and APIs

- Registry V2 schema and resolver contract: [contracts/generation-registry-v2.md](./contracts/generation-registry-v2.md)
- Discovery and reviewed publication lifecycle: [contracts/discovery-publication.md](./contracts/discovery-publication.md)
- Workflow planning and authorization contract: [contracts/workflow-planning-v3.md](./contracts/workflow-planning-v3.md)
- First-real-trial scope contract: [contracts/trial-scope-approval.md](./contracts/trial-scope-approval.md)
- Dynamic Hailuo 03 compiler, validator, execution, evidence, retry, and assembly contract:
  [contracts/dynamic-hailuo03-v3.md](./contracts/dynamic-hailuo03-v3.md)

Existing endpoints remain backward-readable where practical. New versions are additive; legacy plan reads are translated into a historical view and are never silently rewritten.

## Persistence and Migration

1. Add versioned registry entities and lifecycle fields without deleting legacy registry JSON or plan records.
2. Seed explicit legacy runtime/provider/model/adapter/compiler/implementation identities for historical H3 plans.
3. Publish new H3 compiler/implementation versions after reviewed validation.
4. Add V3 requirement, snapshot, immutable Generation Spec, plan, and authorization lineage fields.
5. Switch new planning to V3 behind a server-controlled rollout flag.
6. Remove owner-facing Fake and intermediate-gate UI/API paths after compatibility reads pass.
7. Retire new writes to legacy fixed-slot plans; preserve historical read and audit support.
8. Add approval, item, and revocation tables additively; never delete an expired or revoked scope.
9. Add ReferencePlan, materialized Graph snapshot, V3 Attempt/consumption, artifact/probe/frame, QA,
   Owner decision, retry preview, and assembly tables additively; preserve existing V1/V2 records.
10. Seed a dynamic Hailuo 03 TRIAL implementation whose identity uses compiler/envelope/runtime
    contracts; do not copy the fixed Graph SHA into its identity or mark the full envelope READY.

Rollback disables V3 selection and restores the previous new-plan route without deleting V3 records or evidence.

## Verification Strategy

- Unit-test registry resolution, capability filtering, cost-policy behavior, input ordering, H3 invariants, Generation Spec immutability/bypass prevention, and gate predicates.
- Contract-test Web and Worker against the same adapter factory and immutable implementation identity.
- Integration-test discovery → review → TRIAL → evidence → READY without accidental LIVE submission.
- Integration-test no-person, product-only, environment-only, character, continuity, video-reference, and zero-reference shots.
- Verify local compute shows a local-compute cost policy, not fabricated USD and not an automatic cost error.
- Verify missing required inputs block only affected shots and valid subsets remain generatable.
- Verify one confirmation binds exact shot set, implementation version, call cap, cost/cost policy, expiry, and no-retry policy.
- Verify partial trial approval, idempotent replay, version/composition drift, expiry, revocation,
  re-approval, audit history, and per-Shot `allowedTrialRefs` isolation with zero external calls.
- Verify owner-facing Fake routes/options disappear while fixtures remain test-only and historical records remain readable.
- Matrix-test real Graph bytes for image/video/audio counts, 4–15 seconds, every ratio, and 768P/2K;
  assert invalid cardinality/duration/ratio/resolution cases block before authorization.
- Contract-test runtime `/object_info` compatibility without `/prompt`, compiler/validator identity,
  Graph SHA freezing, staged media mapping, MCP submission payload, and compile-after-auth rejection.
- Fake-transport test consume-before-attempt, one submit, ambiguous terminal behavior, no retry/fallback,
  artifact download/hash/FFprobe/three frames, non-blocking AI QA unavailable, Owner decisions, retry
  preview/new grant/new Attempt, and idempotent assembly.
- Browser-test persistence and polling across reload, player, QA, retry/history, assembly, and download,
  stopping before the fresh one-shot LIVE confirmation.
- Browser-test the simplified owner journey through final Owner QA.
- Measure the zero-call 20-Shot planning fixture for 100 runs and require at least 95 runs to complete within 2 seconds.
- Run real provider validation only with a fresh, explicit action-time authorization; no blind retry.

## Project Structure

### Documentation

```text
specs/016-capability-driven-workflow/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── generation-registry-v2.md
    ├── discovery-publication.md
    ├── workflow-planning-v3.md
    └── trial-scope-approval.md
```

### Source Code

```text
apps/project-web/
├── app/api/
├── components/
└── lib/

apps/worker/
└── src/

packages/
├── generation/
├── workflow-agent/
└── shared/

prisma/
└── migrations/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Extend the existing Web, Worker, shared generation/planning packages, Prisma persistence, and test layout. Do not introduce a new service solely for registry discovery or compilation.

## Constitution Re-check

The revised design still passes all gates. Dynamic behavior is bounded by reviewed deterministic
compiler and validator code, not AI-authored Graphs. The materialized Graph is frozen before the
authorization boundary, every network attempt consumes authority first, and retry/assembly preserve
append-only lineage and explicit Owner decisions. Runtime metadata inspection is zero-call evidence,
not paid generation evidence. No complexity exception is required.
