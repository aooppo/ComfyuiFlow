# Feature 017 Zero-Call Validation Guide

1. Confirm branch `codex/017-capability-generation-mainline` and an otherwise clean worktree.
2. Verify offline database dump and storage SHA manifest before the local reset.
3. Apply the single canonical migration to empty local data and confirm retired generation tables are absent.
4. Run registry, compiler, exact adapter, Worker consumption, restart reconciliation, ambiguity, artifact, AI-QA, Owner, retry, assembly, route-removal, and UI source tests with test injection only.
5. Run format, lint, typecheck, full Vitest, PostgreSQL integration, Prisma validation, production build, secret scan, and `git diff --check`.
6. Perform browser acceptance with LIVE disabled and confirm planning/batch review make no external calls.
7. Commit Feature 017 code, migration, tests, and specifications; confirm branch cleanliness.
8. For Test A, keep the Worker stopped, verify current source/runtime/provider/quality/price/expiry facts, generate the exact Preview, and stop for fresh Owner action-time confirmation.
