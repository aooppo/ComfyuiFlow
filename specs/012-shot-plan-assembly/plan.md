# Implementation Plan: Approved Shot Plan Assembly

**Branch**: `codex/012-shot-plan-assembly` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Assemble the latest owner-PASS artifact for every approved shot into one immutable local
preview with complete source lineage, history, playback, and download.

## Summary

Add a local assembly aggregate to the existing TypeScript modular monolith. `project-core` resolves
one latest owner-PASS artifact per approved GenerationSpec, computes a canonical source-set hash,
uses FFmpeg to normalize and concatenate the exact ordered videos, validates the result with
FFprobe, stores the binary behind the generated-content `StorageProvider`, and appends assembly and
source records in PostgreSQL. Thin Next.js routes expose eligibility/history, explicit creation, and
Range-capable content. The existing Shot Plan UI shows missing ordinals, the current preview,
download, and historical assemblies. No Worker, H3, ComfyUI, or AI QA path is invoked.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22

**Primary Dependencies**: Next.js 15, React 19, Prisma 6/PostgreSQL, Zod 4, FFmpeg/FFprobe, existing
`StorageProvider` and byte-range helper

**Storage**: PostgreSQL immutable assembly metadata and source lineage plus local generated binary
storage outside the source asset catalog

**Testing**: Vitest unit/contract/integration, Prisma migration rehearsal, TypeScript, ESLint, Next.js
production build, and in-app browser QA

**Target Platform**: Local macOS single-owner Web/API application

**Project Type**: TypeScript modular-monolith Web/API

**Performance Goals**: Eligibility read in under two seconds for 1-20 shots; assembly completes within
twice total source duration on the supported local machine

**Constraints**: Explicit click; zero external calls; append-only output/history; no hidden source
selection; 768x1344 H.264 24 fps silent MP4; no absolute-path or credential leakage

**Scale/Scope**: One approved plan, 1-20 short portrait shots, one local assembly at a time per exact
source set

## Constitution Check

| Gate                                           | Design response                                                                       | Status |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| Prove the video path first                     | Reuses already retained and technically valid owner-PASS MP4s                         | PASS   |
| Separate creative intelligence from generation | Assembly consumes immutable approved artifacts and changes no prompts                 | PASS   |
| Provider-neutral and honest capability         | Local output format is explicit; no Provider capability is claimed                    | PASS   |
| Zero-call defaults and bounded LIVE            | Assembly has no Provider adapter or authorization consumption path                    | PASS   |
| Durable provenance and verification            | Exact source set, hashes, media facts, assembler version, and history are append-only | PASS   |
| Human authority                                | Only explicit Human QA PASS makes a source eligible; assembly is separately explicit  | PASS   |

No constitution amendment or justified violation is required. These gates remain PASS after the data
model and contracts below.

## Project Structure

### Documentation

```text
specs/012-shot-plan-assembly/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/assembly-api.md
├── checklists/requirements.md
├── tasks.md
└── verification.md
```

### Source Code

```text
packages/project-core/
├── prisma/schema.prisma
├── prisma/migrations/202608250013_plan_assembly/migration.sql
└── src/
    ├── generation-plan-assembly-service.ts
    └── index.ts
apps/project-web/
├── app/api/generation-plans/[planId]/assemblies/route.ts
├── app/api/generation-plan-assemblies/[assemblyId]/content/route.ts
└── components/storyboards/shot-plan-editor.tsx
tests/{unit,contract,integration}/
```

**Structure Decision**: Keep all selection, hashing, verification, FFmpeg, idempotency, and
project-ownership rules in server-only `project-core`; keep routes thin; reuse the existing Shot Plan
component and generated-content Range helper; add no new process or Provider adapter.

## Implementation Phases

1. Add append-only assembly and source tables, indexes, and project/plan/artifact relations.
2. Add pure latest-owner-PASS selection and canonical source-set hashing with focused unit tests.
3. Add local FFmpeg assembly, FFprobe validation, verified storage, idempotent persistence, and safe
   state/history views.
4. Add GET/POST assembly and Range content routes with contract/integration coverage.
5. Add Shot Plan eligibility, explicit local action, current preview/download, and historical views.
6. Verify migration, focused/default suites, type/lint/build, local call ledger, and browser behavior;
   document convergence against every acceptance criterion.

## Security, Failure, and Observability

- Server creates temporary files under an explicit task directory and always removes that directory.
- Source paths are resolved only through hash- and size-verifying storage access.
- FFmpeg receives argument arrays, never shell-interpolated prompts or paths.
- API views omit storage keys and absolute paths; content endpoints revalidate stored identity.
- Safe result codes distinguish ineligible plans, changed source sets, missing/tampered content,
  unavailable local tools, invalid media, and persistence races.
- Creation logs may include plan/version/assembly IDs, ordinals, hashes, durations, and elapsed time;
  they exclude prompts, provider responses, credentials, and absolute paths.

## Migration and Rollback

- Migration is additive: two tables, indexes, unique source-set identity, and foreign keys with
  restrictive deletion. It rewrites no plan, spec, batch, job, artifact, or Human QA row.
- Rollback disables the new UI/API surface while leaving assembly records and files readable evidence.
  No destructive down migration or automatic binary deletion is performed.

## Complexity Tracking

No constitution violations require justification. Separate assembly/source rows are necessary so one
immutable output can prove its exact ordered inputs without mutating source artifacts or Human QA.
