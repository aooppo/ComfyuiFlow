# Implementation Plan: Three-Shot Storyboard Workspace

**Branch**: `codex/phase-0-discovery` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-storyboard-workspace/spec.md`

## Summary

Add a local three-shot storyboard workspace to the existing TypeScript modular monolith. Storyboard
content is stored as immutable PostgreSQL versions, generated only by a deterministic zero-call Fake
Director, edited through an independent Next.js route, and protected by optimistic concurrency.
Phase 2 candidate previews remain read-only until the server-only Phase 2 gate is open; after the
gate, formal bindings, a frozen resolution manifest, and an explicit owner decision complete the
storyboard without authorizing video generation.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22

**Primary Dependencies**: Next.js 16, React 19, Prisma 6.19, Zod 4, existing provider and project-core packages

**Storage**: PostgreSQL for storyboard state and provenance; existing local StorageProvider remains unchanged

**Testing**: Vitest unit/contract/integration suites, isolated PostgreSQL database, manual browser Human QA

**Target Platform**: Local macOS desktop browser, loopback-only Next.js application

**Project Type**: pnpm TypeScript modular monolith with Web/API, project-core, contracts, and provider packages

**Performance Goals**: First useful storyboard list/editor response within 2 seconds at current MVP scale

**Constraints**: Zero external calls; append-only versions; project isolation; gate-closed formal selection by default; no automatic retry/fallback

**Scale/Scope**: Single owner, local projects, three-shot MVP, up to 50 storyboard versions per project in normal use

## Constitution Check

| Principle                                          | Design response                                                                                                                  | Gate |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| I. Prove the Video Path First                      | Product work proceeds under the owner's accepted dual-track plan; it does not claim video feasibility or perform generation      | PASS |
| II. Separate Creative Intelligence from Generation | Storyboard Provider output stops at immutable storyboard content and asset requirements; no GenerationSpec or ComfyUI dependency | PASS |
| III. Provider-Neutral Contracts                    | Additive Storyboard Provider contracts preserve existing one-shot interfaces; only Fake is enabled                               | PASS |
| IV. Zero-Call and Bounded Live                     | Fake returns `providerCalls: 0`; no live gate or external adapter exists in this feature                                         | PASS |
| V. Durable Provenance                              | Runs, versions, shots, requirements, manifests, bindings, and decisions are immutable/append-only with hashes                    | PASS |

The Phase 2 gate is closed until `007` convergence evidence, PostgreSQL tests, migration rehearsal,
Human QA, and the zero-call ledger pass. Client input cannot open the gate.

## Project Structure

### Documentation (this feature)

```text
specs/008-storyboard-workspace/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
packages/contracts/src/                 # additive Provider request/result schemas
packages/ai-providers/src/              # FakeStoryboardProvider and capability extension
packages/project-core/
├── prisma/                             # entities, migration, database constraints/triggers
└── src/                                # contracts, canonical hash, gate, StoryboardService
apps/project-web/
├── app/api/                            # thin project/storyboard routes
├── app/projects/[projectId]/storyboards/
└── components/storyboards/             # list, editor, history, assets, approval
tests/{unit,contract,integration}/       # deterministic, HTTP, service, and PostgreSQL coverage
```

**Structure Decision**: Extend the existing modular monolith and route/error patterns. Do not create
a new application, event system, queue, or storage layer.

## Design

1. Add recursive stable JSON and SHA-256 helpers used by candidate requirements, proposals,
   versions, candidate snapshots, and manifests. Replace the shallow Phase 2 candidate hash without
   changing the `asset-candidate-v1` wire shape.
2. Add immutable StoryboardVersion/Shot/Requirement rows. Saving requires `If-Match` plus the current
   parent version and atomically appends a new version before advancing the Storyboard head.
3. Add a provider-neutral, optional `generateStoryboard` capability. Fake is deterministic from the
   normalized request and records zero calls; existing `generateStructured` remains unchanged.
4. Aggregate Phase 2 candidate previews per requirement. Gate-closed resolve/approve operations
   return `PHASE2_GATE_CLOSED` with zero writes.
5. After the gate opens, re-evaluate every selection in the write transaction, lock exact semantic
   and file versions, freeze the candidate snapshot and hashes, then permit an append-only owner
   approval or revocation.
6. Add a project Storyboards entry and independent list/editor pages. Historical versions are
   read-only; saves create new versions; comparison and all blocking reasons use user-facing text.

## Dual-Track Delivery

- **Track A (`007`)**: implement T080–T088, then audit T001–T079 against evidence. Required exit:
  isolated PostgreSQL concurrency and migration tests, Worker recovery proof, Lala fixture, complete
  review/application UI, Human QA, and `0 / 0 / 0` ledger.
- **Track B (`008`) before gate**: contracts, schema, Fake Provider, append-only editing, list/editor,
  history, comparison, and read-only candidate previews.
- **Integration after gate**: formal bindings, manifest freezing, approval/revocation, and gate-open
  acceptance tests. Gate remains server-only and false by default.

## Post-Design Constitution Check

All five principles remain satisfied. Storyboard approval is a human creative decision only; it is
not an external-call grant, technical video success, semantic QA result, or generation authority.
No complexity exception is required.
