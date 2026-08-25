# Verification: Flexible Shot Lifecycle

**Date**: 2026-08-25

## Outcome

Implementation and automated acceptance pass. Saved Storyboard versions and Generation Plans now
support 1–20 shots/specifications, while the zero-call Fake Director continues to propose exactly
three. Empty Storyboards can be permanently deleted; Storyboards with durable history can only be
archived and restored.

Owner visual/creative Human QA remains a separate manual PASS/FAIL decision. The automated browser
observations below do not fill that field.

## Automated gates

- Prisma Client generation: PASS.
- Prisma schema validation: PASS.
- Formatting: PASS (`prettier --check .`).
- Lint: PASS.
- Type checking: PASS for root and Project Web configurations.
- Default Vitest suite: PASS, 32 files passed and 4 skipped; 105 tests passed and 17 skipped.
- Isolated PostgreSQL suites: PASS, 3 files and 14 tests passed when run sequentially with file
  parallelism disabled.
- Production Project Web build: PASS, including archive and restore API routes.
- Secret scan: PASS.
- Diff whitespace check: PASS.

The first combined database run used Vitest file parallelism and correctly exposed that these
existing cleanup-heavy suites cannot share one database concurrently: a deadlock and cross-suite
fixture contamination occurred. The required isolated rerun used one worker and no file parallelism
and passed all 14 tests.

## Database and migration evidence

- Migration `202608250008_flexible_shot_lifecycle` is applied in both the isolated test database and
  the local business database.
- Before migration, the local business counts were Storyboard 2, StoryboardVersion 12,
  StoryboardShot 36, GenerationPlan 2, and GenerationSpec 6.
- After migration, the same counts read back as `2 / 12 / 36 / 2 / 6`; both existing Storyboards
  read back ACTIVE. The migration rewrote no version, shot, plan, spec, or historical hash.
- PostgreSQL coverage proves one-, four-, and twenty-shot plans persist exactly one deterministic
  GenerationSpec per source shot and preflight without writes.
- PostgreSQL coverage also proves empty hard delete, versioned archive refusal-to-delete,
  archive/write blocking, restore, stale conflict handling, and unchanged historical hashes.

## Browser observations

Against an isolated QA database, automated browser inspection confirmed:

1. An empty Storyboard opens at `0 / 20 shots` and exposes **Add shot**.
2. A one-shot draft can be saved as immutable version 1.
3. Shots can be added to four, reordered without losing their stable content, removed with ordinal
   normalization, added again, and saved as immutable version 2.
4. Reloaded list data displays `Version 2 · 4 shots`.
5. A versioned Storyboard card exposes an independent **Actions** menu containing **Archive**, and
   the library exposes separate Active and Archived views; empty cards select the destructive
   **Delete** path instead.

Archive/delete confirmations were not force-accepted by browser automation. Their mutations and
readback are covered at the HTTP/service/PostgreSQL boundaries, while final wording, visual layout,
and confirmation usability remain for Owner Human QA.

## Zero-call and authority boundary

- AI calls: 0
- Provider calls: 0
- ComfyUI calls: 0
- Video-generation calls: 0
- No GenerationJob, Artifact, QA result, execution grant, retry, or provider fallback was created.
- Shot Plan approval continues to report `generationAuthorized: false`.

## Owner Human QA

**Decision**: PASS

The owner confirmed the add/remove/reorder affordances, Active/Archived card actions, confirmation
wording, and restore discoverability.
