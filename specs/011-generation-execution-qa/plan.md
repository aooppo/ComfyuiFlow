# Implementation Plan: Generation Execution and QA

**Branch**: `codex/011-generation-execution-qa` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Approved Phase 5-6 generation execution and QA specification.

## Summary

Extend the local modular monolith from approved provider-neutral GenerationSpecs to a safe execution
and review loop. PostgreSQL stores exact previews, combined authorization budgets, single-attempt
jobs, append-only events, generated-artifact lineage, technical checks, frame-based CodexManager QA,
and human decisions. A single-concurrency Worker executes Fake by default and H3 only through the
existing ComfyUI MCP boundary when separate LIVE gates and an exact action-time confirmation exist.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22

**Primary Dependencies**: Next.js 15, React 19, Prisma 6/PostgreSQL, Zod 4, MCP SDK, existing
ComfyUI bridge, FFmpeg/FFprobe, CodexManager Responses-compatible loopback gateway

**Storage**: PostgreSQL business state plus generated binary/frame storage behind `StorageProvider`;
source `Asset` and ignored Phase 0 evidence stay separate

**Testing**: Vitest unit/contract/integration, sequential isolated PostgreSQL, production build,
browser QA, secret scan, migration preservation, call ledger

**Target Platform**: Local macOS single-owner application with loopback Web, Worker, ComfyUI, and
CodexManager services

**Project Type**: TypeScript modular-monolith Web/API plus standalone single-concurrency Worker

**Performance Goals**: Deterministic zero-call preview for 1-20 shots in under two seconds in the
ready local environment; ordered one-job-at-a-time execution

**Constraints**: Zero-call defaults; one submit per Job; exact H3 4-second 9:16 five-reference
profile; no direct ComfyUI HTTP from product execution; no retries/fallback; no secret/path leakage;
AI QA is still-frame advisory only

**Scale/Scope**: One owner, active project, 1-20 selected shots, Fake automated acceptance, at most
one separately confirmed H3 plus one conditional CodexManager call in LIVE acceptance

## Constitution Check

| Gate                                               | Design response                                                                                             | Status |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| Prove the video path first                         | Existing H3 PASS evidence is preserved; 011 productizes only the validated 4-second profile                 | PASS   |
| Separate creative intelligence from generation     | Approved GenerationSpec remains immutable; H3 materialization is a versioned adapter                        | PASS   |
| Provider-neutral contracts and honest capabilities | Registry advertises exact Fake/H3 and still-frame QA limits; incompatible shots fail closed                 | PASS   |
| Zero-call defaults and bounded LIVE                | Fake is default; combined authorization has exact targets and separate maximum counts consumed before calls | PASS   |
| Durable provenance and verification                | Jobs/events/artifacts/QA are append-only, hashed, locally retained, and human review is separate            | PASS   |

No constitution amendment or justified violation is required. The same gates remain PASS after the
data model and contracts below.

## Project Structure

### Documentation

```text
specs/011-generation-execution-qa/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/
├── tasks.md
└── verification.md
```

### Source Code

```text
packages/contracts/src/index.ts
packages/project-core/
├── prisma/schema.prisma
├── prisma/migrations/202608250011_generation_execution_qa/
└── src/
    ├── generation-execution-contracts.ts
    ├── generation-execution-service.ts
    ├── generation-provider.ts
    ├── generation-worker.ts
    ├── generated-artifact-service.ts
    └── video-qa.ts
packages/ai-providers/src/
apps/project-worker/src/index.ts
apps/project-web/
├── app/api/
└── components/storyboards/generation-workspace.tsx
workflows/
tests/{unit,contract,integration}/
```

**Structure Decision**: Keep all business invariants in server-only `project-core`, contracts in the
shared schema package, Provider adapters at existing boundaries, route handlers thin, and the Web UI
free of credentials, absolute paths, workflow JSON, and direct external calls. The existing Worker
gains explicit queue dispatch while retaining single-concurrency claims.

## Design Phases

1. **Living artifacts and contracts**: close the Phase 4 1-20 documentation drift; freeze public
   execution/QA schemas, H3 compatibility blockers, prompt compiler version, and safe errors.
2. **Persistence foundation**: additive migration for batches, targets, authorizations,
   consumptions, jobs/events, artifacts/checks/frames, AI runs/results, and human decisions with
   composite project constraints and immutable lineage.
3. **Preview and Provider materialization**: deterministic five-slot resolution, streaming hash
   revalidation, new additive generic H3 workflow, prompt/scope hashes, Fake/H3 registry, and MCP-only
   port.
4. **Bounded execution**: atomic confirmed batch creation, transactional call consumption,
   single-concurrency worker, fail-pause, cancel, and query-only reconciliation.
5. **Artifact and QA**: generated storage namespace, FFprobe facts, deterministic frames, Fake and
   CodexManager QA, append-only owner PASS/FAIL.
6. **Web experience and convergence**: Generate & QA workspace, polling/readback, zero-call browser
   acceptance, real PostgreSQL/migration/build/security gates, then action-time LIVE handoff only.

## Security, Failure, and Observability

- Environment-only gates: `PROJECT_GENERATION_LIVE_ENABLED` and `VIDEO_QA_LIVE_ENABLED`; both false
  unless exactly enabled in the Worker environment. Fake ignores external credentials.
- Authorization scope includes Provider/model/profile/workflow SHA, ordered targets, compiled prompt
  hash, reference hashes, frame extraction version, max generation/QA counts, and expiry.
- A job records its preselected task ID before submission. Transport ambiguity becomes `AMBIGUOUS`;
  only status/artifact reconciliation is allowed afterward.
- First technical failure pauses unclaimed targets. Completed evidence is never rolled back and
  unused targets require a fresh Preview/confirmation before later execution.
- Operation logs expose project/batch/job IDs, stable result codes, statuses, call counts, hashes,
  elapsed time, and artifact count only. Credentials, Base64, absolute paths, raw workflow payloads,
  Partner responses, and full prompts are excluded.

## Migration and Rollback

- The additive migration creates only new tables/enums/indexes and project relations; it does not
  rewrite existing Storyboard, Manifest, Plan, Spec, source asset, or Phase 0 evidence rows.
- Rehearsal snapshots old row counts and hashes before/after migration in the real local integration
  database at `127.0.0.1:5448/comfyuiflow`.
- Application rollback disables both LIVE gates and stops the Worker. New 011 rows and generated
  files remain readable evidence; no destructive down migration is run automatically.

## Complexity Tracking

No constitution violations require justification. The number of append-only records is intentional:
separate authorization, submission, artifact, AI advice, and human decisions are independent cost
and trust boundaries and cannot safely be collapsed into one mutable Job row.
