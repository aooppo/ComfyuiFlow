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
