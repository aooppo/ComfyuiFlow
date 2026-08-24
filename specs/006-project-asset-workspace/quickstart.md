# Quickstart: Project and Asset Workspace

## Prerequisites

- Node.js 22, pnpm 10, Docker/Compose, and FFprobe.
- A local ignored `.env` derived from `.env.example`; do not add credentials.
- Phase 0/0.5 evidence remains under its current paths and is not copied or changed.

## Start the local product boundary

1. Install the locked workspace dependencies.
2. Start the Phase 1 PostgreSQL service.
3. Apply the checked-in Project/Asset migration and validate the schema.
4. Start the Project Web application and open the displayed local URL.

Expected: the project library shows a clear empty state, no provider login is requested, and no
ComfyUI/AI service is needed.

## Scenario 1: Create and persist a project

1. Create `DECOROLALA Coffee Table` with a brief and portrait `9:16` target.
2. Return to the project library and reopen its card.
3. Restart the Web application and reopen the same project.

Expected: owner-facing values and timestamps persist; no internal ID is shown in ordinary copy.

## Scenario 2: Mixed asset import

1. Import one valid image, one valid MP4, and one valid audio file in a batch of no more than 20.
2. Include one unsupported or empty file in a second batch.
3. Reimport one byte-identical valid file.

Expected: valid files independently become READY with SHA-256 and media facts; invalid input has an
actionable per-item result; duplicate import returns the existing asset and creates no second
active record. No file path is exposed.

## Scenario 3: Browse, preview, and edit metadata

1. Filter by media type and role and compare the visible result count.
2. Open image, video, and audio previews.
3. Change a display name, role, and notes; then refresh.

Expected: previews use the verified original; edits persist while fingerprint and byte size do not
change; owner text is rendered literally, including markup-like input.

## Scenario 4: Provenance-safe lifecycle

1. Confirm removal of an unreferenced asset.
2. Reimport the same bytes and inspect the duplicate result.
3. Archive the project, view the archived library, then restore it.

Expected: removed content is absent from the active gallery but its evidence/original remains;
reimport does not silently restore it; archive/restore loses no metadata or bytes.

## Restart integrity boundary

After restarting the database and Web application, retrieve each READY asset through its content
route and recompute SHA-256.

Expected: every digest equals the recorded fingerprint and all previews remain playable.

## Zero-call verification

Run the automated Phase 1 suite with ComfyUI, OpenAI, Qwen, and internet access unavailable.

Expected: all Project/Asset scenarios pass; provider and generation call counts remain `0 / 0`;
the application makes no external upload.

## Quality gates

Run formatting check, lint, typecheck, unit/contract/integration tests, production build, Prisma
schema validation, secret scan, and `git diff --check`.

Expected: every gate passes. Human QA additionally confirms keyboard-visible focus, useful
loading/empty/error states, confirmation wording, responsive desktop layout, and the absence of
CLI commands, workflow graphs, provider task IDs, or dry-run manifests in ordinary pages.
