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

## Capability Pack extension verification (2026-08-27)

1. Set `CAPABILITY_PUBLICATION_ADMIN_TOKEN` only in the local server deployment environment, then
   open the capability page. The token is entered only to call the local-admin endpoint and is not saved.
2. Paste a reviewed Pack JSON without `expectedManifestSha256`, select **检查并生成摘要**, and review
   the returned `runtimeTargetRef`, model, compiler binding, sorted node allowlist and envelope.
3. Select **导入为 TRIAL（不生成）**. Confirm a receipt is returned with `externalCalls: 0`; the normal
   READY capability selector remains unchanged because import is not promotion.
4. For an imported Pack, run the server-owned Graph Intent compiler. Confirm it produces a frozen
   GenerationSpec/graph SHA and returns `generationAuthorized: false` / `externalCalls: 0`.
5. Run the existing Feature 018 preflight for the persisted frozen graph. Only a later, separate
   Trial-scope or action-time Owner authorization may create a real execution path.

Automated local checks: `pnpm vitest run tests/unit/capability-pack.test.ts
tests/unit/graph-intent.test.ts tests/unit/capability-publication.test.ts
tests/unit/capability-pack-planning.test.ts`, `pnpm project:db:generate`, and
`pnpm --filter @comfyuiflow/project-web build`. No database, ComfyUI, provider, or paid call is part
of these checks.
