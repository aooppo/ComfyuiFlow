# Implementation Plan: Whole-Film Continuity Wizard

**Branch**: `codex/013-continuity-wizard` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Insert a beginner-facing continuity, boundary-keyframe, and bounded-draft workflow between
approved Storyboard and paid video generation while preserving existing asset and execution history.

## Summary

Add a versioned continuity aggregate to the existing TypeScript modular monolith. `project-core`
derives extensible subjects from the approved Storyboard and semantic asset manifest, creates one
shared state record for every shot boundary, and performs deterministic zero-call conflict checks.
One approved profile can produce an immutable N+1 keyframe plan. Fake execution covers the complete
automated path; the optional LIVE adapter uses Codex Manager's OpenAI-compatible image routes only
after explicit capability, price, authorization, and no-retry checks. Approved keyframes and video
capability tier become hashed inputs to execution preview. H3 remains an ordinary-reference Provider:
its start keyframe replaces the Scene slot while the end keyframe is only a QA target. A separate
local draft assembly may include technically valid warned shots, while formal assembly continues to
select only explicit Human PASS artifacts.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22

**Primary Dependencies**: Next.js 15, React 19, Prisma 6/PostgreSQL, Zod 4, existing
`StorageProvider`, Codex Manager local HTTP gateway, FFmpeg/FFprobe

**Storage**: PostgreSQL for immutable semantic/version/cost/review lineage; content-addressed local
storage for keyframe and draft binaries

**Testing**: Vitest unit/contract/integration, PostgreSQL migration rehearsal, TypeScript, ESLint,
Next.js build, in-app browser QA, and call-ledger assertions

**Target Platform**: Local macOS, single owner, Web/API application

**Project Type**: TypeScript modular-monolith Web/API

**Performance Goals**: Continuity preflight under two seconds for 1-20 shots; no external call in any
GET/preview/preflight; one keyframe target per boundary

**Constraints**: Additive migration; append-only decisions and attempts; explicit fresh authorization;
no retry/fallback; no secrets, paths, workflow JSON, or raw Provider payload in beginner UI

**Scale/Scope**: One approved Storyboard/manifest, 1-20 shots, N+1 keyframes, at most one submitted
video attempt per selected shot in a confirmed batch

## Constitution Check

| Gate                                           | Design response                                                                                 | Status |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| Prove the video path first                     | Keeps the verified H3 execution path and changes only its approved reference inputs             | PASS   |
| Separate creative intelligence from generation | Rules, keyframe rendering, AI QA, video submission, and Human review remain distinct            | PASS   |
| Provider-neutral and honest capability         | Registry exposes explicit image and video capability tiers; H3 remains ordinary reference       | PASS   |
| Zero-call defaults and bounded LIVE            | All preview/preflight paths are zero-call; authorization is consumed before each single attempt | PASS   |
| Durable provenance and verification            | Profile, state, boundary, plan, artifacts, hashes, costs, warnings, and decisions are immutable | PASS   |
| Human authority                                | AI suggestions and QA never approve keyframes, videos, drafts, or formal output                 | PASS   |

No constitution amendment or justified violation is required. The check remains PASS after research,
data modeling, and contract design.

## Project Structure

### Documentation

```text
specs/013-continuity-wizard/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/continuity-api.md
├── contracts/keyframe-provider.md
├── checklists/requirements.md
├── tasks.md
└── verification.md
```

### Source Code

```text
packages/contracts/src/index.ts
packages/ai-providers/src/{keyframe-image-provider,codexmanager-keyframe-provider}.ts
packages/project-core/
├── prisma/schema.prisma
├── prisma/migrations/202608250014_continuity_wizard/migration.sql
└── src/
    ├── continuity-contracts.ts
    ├── continuity-registry.ts
    ├── continuity-service.ts
    ├── keyframe-service.ts
    ├── generation-execution-service.ts
    └── generation-plan-draft-service.ts
apps/project-web/
├── app/projects/[projectId]/storyboards/[storyboardId]/continuity/page.tsx
├── app/api/continuity-profiles/**
├── app/api/keyframe-plans/**
├── app/api/generation-plans/[planId]/drafts/route.ts
└── components/storyboards/{continuity-wizard,shot-plan-editor}.tsx
tests/{unit,contract,integration}/
```

**Structure Decision**: Keep business validation, canonical hashing, authorization consumption,
storage verification, and draft source selection in server-only `project-core`; isolate gateway I/O
in `ai-providers`; keep routes thin and the UI business-language-first.

## Implementation Phases

1. Add controlled continuity/keyframe enums, additive immutable schema, migration, and safe contracts.
2. Implement subject registry, deterministic suggestions, N+1 shared-boundary construction, conflict
   preflight, version save, and explicit profile decision.
3. Implement Fake keyframe plan/authorization/execution/storage/review end to end, then add a disabled-
   by-default Codex Manager adapter with live capability and price requirements.
4. Add the continuity page, shot timeline, conflict actions, contact sheet, cost/limit confirmation,
   and collapsed advanced information.
5. Bind approved continuity/keyframe hashes and video capability tier to execution preview/batches;
   adapt H3 Scene-slot and QA-target behavior without rewriting historical batches.
6. Add explicit local draft selection/assembly/history with warning lineage, separate from formal
   owner-PASS assembly.
7. Run focused and full suites, migration rehearsal, browser QA, zero-call ledger checks, Spec Kit
   analysis/convergence, and document real three-shot LIVE acceptance as not run pending confirmation.

## Security, Failure, and Observability

- Gateway credentials stay server-side; logs and public DTOs include only stable safe result codes.
- Keyframe authorization binds plan hash, model snapshot, price fact, maximum calls, and expiry. One
  consumption row is written before each external attempt and is never refunded.
- No adapter retries, falls back, or accepts more than one returned image per target.
- Storage readback verifies hash/size before approval, video preview, QA, and draft assembly.
- A hard or ambiguous video failure pauses later submissions; a playable visual warning is recorded
  but does not submit a replacement.
- Provider/model/capability/price timestamps, attempt counts, response IDs where safe, and elapsed
  state are durable; prompts, raw responses, credentials, Base64, and absolute paths are omitted.

## Migration and Rollback

- Migration is additive and rewrites no asset, Storyboard, plan, job, artifact, QA, or assembly row.
- Existing plans without a continuity binding remain readable and retain their prior behavior; new
  continuity-aware previews explicitly opt in by approved keyframe plan ID.
- Rollback disables the new routes/UI and LIVE keyframe flag while leaving all immutable records and
  binaries readable. No destructive down migration or automatic cleanup is provided.

## Complexity Tracking

The new aggregates are intentionally separate from ProductionAsset, Storyboard, GenerationPlan, and
formal assembly. Merging them would blur semantic identity, temporal state, paid-attempt evidence,
and Human approval boundaries, violating existing governance.
