# Quickstart: Flexible Shot Lifecycle Validation

1. Use an isolated `*_test` PostgreSQL database and keep all live/provider flags false.
2. Create a Storyboard and run Fake Director; confirm the proposal still contains three shots and reports zero external calls.
3. Add two shots, remove one, reorder the four remaining shots, and save.
4. Refresh and confirm four contiguous shots, stable unaffected shot keys, and preserved historical three-shot version.
5. Freeze the current manifest, approve the four-shot Storyboard, and create a Shot Plan.
6. Confirm four ordered GenerationSpecs, edit/save/history/compare/preflight/approve/revoke, and confirm generation remains unauthorized.
7. Repeat service/database boundary tests with one and twenty shots; reject zero and twenty-one.
8. Create an empty Storyboard and permanently delete it after confirmation.
9. Archive the versioned Storyboard, confirm it leaves the active list and all writes fail, then restore it and verify all versions/plans/hashes are unchanged.
10. Run format, lint, type, default tests, isolated PostgreSQL tests, Prisma validation, migration preservation, production build, secret scan, diff check, and browser QA.
