# Tasks: Project and Asset Workspace

## Phase 1: Setup

**Purpose**: Add the product application/package skeleton and safe local runtime configuration.

- [x] T001 Add `apps/project-web/package.json`, `apps/project-web/tsconfig.json`, `apps/project-web/next.config.ts`, and workspace scripts in `package.json`
- [x] T002 [P] Add Phase 1 PostgreSQL and storage variables to `.env.example` and a scoped service to `docker-compose.yml`
- [x] T003 [P] Add `packages/project-core/package.json`, `packages/project-core/tsconfig.json`, and the `@comfyuiflow/project-core` path to `tsconfig.base.json`
- [x] T004 Verify and extend repository ignores for Next, Prisma, local database, uploads, and generated storage in `.gitignore`, `.prettierignore`, and `eslint.config.js`

---

## Phase 2: Foundational

**Purpose**: Establish contracts, persistence, safe storage, media inspection, and server wiring
required by every user story.

- [x] T005 Add shared project, asset, lifecycle, filter, and API validation schemas in `packages/project-core/src/contracts.ts`
- [x] T006 Add Project/Asset Prisma enums, models, uniqueness constraints, relations, and indexes in `packages/project-core/prisma/schema.prisma`
- [x] T007 Generate and check in the initial PostgreSQL migration in `packages/project-core/prisma/migrations/202608240001_project_asset_workspace/migration.sql`
- [x] T008 Add singleton Prisma wiring and error translation in `packages/project-core/src/prisma.ts` and `apps/project-web/lib/api.ts`
- [x] T009 [P] Add failing storage safety/hash/duplicate-path tests in `tests/unit/project-storage.test.ts`
- [x] T010 Implement streaming temporary writes, SHA-256 verification, atomic content-addressed preservation, safe reads, and limits in `packages/project-core/src/local-storage.ts`
- [x] T011 [P] Add image and FFprobe best-effort inspection in `packages/project-core/src/media-probe.ts`
- [x] T012 Export the server-only Project/Asset package surface in `packages/project-core/src/index.ts`

**Checkpoint**: Prisma validates and storage unit tests pass without a running Web app or external
network access.

---

## Phase 3: User Story 1 - Create and reopen a video project (P1)

**Goal**: Create, list, open, edit, archive, and restore durable owner-facing projects.

**Independent Test**: Create a project from an empty library, edit it, leave/reopen it, restart the
app, archive it, view archived projects, and restore it without seeing internal identifiers.

- [x] T013 [P] [US1] Add failing project lifecycle service tests in `tests/integration/project-asset-workspace.test.ts`
- [x] T014 [P] [US1] Add failing project endpoint contract tests in `tests/contract/project-assets-api.test.ts`
- [x] T015 [US1] Implement transactional project lifecycle and append-only activity logic in `packages/project-core/src/project-service.ts`
- [x] T016 [US1] Implement list/create/read/edit/archive/restore routes under `apps/project-web/app/api/projects/`
- [x] T017 [US1] Build the accessible project library, create dialog, active/archive tabs, loading/empty/error states, and cards in `apps/project-web/app/page.tsx` and `apps/project-web/components/project-library.tsx`
- [x] T018 [US1] Build project detail/edit shell and lifecycle actions in `apps/project-web/app/projects/[projectId]/page.tsx` and `apps/project-web/components/project-header.tsx`
- [x] T019 [US1] Add the responsive product shell, typography, focus, dialog, and status styling in `apps/project-web/app/layout.tsx` and `apps/project-web/app/globals.css`

**Checkpoint**: User Story 1 persists through PostgreSQL and is independently usable before asset
import exists.

---

## Phase 4: User Story 2 - Import and organize source assets (P1)

**Goal**: Import image/video/audio originals safely, retain provenance, deduplicate by project and
content, and edit descriptive metadata.

**Independent Test**: Import a mixed valid batch plus an invalid file, verify independent results
and media facts, reimport identical bytes, edit metadata, restart, and recompute every READY hash.

- [x] T020 [P] [US2] Add failing import, per-item outcome, same-project duplicate, immutable metadata, and restart readback tests in `tests/integration/project-asset-workspace.test.ts`
- [x] T021 [P] [US2] Add failing multipart import and asset metadata endpoint contract tests in `tests/contract/project-assets-api.test.ts`
- [x] T022 [US2] Implement per-file validation, storage commit, media inspection, deduplication, import-attempt evidence, and asset metadata updates in `packages/project-core/src/asset-service.ts`
- [x] T023 [US2] Implement streaming multipart import and asset read/edit routes under `apps/project-web/app/api/projects/[projectId]/assets/` and `apps/project-web/app/api/assets/[assetId]/`
- [x] T024 [US2] Build multi-file selection/drop zone, constrained role picker, progress/result summary, and actionable per-file errors in `apps/project-web/components/asset-importer.tsx`
- [x] T025 [US2] Build asset gallery cards and metadata editor in `apps/project-web/components/asset-library.tsx` and integrate them into `apps/project-web/app/projects/[projectId]/page.tsx`

