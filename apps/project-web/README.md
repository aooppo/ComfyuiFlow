# Project Web

The Phase 1 product surface is a local single-owner Project/Asset workspace. It deliberately hides
CLI commands, workflow graphs, provider task IDs, and dry-run manifests.

## Local startup

1. Copy only the non-secret Project/Asset values from `.env.example` into an ignored environment.
2. Start PostgreSQL with `docker compose up -d project-postgres`.
3. Run `pnpm project:db:generate`, apply `pnpm project:db:migrate` with `DATABASE_URL`, then run
   `pnpm project:dev` with the same database URL.
4. Open `http://127.0.0.1:3210`.

## Data lifecycle

- PostgreSQL stores projects, asset metadata, import attempts, and activity evidence.
- Original bytes stay outside PostgreSQL under `PROJECT_ASSET_STORAGE_DIR` using lowercase SHA-256
  content keys.
- Import streams to a private temporary file, enforces configured limits, detects the media
  signature, verifies SHA-256/size, and atomically links the final immutable object before an Asset
  can become READY.
- Same-project identical bytes return the existing active or removed Asset. They are never silently
  duplicated or restored.
- Project archive/restore and Asset removal are state transitions. Phase 1 exposes no permanent
  deletion or binary garbage collection.

## Phase 2 interaction boundaries

- The file library shows `PRESERVED`, `READY`, `INVALID`, and `REMOVED`, has stable paging/search,
  and supports local revalidation. It never exposes a storage path or probe output.
- The semantic catalog creates reusable Character/Outfit/Prop/etc. identities and immutable version
  history. A Character state may compose Outfit, Hair, Makeup, and Accessory versions; regular Props
  are intentionally labeled as Shot-level work for Phase 3.
- Candidate preview is an explainable, read-only preflight for a future storyboard. “Eligible” is
  not a formal Shot selection.
- Understanding preview is zero-call. The confirmation checkbox enables one governed attempt only;
  the default Fake provider remains local. Machine facts, owner decisions, corrections, and explicit
  draft-target applications are separate evidence records.

## Verification

Run the standard repository gates plus the real PostgreSQL suite:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm project:db:validate
DATABASE_URL=postgresql://comfyuiflow:comfyuiflow@127.0.0.1:5448/comfyuiflow RUN_PROJECT_DB_TESTS=1 pnpm exec vitest run tests/integration/project-asset-workspace.test.ts
DATABASE_URL=postgresql://comfyuiflow:comfyuiflow@127.0.0.1:5448/comfyuiflow pnpm project:build
pnpm secret:scan
git diff --check
```

The database suite uses only the dedicated local Compose database and test-created records. No
AI/provider/ComfyUI service is required; Provider and generation calls remain `0 / 0`.

## Storyboard workspace

Open a project and choose **Open storyboards**. The separate editor supports a deterministic
three-shot Fake proposal followed by owner-controlled 1–20-shot editing, add/remove/reorder,
immutable saves, refresh readback, and side-by-side version comparison. Empty Storyboards can be
deleted; established Storyboards can be archived and restored without losing history. Candidate
preview shows gaps without persisting a choice.

Formal asset binding and approval are server-gated and default closed. When Phase 2 Human QA is
complete, the server gate may be enabled to revalidate owner selections, freeze an exact manifest,
and append an approval decision. Approval never authorizes generation.

## UI language

The top bar provides `中文` and `EN` controls across the Project/Asset, Phase 2, and Storyboard
workspaces. The preference is stored only in the local browser, survives refresh and navigation,
updates the document language for accessibility, and never changes persisted project or asset data.

## Shot Plan workspace

After a Storyboard version is approved with a frozen Manifest, choose **Open Shot Plan**. The
separate page displays the three provider-neutral specifications, continuity facts, exact reference
identities and SHA-256 values, capability requirements, immutable history, comparison, and
preflight blockers. Prompt edits append a new owner version and stale tabs reload the winning head.

Storyboard approval, Shot Plan approval, and generation authorization are distinct states. Phase 4
always displays generation as unauthorized and has no Provider, workflow, ComfyUI, or video submit
path.
