# Quickstart: Verify Per-Graph Zero-Call Evidence

1. Start a supported ComfyUI runtime with the intended custom nodes; do not create a generation batch or provide action-time authorization.
2. Seed or select a canonical `MaterializedGraphSnapshot` generated from an approved planning input and registered RuntimeContract.
3. Invoke the server-owned preflight with only the graph snapshot id.
4. Confirm the returned record has the expected graph SHA, RuntimeContract digest, safe runtime/catalog fingerprints, validator identity, and `PASS`.
5. Change a graph input, graph link, node class, or catalog fixture and repeat. Confirm a new `FAIL` evidence row is preserved and that no `/prompt` request occurred.
6. Attempt batch creation without matching PASS evidence. Confirm it fails before authorization, attempt, or consumption records are inserted.
7. With matching PASS evidence and independently valid action-time authorization/pricing, create a batch. Before any real submission, change the live catalog and verify submission fails before staging inputs or `/prompt`.

No step above authorizes paid generation. A separate fresh exact authorization is still required before a real video submission.

## Automated Verification (2026-08-27)

- `pnpm test`: 24 tests passed, including zero-call preflight, missing evidence, stale-catalog submission, and immutable-storage boundaries.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm project:db:validate`, `pnpm build`, `pnpm secret:scan`, and `git diff --check`: passed.
- No ComfyUI, Partner Node, or video-generation request was made by this verification.