**Checkpoint**: Project plus import/organize is a usable Phase 1 MVP with verified immutable
originals and zero external calls.

---

## Phase 5: User Story 3 - Browse and safely remove workspace items (P2)

**Goal**: Filter, preview, inspect provenance, and provenance-safely remove active asset links.

**Independent Test**: Filter a mixed 500-item library, preview each media type, inspect facts, remove
an asset after confirmation, and prove original/import/activity evidence remain.

- [x] T026 [P] [US3] Add failing filter, preview header/path safety, idempotent removal, and retained-evidence tests in `tests/integration/project-asset-workspace.test.ts`
- [x] T027 [P] [US3] Add failing list filter, content stream, and remove endpoint contract tests in `tests/contract/project-assets-api.test.ts`
- [x] T028 [US3] Implement filtered asset queries, verified content readback, and reference-safe idempotent removal in `packages/project-core/src/asset-service.ts`
- [x] T029 [US3] Implement filtered listing, safe inline content streaming, and removal routes under `apps/project-web/app/api/projects/[projectId]/assets/` and `apps/project-web/app/api/assets/[assetId]/`
- [x] T030 [US3] Add media-type/role filters, visible result count, accessible preview dialog, provenance facts, and removal confirmation in `apps/project-web/components/asset-library.tsx` and `apps/project-web/components/asset-preview.tsx`

**Checkpoint**: All three stories work independently and preserve immutable evidence.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [x] T031 [P] Add safe structured operation logging and redaction assertions in `packages/project-core/src/operation-log.ts` and `tests/unit/project-storage.test.ts`
- [x] T032 [P] Document Phase 1 startup, zero-call boundary, storage model, and owner workflow in `README.md` and `apps/project-web/README.md`
- [x] T033 Add generated client/migration/start/validate scripts and production configuration in `package.json`, `apps/project-web/package.json`, and `docker-compose.yml`
- [x] T034 Run the quickstart and record PostgreSQL persistence, stored-byte hash readback, UI Human QA, and provider/generation `0 / 0` evidence in `specs/006-project-asset-workspace/verification.md`
- [x] T035 Run format check, lint, typecheck, all tests, production build, Prisma validation, secret scan, and `git diff --check`; fix only Phase 1 regressions
- [x] T036 Reconcile every FR/SC against implementation/tests and update `specs/006-project-asset-workspace/tasks.md` plus `specs/006-project-asset-workspace/verification.md`

## Dependencies and Execution Order

- Phase 1 has no feature dependencies beyond the retained Phase 0.5 owner `PASS`.
- Phase 2 depends on Phase 1 and blocks all user stories.
- User Story 1 establishes project identity and must complete before User Story 2 persists assets.
- User Story 2 establishes imports and metadata before User Story 3 can browse/remove them.
- Phase 6 depends on all selected user stories.
- Tests in each story are written before the corresponding service/routes/UI implementation.
- Tasks that touch the same service or UI file execute sequentially even when their tests were
  parallel opportunities.

## Parallel Opportunities

- T002 and T003 can proceed after T001 because they affect separate configuration/package files.
- T009 and T011 affect separate foundation files.
- T013 and T014 can be written together for User Story 1.
- T020 and T021 can be written together for User Story 2.
- T026 and T027 can be written together for User Story 3.
- T031 and T032 can proceed together after story completion.

## Implementation Strategy

1. Complete Setup and Foundation with zero external services except local PostgreSQL.
2. Deliver User Story 1 as the smallest navigable product surface.
3. Add User Story 2 to form the Phase 1 MVP: create a project, import originals, and organize them.
4. Add User Story 3 for efficient browsing, preview, and provenance-safe cleanup.
5. Validate at database, stored-byte, HTTP, production-build, and human UI boundaries.

## Requirement Traceability

- US1: FR-001–FR-003, FR-016–FR-017, FR-020–FR-022; SC-001, SC-006.
- US2: FR-004–FR-012, FR-017–FR-022; SC-001, SC-003–SC-005, SC-007.
- US3: FR-013–FR-016, FR-020–FR-022; SC-002, SC-006–SC-008.

## Format Validation

All tasks use the required checkbox, sequential task ID, applicable `[P]`/story label, and concrete
file path format.

---

## Phase 7: Convergence

- [x] T037 Recompute stored content SHA-256 during verified readback and add same-size tamper plus restart-style verification tests in `packages/project-core/src/local-storage.ts`, `tests/unit/project-storage.test.ts`, and `tests/integration/project-asset-workspace.test.ts` per FR-007 and SC-004 (partial)
