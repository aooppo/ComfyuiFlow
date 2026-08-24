# Implementation Plan: Project and Asset Workspace

**Branch**: `006-project-asset-workspace` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-project-asset-workspace/spec.md`

## Summary

Add the first non-technical product surface to the existing TypeScript monorepo: a local project
library and project asset workspace. A Next.js Web/API application will use a PostgreSQL/Prisma
business model and a server-only content-addressed local storage adapter. Imports stream to a
temporary file, validate type/limits, hash and atomically preserve original bytes, then commit
metadata and append-only activity evidence. This phase has no AI, ComfyUI, external upload, or paid
provider path.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22, React 19

**Primary Dependencies**: Next.js App Router, Prisma 6, Zod 4, Busboy-compatible streaming
multipart parser, `file-type`, `sharp`, FFprobe

**Storage**: PostgreSQL for business records; local content-addressed files under a configurable
storage root for immutable binary originals

**Testing**: Vitest unit, contract, and integration tests; Prisma schema validation; browser-level
manual quickstart for the delivered UI

**Target Platform**: Local macOS desktop browser and Node server; Docker PostgreSQL development
service

**Project Type**: TypeScript modular monolith with one Web/API app, reusable project domain/storage
package, existing CLI/MCP spike packages, and standalone later worker boundary

**Performance Goals**: First useful view under two seconds for 500 assets; batch import of up to 20
files with per-item outcomes; server memory remains bounded by streaming rather than file size

**Constraints**: Local single owner; originals immutable; binary files outside PostgreSQL; default
250 MiB per file and 20 files per batch; no symlink ingestion; no external calls; no permanent
deletion; all owner-entered text rendered as text

**Scale/Scope**: One owner, hundreds of projects, up to 500 active assets per project in Phase 1;
project and asset UI/API only

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle                                          | Design evidence                                                                                                                                | Status |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Prove the Video Path First                      | Phase 0.5 produced a retained playable H3 MP4 and owner `PASS`; this feature starts only after that gate.                                      | Pass   |
| II. Separate Creative Intelligence from Generation | Project/Asset routes have no Director, storyboard, workflow, or generation dependency.                                                         | Pass   |
| III. Provider-Neutral Contracts                    | Phase 1 adds no provider-specific model data or calls; later AI capabilities consume project assets through neutral IDs and roles.             | Pass   |
| IV. Zero-Call Defaults                             | The feature contains no AI/provider/ComfyUI client path and tests assert zero external network use.                                            | Pass   |
| V. Durable Provenance                              | SHA-256 stored objects, immutable originals, append-only import attempts/activity, archive/remove states, and no hard delete preserve lineage. | Pass   |
| MVP technical constraints                          | Next.js, PostgreSQL/Prisma, Zod, and a replaceable local storage boundary match the constitution.                                              | Pass   |
| Delivery quality gates                             | Format, lint, typecheck, tests, build, Prisma validation, secret scan, and diff checks are tasks and quickstart gates.                         | Pass   |

## Project Structure

### Documentation (this feature)

```text
specs/006-project-asset-workspace/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── project-assets.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── project-web/
│   ├── app/
│   │   ├── api/projects/
│   │   ├── projects/[projectId]/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   ├── next.config.ts
│   └── package.json
├── comfyui-mcp/
└── spike-cli/

packages/
├── project-core/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   └── src/
│       ├── contracts.ts
│       ├── project-service.ts
│       ├── asset-service.ts
│       ├── local-storage.ts
│       ├── media-probe.ts
│       └── index.ts
├── contracts/
├── ai-providers/
├── comfyui-bridge/
└── spike-core/

tests/
├── contract/project-assets-api.test.ts
├── integration/project-asset-workspace.test.ts
└── unit/project-storage.test.ts

docker-compose.yml
```

**Structure Decision**: Add one product Web/API application and one reusable server-only
Project/Asset domain package without changing the established spike/MCP packages. The Web app owns
presentation and HTTP translation; `project-core` owns validation, persistence orchestration,
storage safety, hashing, deduplication, and media inspection.

## Phase 0 Research Decisions

Research in [research.md](research.md) resolves the persistence, immutable storage, streaming
upload, media validation, duplicate handling, and UI boundary choices. No unresolved technical
clarifications remain.

## Phase 1 Design

- [data-model.md](data-model.md) defines Project, Asset, StoredObject, AssetImportAttempt, and
  ProjectActivity identities, constraints, indexes, and transitions.
- [contracts/project-assets.openapi.yaml](contracts/project-assets.openapi.yaml) defines the
  owner-facing API, multipart batch outcomes, stable error codes, and idempotent archive/remove
  behavior.
- [quickstart.md](quickstart.md) defines a zero-call validation route from database start through
  UI import, preview, filtering, removal, archive/restore, restart persistence, and quality gates.

## Security and Reliability Design

- Accept browser file bytes only; never trust a submitted local path.
- Reject empty files, unsupported detected types, oversize files, excess batch count, and filename
  path traversal. Preserve display filenames only after basename/control-character normalization.
- Stream each item into a same-filesystem temporary area while computing SHA-256; compare detected
  type with the allowlist, fsync, then atomically rename into a SHA-256 content-addressed path.
- Refuse symbolic links inside storage operations and never serve arbitrary filesystem paths.
- Return content only by an authorized local asset record using safe inline headers and
  `nosniff`; internal storage paths never cross the API.
- Make each import item its own transaction after its content is safely stored. Database failure
  can leave an unreferenced content-addressed object, which is safe and can be reconciled later;
  it cannot create a READY asset without verified bytes.
- Treat metadata extraction as best effort and record a non-secret inspection warning while
  keeping the original usable.
- Archive/remove are state transitions, not deletes. Downstream references block removal once
  those relationships exist.

## Migration and Rollback

1. Start a new PostgreSQL schema from the checked-in initial migration; no historical Phase 0/0.5
   files are imported.
2. Configure the content root independently from `var/spike`; existing workflow/artifact evidence
   is untouched.
3. Rollback stops the Web app and reverts the new database migration only in an empty/development
   database. Once owner assets exist, rollback preserves the database and content root and uses the
   previous application revision.
4. No automatic binary garbage collection ships in Phase 1, so rollback cannot remove originals.

## Observability and Verification

- Structured server logs contain operation, result code, project/asset IDs, byte counts, and
  elapsed time but never briefs, notes, file contents, storage paths, or secrets.
- ProjectActivity and AssetImportAttempt are the durable owner/audit readback.
- Tests verify hashing, atomic preservation, path containment, per-item batch results, same-project
  duplicate behavior, lifecycle transitions, filters, and restart readback.
- Browser QA verifies non-technical labels, loading/empty/error states, keyboard focus, preview,
  confirmations, and absence of internal IDs/commands/provider concepts.

## Post-Design Constitution Re-check

All gates remain passed. The design introduces the exact Web, PostgreSQL/Prisma, and storage
boundaries already required by the constitution and does not broaden provider authority or rewrite
historical evidence.

## Complexity Tracking

No constitution violations require justification.
