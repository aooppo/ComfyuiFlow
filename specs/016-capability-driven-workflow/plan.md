# Implementation Plan: Simplified Gates and Capability-Driven Workflow

**Branch**: `codex/016-capability-driven-workflow` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-capability-driven-workflow/spec.md`

## Summary

Replace the fixed H3/five-slot planning path with a per-shot, capability-driven Workflow Agent. The implementation separates runtime, provider, model, transport adapter, compiler profile, and generation implementation; uses one generic ComfyUI MCP adapter; discovers node capabilities into non-selectable candidates; and requires reviewed publication plus exact-version evidence before selection. Project assets, semantic assets, character states, continuity, video, and audio references become conditional inputs inferred per shot. Intermediate owner approval gates and owner-facing Fake proposal paths are removed, while the server kill switch, exact paid-call authorization, no-retry policy, and final Owner QA remain.

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

### 5. Initial Hailuo 03 compiler family

The initial reviewed compiler profiles cover three distinct official node behaviors:

- **Text-to-video**: true zero-reference generation.
- **Reference-to-video**: 0–9 ordered images, 0–3 ordered videos, and 0–3 ordered audio references, with the invariant `imageCount + videoCount >= 1`; audio cannot be the sole reference.
- **First/last-frame**: required first frame and optional last frame.

All three can share `comfyui-mcp-v2`. The compiler owns node selection, dynamic port expansion, ordered bindings, and prompt labels such as `Image 1`, `Image 2`, and `Video 1`. The legacy fixed five-slot H3 implementation remains readable for historical plans but is not offered for new planning after migration.

### 6. Gate and Fake-path simplification

New planning no longer requires project-wide READY states, Storyboard approval, Shot Plan approval, or a separate pre-generation approval. Users may generate any selected valid shot subset. The system blocks only for unresolved required inputs, unavailable implementation/runtime, server LIVE disabled, missing/expired/mismatched paid-call authorization, exhausted call/budget cap, or final Owner QA.

Owner-facing Fake Director/provider/proposal controls and generation paths are removed. Test fixtures remain clearly labeled and unreachable from production selection. Historical Fake records remain readable and auditable.

### 7. Append-only first-real-trial scope

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

## Public Contracts and APIs

- Registry V2 schema and resolver contract: [contracts/generation-registry-v2.md](./contracts/generation-registry-v2.md)
- Discovery and reviewed publication lifecycle: [contracts/discovery-publication.md](./contracts/discovery-publication.md)
- Workflow planning and authorization contract: [contracts/workflow-planning-v3.md](./contracts/workflow-planning-v3.md)
- First-real-trial scope contract: [contracts/trial-scope-approval.md](./contracts/trial-scope-approval.md)

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

The Phase 1 design still passes all gates. Dynamic behavior is bounded by reviewed compiler profiles rather than arbitrary AI-authored ComfyUI graphs. Removing readiness approvals does not permit paid execution: the short-lived TRIAL scope only affects exact-version planning, while the server kill switch, separate exact execution authorization, budget/call cap, expiry, and no-retry constraints remain independently enforced. No complexity exception is required.
