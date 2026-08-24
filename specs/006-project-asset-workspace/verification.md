# Verification: Project and Asset Workspace

**Completed**: 2026-08-24

## Entry gate and scope

- Phase 0.5 H3 artifact `4132e57c-fc4c-4190-8a0a-04fa5fecf1d5` remains retained with owner
  Human QA `PASS` and gate reason `OWNER_PASS`.
- Phase 1 created new Project/Asset business records only. It did not import, rewrite, delete, or
  migrate Phase 0/0.5 workflows, artifacts, hashes, grants, or review evidence.
- External AI calls / ComfyUI generation calls / external uploads: `0 / 0 / 0`.

## Delivered boundaries

- Next.js Project library and Project detail workspace at the local port `3210`.
- PostgreSQL/Prisma Project, StoredObject, Asset, AssetImportAttempt, and ProjectActivity schema
  with the checked-in initial migration.
- Streaming multi-file import with per-item results, configured file/batch limits, signature
  allowlist, SHA-256 content addressing, atomic no-overwrite preservation, and immutable originals.
- Image, video, and audio media inspection through FFprobe; an inspection failure records a safe
  warning without discarding the original.
- Same-project duplicate resolution, constrained creative roles, metadata-only edits, filtered
  list, safe inline preview, project archive/restore, and provenance-safe asset removal.
- Non-technical owner interface with loading, empty, error, filter, confirmation, import-result,
  preview, and archived/read-only states.

## Real PostgreSQL evidence

- Dedicated Compose service: `comfyuiflow-project-postgres-1`, PostgreSQL 16, bound only to
  `127.0.0.1:5448`.
- Migration `202608240001_project_asset_workspace` applied successfully.
- Real database integration suite: `3 / 3` passed.
- Verified project create/edit/list/archive/restore plus append-only activity readback.
- Verified PNG and WAV imports, media facts, same-project duplicate result, metadata immutability,
  filters, content readback, soft removal, retained StoredObject, and retained import attempts.
- A 500-asset project query completed below the two-second acceptance ceiling.
- A freshly constructed storage/service boundary recomputed imported PNG SHA-256 and matched the
  stored fingerprint; the bytes remained readable after asset removal.

## Browser Human QA

- Created `Phase 1 UI QA` with a landscape target and reopened its Project page.
- Imported `scene.png` and `shot.mp4` together through the visible file chooser; both showed an
  independent `Imported` result and two asset cards appeared.
- Reimported `scene.png`; the UI showed `Already in this project` and the card count remained two.
- Selected the Video filter; the visible result count became one.
- Opened the video preview and verified the rendered source, `160 × 96`, `0.50 seconds`, original
  filename, import timestamp, and full SHA-256 facts.
- Archived the project through its confirmation, confirmed it moved to Archived Projects, opened
  it read-only with both assets retained, restored it, and confirmed both cards plus import controls
  returned.
- Visual inspection passed at desktop width: hierarchy, contrast, spacing, focusable controls,
  preview layout, non-technical labels, and responsive structure were coherent.
- Browser console errors/warnings: none.
- Browser removal was deliberately not executed because browser policy treats removal as a delete
  class action; the same soft-removal behavior is proven at the real database/storage boundary.

## Automated quality gates

- Format check: passed.
- ESLint: passed.
- Root and Project Web type checks: passed.
- Standard Vitest suite: `16` files passed, `57` tests passed; the opt-in PostgreSQL file was skipped
  there and run separately.
- Opt-in real PostgreSQL suite: `1` file / `3` tests passed.
- Prisma schema validation: passed.
- Next.js production build: passed; all Project/Asset pages and nine API route groups were built.
- Secret scan: passed after excluding generated ignored `.next` output from repository-source
  scanning.
- `git diff --check`: passed.

## Requirement convergence

- FR-001–FR-022: implemented and mapped to service, HTTP, UI, contract, integration, storage, and
  browser evidence.
- SC-001: browser create/import path completed well within three minutes.
- SC-002: 500-asset database query passed the two-second ceiling; browser first useful states are
  explicit.
- SC-003–SC-006: batch outcomes, fingerprint, duplicate, archive/restore, and retained-evidence
  tests passed.
- SC-007: no external-call path exists in the Phase 1 routes/services and observed call counts are
  zero.
- SC-008: media/role filters and owner-facing media distinctions passed browser QA.

## Convergence pass

- The first convergence audit found one partial FR-007/SC-004 gap: verified readback checked safe
  path, file type, and size but did not recompute SHA-256.
- T037 added streaming SHA-256 readback verification, a same-size tamper rejection test, and a
  restart-style real-database readback test. The follow-up convergence audit found no remaining
  actionable gaps.
- After production build invalidated the concurrently running development cache, the development
  server was restarted. A fresh browser tab loaded `Phase 1 Demo` with no runtime overlay, console
  errors, or warnings.

## Remaining boundaries

- This is a local development delivery; it is not committed, pushed, or remotely deployed.
- Project deletion, Asset restoration, permanent binary garbage collection, authentication,
  collaboration, AI understanding, Director, storyboard, generation, QA, and assembly remain out of
  Phase 1 scope.
- The local PostgreSQL service and Project Web development server remain running for owner review.
