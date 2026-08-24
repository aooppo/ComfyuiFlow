# Quickstart: DECOROLALA H3 Live Validation

## Zero-call verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm secret:scan
pnpm spike discover
pnpm spike dry-run --request var/user-inputs/request-minimax-h3-decorolala-validation-4s-v1.json
git diff --check
```

Expected: five distinct references, the fixed 4-second minimum profile, matching workflow hash,
Partner credential readiness, and actual provider/generation calls `0 / 0`. If
`COMFY_ORG_CREDENTIAL_MISSING` remains, stop before creating grants.

## Mandatory stop

Display [h3-live-attempt.md](./contracts/h3-live-attempt.md), the full prompt, and the dry-run scope
hash. Ask the owner to confirm this exact one-attempt request. Do not create grants, set LIVE flags,
upload, call the Director, or submit H3 before confirmation.

## After exact confirmation only

Create fresh short-lived Director and generation grants, enable both LIVE gates only for the run,
execute once, and stop on every failure. Query-only reconcile a durable ambiguous task; never
resubmit.

After completion, retain the MP4, validate media facts, extract review frames, and ask the owner for
`PASS`, `FAIL`, or `RISK_ACCEPTED`.
