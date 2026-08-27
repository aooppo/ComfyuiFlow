# Implementation Plan: Dynamic Capability Generation Mainline

**Branch**: `codex/017-capability-generation-mainline` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

## Summary

Replace historical and V3 parallel generation with one dynamic capability mainline. Its frozen plan is the sole executable graph source. Reset the local schema and storage only after verified offline backups. Finish zero-call verification and commit before a separate action-time LIVE gate.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js ESM

**Primary Dependencies**: Next.js App Router, Prisma/PostgreSQL, Zod, Vitest, MCP SDK

**Storage**: PostgreSQL business data plus local filesystem assets behind StorageProvider

**Testing**: Vitest, PostgreSQL integration, browser zero-call acceptance, Prisma validation, build, and secret scan

**Target Platform**: Local macOS development service with ComfyUI over an MCP boundary

**Project Type**: TypeScript modular-monolith web application plus single-concurrency worker

**Performance Goals**: Deterministic zero-call planning; one authorized submission per target; no duplicate after restart reconciliation

**Constraints**: No legacy reads, raw graph input, or provider/workflow Worker branch; fake only by test injection; append-only lineage; independent video/AI-QA authority; exact action-time LIVE gate

**Scale/Scope**: One local user; intentionally reset local state; Test A has one Shot, source image, video submission, and possible independent AI-QA call

## Constitution Check

PASS before research: replacement, no-call authorization, and offline recovery meet Constitution 3.0. PASS after design: canonical identities, exact registry resolution, and the post-commit LIVE gate remain enforceable.

## Project Structure

### Documentation (this feature)

```text
specs/017-capability-generation-mainline/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/comfyui-mcp/src/               # generic frozen-attempt MCP bridge
apps/project-web/app/api/           # canonical planning/execution routes
apps/project-web/components/storyboards/
apps/project-worker/src/             # unique GenerationWorker composition
packages/contracts/src/              # public schemas
packages/project-core/prisma/        # canonical schema and one baseline migration
packages/project-core/src/           # registry, planning, worker, artifact and review services
tests/{unit,contract,integration}/
```

**Structure Decision**: Keep the modular monolith. Rewrite generation modules in place, delete retired production exports and routes, and retain Feature 016 evidence only as non-product history.

## Complexity Tracking

No constitution exceptions are proposed.
