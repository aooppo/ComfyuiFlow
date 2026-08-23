# ComfyuiFlow

ComfyuiFlow is currently a safety-first technical vertical spike. It proves the control path for:

```text
character image + scene image + creative description
  -> provider-neutral AI Director (OpenAI first)
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
- OpenAI Director adapter: implemented with `gpt-5.4-2026-03-05`, image input, structured output,
  and `store: false`.
- Local ComfyUI: running on loopback at source version `v0.33.2`, using Apple MPS.
- Real video readiness: `ready: true` for the registered Wan2.2 TI2V 5B dual-reference pilot;
  official model files, graph hash, node classes, bindings, and native prompt validation pass.
- Real calls made by this implementation: zero OpenAI calls and zero ComfyUI generation
  submissions. No playable real artifact is claimed yet.

See [DISCOVERY.md](./DISCOVERY.md) and the active
[feature specification](./specs/001-comfyui-vertical-spike/spec.md).

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

The `run` command exists for the later owner-authorized attempt, but it fails closed unless both
`OPENAI_LIVE_ENABLED=1` and `COMFYUI_LIVE_ENABLED=1` are set, the OpenAI key is environment-only,
the registered workflow is ready, and both grants match. It never retries or falls back.

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

## Provider roadmap

Creative code depends on `AiModelProvider`; ComfyUI uses a separate generation boundary. Qwen is
intentionally deferred until after the video path is proven, at which point a dedicated Model
Studio adapter can implement the same structured contract without enabling arbitrary endpoints or
automatic fallback.
