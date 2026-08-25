# Quickstart: Approved Shot Plan Assembly

1. Apply the additive 012 migration to an isolated PostgreSQL database and generate Prisma Client.
2. Seed one approved three-shot plan with retained technically valid artifacts and append owner PASS
   only for shots 1 and 2. GET assembly state and verify `missingOrdinals: [3]` with zero writes.
3. Append owner PASS for a valid Shot 3 artifact. GET twice and prove identical ordered sources and
   source-set hash.
4. POST once with the displayed hash and an idempotency key. Verify the local output is H.264,
   768x1344, 24 fps, silent, duration-tolerant, hash-verified, and contains shots 1, 2, 3 in order.
5. POST again with the same source set and prove the same assembly ID is returned with no duplicate
   database row or file.
6. Append a later owner-PASS artifact for Shot 3. Verify the old preview remains playable and stale,
   and no new assembly appears until the owner clicks the local action again.
7. Run focused unit/contract/integration tests, migration rehearsal, type/lint/build checks, secret
   scan, and browser QA. Confirm the generation and AI QA call counts remain unchanged.
8. For a future Shot 3 retry, prepare a zero-call preview that names the 17:42 artifact as visual
   baseline and includes the exact sofa/table/glass/wine continuity constraints. Present cost and
   call cap for separate owner confirmation before any paid execution.
