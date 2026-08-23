# ComfyuiFlow

ComfyuiFlow is currently a safety-first technical vertical spike. It proves the control path for:

```text
character image + scene image + creative description
  -> provider-neutral AI Director (CodexManager Local test default)
  -> one structured ShotSpecification
  -> project-owned ComfyUI MCP bridge
  -> registered ComfyUI API workflow
  -> retained and FFprobe-verified MP4
  -> separate owner feasibility review
```

The broader Next.js/PostgreSQL product, multi-shot generation, AI QA, Qwen adapter, and final
assembly remain gated until one real shot passes owner review or the owner explicitly accepts the
feasibility risk.

## Current status

- Project-owned stdio MCP bridge: implemented and fake-contract-tested.
- CodexManager Local Director adapter: default for tests and the spike CLI, fixed to the trusted
  `127.0.0.1:48760/v1` gateway with a separate environment-only key.
- Official OpenAI Director adapter: retained as a separate non-default Provider with pinned
  `gpt-5.4-2026-03-05`. The local gateway uses its supported `gpt-5.4` alias, so its resolved
  upstream snapshot is gateway-managed and must not be reported as pinned. Both use image inputs,
  strict structured output, and `store:false`.
- Local ComfyUI: running on loopback at source version `v0.33.2`, using Apple MPS.
- Real video readiness: `ready: true` for the registered Wan2.2 TI2V 5B dual-reference pilot;
  official model files, graph hash, node classes, bindings, and native prompt validation pass.
- Real vertical-spike evidence: four separately authorized CodexManager Director compatibility/run
  calls, zero official OpenAI calls, and one separately authorized ComfyUI generation submission.
  The retained MP4 passed technical validation, but owner review recorded `FAIL` because the middle
  and final frames showed severe color blocks, stretching, and structural collapse.

See [DISCOVERY.md](./DISCOVERY.md), the original
[vertical-spike specification](./specs/001-comfyui-vertical-spike/spec.md), and the active
[local-provider specification](./specs/002-codexmanager-local-provider/spec.md).

## Install and verify

Requirements: Node.js 22, pnpm 10, FFmpeg/FFprobe.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm secret:scan
pnpm spike discover
```

`discover`, tests, type checking, and builds cannot invoke OpenAI or submit ComfyUI work.

## MCP bridge

Run the local stdio server:

```bash
pnpm mcp:comfyui
```

It exposes only:

- `comfyui_list_workflows`
- `comfyui_check_readiness`
- `comfyui_get_queue`
- `comfyui_stage_input`
- `comfyui_submit_workflow`
- `comfyui_get_job_status`
- `comfyui_get_artifacts`
- `comfyui_cancel_job`

The CLI talks to ComfyUI through these MCP tools. The bridge translates to the locally confirmed
HTTP endpoints; ordinary CLI input cannot supply raw workflow JSON, node IDs, arbitrary base URLs,
or output paths.

## Registered workflow

[`workflows/registry.json`](./workflows/registry.json) registers only
`wan22-ti2v-5b-dual-reference`. Its reviewed API graph uses ComfyUI core nodes to scale the scene,
composite the character reference, generate 33 frames with Wan2.2 TI2V 5B, and save one H.264 MP4.
The fixed pilot profile is 512x288 at 16 fps for 2.0625 seconds. See
[`workflows/README.md`](./workflows/README.md) for input and revision constraints.

The three model files are installed only in the local ComfyUI model directories and never in this
repository. Any graph, model, duration, resolution, fps, or output change requires a new workflow
version, SHA-256, dry-run, and authorization.

## Dry-run and authorization

Copy `.env.example` to an untracked environment file or export variables in the shell. Requests
contain only three owner inputs and a registered workflow ID:

```json
{
  "characterImage": "/absolute/path/character.png",
  "sceneImage": "/absolute/path/scene.png",
  "creativeDescription": "The character enters and looks toward camera.",
  "workflowId": "wan22-ti2v-5b-dual-reference"
}
```

```bash
pnpm spike dry-run --request /absolute/path/request.json
pnpm spike grant director --request /absolute/path/request.json --expires-in 15
pnpm spike grant generation --request /absolute/path/request.json --expires-in 15
```

Grant creation makes zero provider calls. Each grant is exact-scope, expires, permits one attempt,
and is consumed before its network request. Failures and timeouts are not refunded.

The default Director test Provider is `codexmanager-local`. Its endpoint is an application constant,
not request input. Set `CODEX_MANAGER_API_KEY` in the server environment; dry-run reports only
`configured | missing/unreachable` and never the value. The `run` command fails closed unless both
`CODEX_MANAGER_LIVE_ENABLED=1` and `COMFYUI_LIVE_ENABLED=1` are set, the local key is available, the
registered workflow is ready, and both grants match. It never retries or falls back to official
OpenAI.

## Evidence and review

Runtime inputs, artifacts, grants, consumptions, and hash-chained JSONL events are stored under
ignored `var/spike`. Technical completion never becomes a human PASS automatically:

```bash
pnpm spike status --run <run-id>
pnpm spike review --run <run-id> --decision PASS --artifact <artifact-id> --notes "reviewed"
```

`FAIL` keeps productization closed. `RISK_ACCEPTED` is an explicit owner decision and remains
separate from technical success.

If a submit response is ambiguous, use only the preselected task ID recorded in the run evidence:

```bash
pnpm spike reconcile --run <run-id> --prompt <provider-task-id> --workflow <workflow-id>
```

Reconciliation can poll and collect that existing task; its generation port has no submit path.
Polling-limit exhaustion is treated as ambiguous rather than terminal because the remote prompt
may still be running. Historical `FAILED/POLL_LIMIT` evidence is also query-reconcilable without a
new grant or submission.

## Provider roadmap

Creative code depends on `AiModelProvider`; ComfyUI uses a separate generation boundary.
`codexmanager-local` and `openai` have distinct identities and credentials even though both use a
Responses-compatible wire contract. Qwen remains a future dedicated adapter; arbitrary endpoints
and automatic fallback remain disabled.
