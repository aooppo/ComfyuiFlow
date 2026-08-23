# Quickstart: Safe Vertical Spike

## 1. Install and validate

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These commands must not contact OpenAI or submit ComfyUI work.

## 2. Inspect local readiness

```bash
pnpm spike discover
```

The historical baseline reported an unreachable ComfyUI, no workflow, and no model. The current
prepared machine reports `ready: true`, no blockers, and `generationCalls: 0` for
`wan22-ti2v-5b-dual-reference` while the local ComfyUI process is running.

## 3. Start and inspect the registered workflow

Start the currently verified checkout on loopback:

```bash
cd /Users/tj/Applications/ComfyUI-LadyLala
./.venv/bin/python main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch
```

The registered graph and manifest are under `workflows/`. The three Wan2.2 model artifacts stay in
the local ComfyUI model directories and have been SHA-256 verified. Rerun `pnpm spike discover`
after any restart or model/workflow change; a reachable server alone is not readiness.

## 4. Produce a zero-call preview

Create a request JSON using the CLI contract, then run:

```bash
pnpm spike dry-run --request /absolute/path/request.json
```

Confirm both image hashes, exact workflow hash, fixed OpenAI snapshot, shot schema, settings,
blockers, and `providerCalls: 0`.

## 5. LIVE boundary (manual and separately authorized)

Do not perform this step until the owner has reviewed the dry-run. Create one Director grant and
one generation grant, enable the two environment gates, and execute once. A validation failure,
HTTP failure, timeout, or ambiguous response consumes the relevant grant. Never rerun the command
with the same or a replacement grant without a new owner decision.

## 6. Verify and review

Inspect the retained MP4, SHA-256, FFprobe facts, workflow/input lineage, and provider task ID.
Record `PASS` or `FAIL` separately. Product Phase 1 remains blocked until PASS or an explicit
`RISK_ACCEPTED` review exists.
