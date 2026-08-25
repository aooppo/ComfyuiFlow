# Quickstart Validation: Flexible Storyboard Workspace

## Safe prerequisites

1. Keep all LIVE flags false and use an isolated PostgreSQL database named `comfyuiflow_test`.
2. Apply migrations to that database and use an isolated `PROJECT_ASSET_STORAGE_DIR`.
3. Do not run broad PostgreSQL integration cleanup against the default `comfyuiflow` database.

## Automated validation

Run contract/unit tests first, then the isolated PostgreSQL suites. Verify:

1. Same normalized Fake input produces the same three shot bodies and zero calls.
2. Every save appends a version; a stale ETag creates no rows.
3. Existing one-shot tests remain unchanged and pass.
4. Gate-closed preview works, but resolve and approve create zero records.
5. Gate-open resolution revalidates selected candidates, freezes one manifest, and permits an
   append-only approval.
6. Cross-project, stale, rejected, unapproved, inactive, and non-ready inputs fail closed.

## Browser Human QA

With the local Web app running against isolated QA data:

1. Open an active project and enter Storyboards from the project page.
2. Create a storyboard, run Fake Director, and confirm exactly three understandable shot cards.
3. Add, remove, edit, reorder, and save a 1–20-shot owner version; refresh and compare old/current
   versions.
4. Use two tabs to demonstrate an actionable stale-version conflict.
5. Inspect per-shot candidate gaps. With the gate closed, confirm binding and approval are blocked.
6. After Phase 2 evidence opens the server gate, bind eligible assets, freeze the manifest, approve,
   and revoke without any generation action appearing.
7. Inspect Network/Console and the persisted ledger: external Provider, AI ranking, ComfyUI, and video
   generation counts remain zero.

Automated browser observations do not fill the Human QA decision; the reviewer records PASS/FAIL and
notes separately in `verification.md`.
