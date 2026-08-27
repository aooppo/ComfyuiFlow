# Verification: Dynamic Capability Generation Mainline

## Baseline and Safety Evidence

- Baseline worktree: `/Users/tj/Documents/ChatGPT/ComfyuiFlow-dynamic-v3`.
- Branch: `codex/017-capability-generation-mainline`, created from clean commit `58972a7`.
- Feature 016 specification and verification evidence are retained and marked superseded; no
  historical verification file was deleted.
- No ComfyUI `/prompt`, provider, or AI-QA call has been made for Feature 017.

## Offline Backup Evidence

- Before reset, process inspection found no project worker or web process; PostgreSQL 16 was the
  only listener on `127.0.0.1:5448`.
- A PostgreSQL 16 custom-format dump was produced through the local database container and verified
  by PostgreSQL 16 `pg_restore --list`.
- Offline backup directory: `offline-backups/feature-017-2026-08-27T02-22-58-401Z` (ignored from
  Git and never product-readable).
- The storage manifest records 8 files, each with a valid SHA-256, and the verified dump contains
  521,747 bytes. Active database and storage remain unchanged at this point.
- The first host-client attempt was intentionally rejected because local `pg_dump` is version 14
  while the database is version 16; the reset tool now uses the matching container client.
- `node scripts/feature-017-reset.mjs verify` now performs the reset prerequisites without mutation.
  It returned `readyForApprovedReset: true` for the sole Feature 017 migration, the timestamped
  backup, and its eight-file storage manifest. This is not reset authorization and did not set
  `FEATURE_017_RESET_APPROVED`.
- The approved reset path now also rejects any post-migration table set other than the 21 canonical
  tables plus Prisma migration metadata, or any non-empty active source/generated storage roots.

## Remaining Verification Gate

Do not run reset until the new single baseline migration, canonical runtime, and tests are ready.
Do not start the Worker or create a LIVE Batch until after the complete validation suite, clean
commit, exact Preview, and a fresh Owner action-time confirmation.

## Test A Source Evidence

- The scoped offline backup intentionally has no copy of the Test A source. A read-only SHA-256
  verification of the original checkout located the approved SCENE file at
  `var/project-assets/sha256/8e/8edca81a57d2b1deaf2a79581557c8314baccf64c663485d627390272d5280a1`.
- The Test A Preview service now requires this exact digest. The file must be copied only after the
  database/storage reset and rehashed after the copy; no source file, Batch, Worker, provider, or
  AI-QA operation has been started.

## Historical H3 Evidence

- The retired fixed Project Shot H3 graph is preserved only at
  `tests/fixtures/generation/historical-h3-project-shot-4s.api.json`. Its original 1,326 bytes and
  SHA-256 `6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a` are locked by a zero-call
  regression test. It has not been copied into the Feature 017 runtime path.

## Early Canonical Foundation

- Added the first canonical `CapabilityRegistry` with RuntimeContract ownership/digest validation
  and frozen implementation cross-reference checks.
- Added deterministic frozen GenerationSpec and MaterializedGraphSnapshot helpers with ordinary
  `schemaVersion: 1`.
- Focused zero-call verification: `pnpm vitest run tests/unit/capability-mainline.test.ts tests/contract/mcp-readiness.test.ts`
  passed 2 files / 9 tests. `pnpm typecheck` and `git diff --check` also passed. This validates only
  the early foundation and generic MCP surface, not the complete production Worker or LIVE path.
- The foundation now includes exact adapter/runtime resolution, consume-before-submit generic Worker
  behavior with terminal ambiguity/reconciliation, and a no-call Test A Preview fact gate.

## Canonical Baseline Rehearsal

- `packages/project-core/prisma/mainline-baseline.sql` now defines the intended clean generation
  lineage: 21 canonical tables, three state types, foreign-key composition, uniqueness constraints,
  and append-only evidence triggers. Attempt transitions are represented by immutable
  `GenerationAttemptEvent` records.
- It was applied with `ON_ERROR_STOP=1` to an isolated temporary PostgreSQL 16 database named
  `feature017_schema_check`; 21 public tables were observed, then that temporary database was
  dropped. The scoped `comfyuiflow` database and active storage were not modified.
- The exact same bytes are now the Feature 017 migration artifact
  `202608270001_capability_generation_mainline/migration.sql` (SHA-256
  `4485f4a7279d823a04f4d0c6bde1655966e5d496541f8b2711f090c9c9c68889`). Migration archaeology has
  now been removed from this isolated branch; real reset remains separately approval-gated.

## Mainline MCP Boundary

- Added only the new Worker-facing tools: `submit_generation_attempt`,
  `get_generation_attempt_status`, and `retain_generation_artifacts`.
- The generic adapter passes only attempt, adapter/runtime, and digest identities. The bridge loads
  graph/input data from canonical records, checks graph and RuntimeContract digests, rechecks the
  current node catalog, and stages hash-verified inputs before its existing live submission boundary.
- The generic MCP contract confirms exactly the four exposed tools (including read-only runtime
  catalog discovery) and zero `/prompt` calls. Legacy MCP tools are no longer registered; the
  remaining legacy core and web product paths still require removal before final production evidence.

## Canonical Schema and Active-Surface Rehearsal

- Prisma now declares only the canonical generation lineage plus the minimal Project, Asset,
  Storyboard, StoryboardVersion, and StoryboardShot foundation. The reset inspector was updated to
  require that 27-table set plus `_prisma_migrations`; the earlier 21-table rehearsal is superseded.
- The sole baseline migration was applied to a freshly created disposable PostgreSQL 16 database
  named `feature017_schema_check`. It produced the expected 27 public tables and was then dropped.
  The scoped `comfyuiflow` database and active storage were not modified.
- The active web route/component tree and project Worker were replaced with a capability-only
  workspace and the unique GenerationWorker loop. `pnpm typecheck` and `pnpm project:build` pass
  after this retirement. The production build exposes only `/`, `/projects/[projectId]`, and the
  read-only `/api/capabilities` surface at this intermediate point.

## Approved Local Reset and Zero-Call Browser Acceptance

- After the complete format, lint, typecheck, Vitest, Prisma validation, production build, secret,
  and diff checks passed, the guarded reset was executed with the objective-authorized
  `FEATURE_017_RESET_APPROVED=1` gate. Its post-reset inspection reported exactly 27 canonical
  tables and zero active source/generated files.
- Existing active source and generated storage were moved recoverably to the ignored offline path
  `offline-backups/feature-017-storage-2026-08-27T03-52-57-157Z`; the pre-reset database dump and
  eight-file hash manifest remain preserved under the earlier offline backup directory.
- Local browser acceptance used only the web process, never the Worker. The capability workspace
  rendered Frozen planning and Formal batch review, displayed an empty registered-capability state
  after the clean reset, and made zero ComfyUI, provider, or AI-QA calls. No retired controls or
  routes were reachable from the active page.
