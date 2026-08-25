# Implementation Plan: Shot Planner and GenerationSpec

**Branch**: `codex/phase-0-discovery` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

## Summary

Extend the modular monolith with a deterministic, zero-call Shot Planner. It consumes only a currently approved StoryboardVersion and its frozen AssetResolutionManifest, appends a stable GenerationPlan plus immutable versions/specifications, supports owner edits under optimistic concurrency, performs read-only preflight, and records append-only approval/revocation without authorizing generation.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22
**Dependencies**: Next.js 15, React 19, Prisma 6.19, Zod 4, existing canonical JSON
**Storage**: PostgreSQL for plan state/provenance; local StorageProvider remains read-only
**Testing**: Vitest, isolated PostgreSQL, migration rehearsal, browser QA
**Constraints**: 1–20 source-aligned specs, append-only, project isolation, zero external calls, no Provider/workflow fields
**Scale**: local single owner; up to 50 plan versions; preflight under two seconds

## Constitution Check

| Principle                                      | Design response                                                               | Gate |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| Prove the Video Path First                     | Retains accepted H3 evidence and makes no new feasibility claim               | PASS |
| Separate Creative Intelligence from Generation | Stops at provider-neutral GenerationSpec; no generation dependency            | PASS |
| Provider-Neutral Contracts                     | Contains no model, workflow, node, or credential data                         | PASS |
| Zero-Call Defaults                             | No external adapter, grant, submit path, retry, or fallback exists            | PASS |
| Durable Provenance                             | Plans, versions, specs, references, and decisions are append-only with hashes | PASS |

## Architecture and Data Flow

```text
Approved StoryboardVersion + frozen AssetResolutionManifest
  -> validate project and approval
  -> DeterministicShotPlanner builds three GenerationSpecV1 values
  -> canonical input/reference/output hashes
  -> append Plan + Version + Spec + Reference rows
  -> owner append/edit under If-Match
  -> read-only preflight rechecks current facts
  -> append APPROVED/REVOKED decision
  -> generationAuthorized remains false
```

- Public DTOs live in `packages/contracts`; service/error/ETag schemas live in `packages/project-core`.
- `GenerationPlanService` owns transactions, hashing, idempotency, preflight, and decisions.
- Thin Next.js routes expose the contract; a separate Shot Plan component provides edit/history/preflight/decision UX.
- The Planner never calls `AiModelProvider`; it constructs normalized prompts from approved shot fields and continuity constraints.

## Database and Migration

- Add `GenerationPlan`, `GenerationPlanVersion`, `GenerationSpec`, `GenerationSpecReference`, and `GenerationPlanDecision`.
- Use project-composite foreign keys and immutable triggers for every append-only row.
- `GenerationPlan` is the only mutable projection: head, approved version, rowVersion, timestamps.
- Migration `202608250007_generation_plans` is additive. Rollback deploys older code while leaving unused evidence tables intact.
- Rehearse from the current Phase 3 schema and prove existing Storyboard/Manifest/binding/decision rows and hashes are unchanged.

## Interfaces

- `GenerationSpecV1`: source facts, narrative/camera/continuity/duration, normalized prompt, exact references, capability requirements, and hashes.
- `POST /api/storyboard-versions/{id}/generation-plans`: create under `Idempotency-Key`.
- `GET /api/generation-plans/{id}` and `/versions`: read head, history, decisions, and ETag.
- `POST /api/generation-plans/{id}/versions`: append owner edit under `If-Match`.
- `POST /api/generation-plan-versions/{id}/preflight`: read-only current-fact validation.
- `POST /api/generation-plan-versions/{id}/decisions`: append approval/revocation under ETag and idempotency.

## Delivery Order

1. Record owner Phase 2/3 PASS, isolate Next build output, rerun database/build gates, and retain gate-open automated evidence.
2. Freeze GenerationSpec/error/API contracts and tests.
3. Add schema, migration, immutable guards, Planner, and service.
4. Add APIs and independent Shot Plan UI.
5. Run PostgreSQL, migration, browser, quality gates, analyze, and converge.

## Post-Design Constitution Check

All principles remain satisfied. Plan approval is a local human decision, not a paid-call authorization or Provider submission instruction.
