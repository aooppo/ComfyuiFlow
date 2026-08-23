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

On the discovery baseline this is expected to report: ComfyUI unreachable, no enabled workflow,
no usable video model, and `generationCalls: 0`.

## 3. Register an owner-reviewed workflow

Export a ComfyUI workflow in API format. Add it under `workflows/` with a manifest that declares
the character image, scene image, shot prompt/settings, required node classes/models, and video
output. Review the graph for hidden API/network nodes before enabling it. Do not commit model files
or secrets.

Start ComfyUI locally only after its model requirements are installed, then rerun discovery. A
reachable server alone is not `ready`.

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
