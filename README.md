# ComfyuiFlow

ComfyuiFlow is currently a safety-first technical vertical spike. It proves the control path for:

```text
ordered reference images + creative description + approved generation prompt
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
- Video workflow readiness: the sole active workflow is the hosted MiniMax H3 five-reference
  DECOROLALA IN3725 minimum-cost validation path. The installed node rejects 2 seconds, so it uses
  the supported minimum 4-second 768P portrait profile, requires no local video-model weights, and
  fails closed when the direct submission credential is absent.
- Comfy account prerequisite: the owner reports login complete and USD 10 of Credits purchased;
  no account, balance, payment, or session data is stored by this project.
- Real vertical-spike evidence: four separately authorized CodexManager Director compatibility/run
  calls, zero official OpenAI calls, and one separately authorized ComfyUI generation submission.
  The retained MP4 passed technical validation, but owner review recorded `FAIL` because the middle
  and final frames showed severe color blocks, stretching, and structural collapse.

See [DISCOVERY.md](./DISCOVERY.md), the original
[vertical-spike specification](./specs/001-comfyui-vertical-spike/spec.md), and the active
[H3 live-validation specification](./specs/005-h3-live-validation/spec.md).

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
- `comfyui_get_node_catalog`
- `comfyui_get_node_info`
- `comfyui_validate_registered_workflow`
- `comfyui_check_execution_readiness`
- `comfyui_submit_execution_plan`
- `comfyui_retain_execution_plan_artifacts`
- `comfyui_get_queue`
- `comfyui_stage_input`
- `comfyui_submit_workflow`
- `comfyui_get_job_status`
- `comfyui_get_artifacts`
- `comfyui_cancel_job`

The CLI talks to ComfyUI through these MCP tools. The bridge translates to the locally confirmed
HTTP endpoints; ordinary CLI input cannot supply raw workflow JSON, node IDs, arbitrary base URLs,
or output paths.

Workflow Agent submission accepts only the frozen plan/job/authorization identities and exact
hashes. The bridge reloads the plan from PostgreSQL, resolves immutable inputs inside server-owned
storage, rechecks readiness and materialized identity, then submits once. Path-bearing spike tools
remain only for legacy compatibility.

## Registered workflow

[`workflows/registry.json`](./workflows/registry.json) keeps the historical two-reference and
15-second H3 graphs disabled and enables `minimax-h3-decorolala-validation-4s-v1`. The active graph
supplies scene, product, full-body character, face identity, and rear/side identity as ordered
`Image 1`–`Image 5`, then saves one MP4 through `SaveVideo`. Its fixed profile is 768P, 9:16, 24fps,
and 4 seconds. See
[`workflows/README.md`](./workflows/README.md) for input and revision constraints.

H3 is hosted through Comfy Credits and has no local model-weight dependency. The owner logs into
ComfyUI and purchases credits outside this project. Direct CLI/MCP execution uses either
`COMFYUI_API_KEY` (preferred) or `COMFYUI_AUTH_TOKEN` from the process environment; the value is
never part of the request, workflow, authorization scope, evidence, or repository. Browser login
alone does not attach a credential to a direct `/prompt` API call. The CLI loads the ignored project
`.env` automatically and accepts Comfy's `COMFY_API_KEY` name as a compatibility alias.
Any graph, model, duration, resolution, fps, or output change requires a new workflow version,
SHA-256, dry-run, and authorization.

## Dry-run and authorization

Copy `.env.example` to an untracked environment file or export variables in the shell. The active
request binds five explicit roles plus an H3 full-reference prompt. A shortened shape example is:

```json
{
  "characterImage": "/absolute/path/character-full-body.png",
  "sceneImage": "/absolute/path/room.png",
  "additionalReferenceImages": [
    { "role": "PRODUCT", "image": "/absolute/path/product.png" },
    { "role": "CHARACTER_FACE", "image": "/absolute/path/character-face.png" },
    { "role": "CHARACTER_REAR", "image": "/absolute/path/character-rear.png" }
  ],
  "creativeDescription": "Create the minimum supported four-second product validation.",
  "generationPrompt": "subject_definitions:\n...the complete validated six-section H3 prompt...",
  "workflowId": "minimax-h3-decorolala-validation-4s-v1"
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
registered workflow is ready, a Comfy Partner Node credential is configured, and both grants
match. Missing Partner credentials block readiness and submission before the generation grant is
consumed. It never retries or falls back to official OpenAI.

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

## Phase 1 Project/Asset workspace

Phase 1 adds a local, non-technical project library at `http://127.0.0.1:3210`. It creates and
reopens named projects, streams image/video/audio imports, stores immutable originals by SHA-256,
shows media facts and previews, filters by media/creative role, and uses provenance-safe archive
and removal states. It never invokes AI, ComfyUI, an external upload, or a paid provider.

```bash
docker compose up -d project-postgres
pnpm project:db:generate
DATABASE_URL=postgresql://comfyuiflow:comfyuiflow@127.0.0.1:5448/comfyuiflow pnpm project:db:migrate
DATABASE_URL=postgresql://comfyuiflow:comfyuiflow@127.0.0.1:5448/comfyuiflow pnpm project:dev
```

The default content root is ignored `var/project-assets`; change it with
`PROJECT_ASSET_STORAGE_DIR`. Phase 0/0.5 artifacts and workflow evidence are not imported or
rewritten. See [`apps/project-web/README.md`](./apps/project-web/README.md) for validation and data
lifecycle details.

### Capability Pack（Feature 018）

在同一个本地页面可导入已审核的 Capability Pack。先在忽略的 `.env` 设置一个仅本机知道的
`CAPABILITY_PUBLICATION_ADMIN_TOKEN`，重启项目 Web，再输入该口令。页面先生成并展示 canonical
digest，复核模型、运行目标、节点白名单和参数范围后，才会导入为 `TRIAL`。它不会连接 ComfyUI、调用
模型或发起视频生成。一个兼容 Pack 可以复用同一 ComfyUI MCP/provider；不兼容既有受限配方的节点拓扑
才需要开发发布新的 compiler profile。

## Phase 2 Asset Understanding

Phase 2 keeps physical source files, reusable creative identities, and AI observations distinct:

- `Asset`/ProjectAsset stores immutable local bytes and an append-only media probe history. A file is
  `PRESERVED`, `READY`, `INVALID`, or `REMOVED`; only locally revalidated `READY` files can be used
  as semantic references or submitted for understanding.
- `ProductionAsset` represents a reusable Character, Outfit, Prop, Scene, Voice, LoRA, Hair,
  Makeup, Accessory, or Other identity. Its draft/active/retired versions bind ready files by an
  explicit reference usage. Character states compose Outfit/Hair/Makeup/Accessory versions; ordinary
  Props deliberately remain available for Phase 3 Shot-level binding.
- `asset-candidate-v1` is a read-only, deterministic preflight for future storyboard generation.
  It hard-filters project/identity/state/version/approval/usage/media facts and returns explainable
  exclusions and gaps. It creates no Shot or formal selection.
- Asset Understanding first creates a zero-call preview. A checked owner confirmation creates a
  single-use grant and at most one Worker Attempt. Fake is the default; OpenAI is blocked unless
  `ASSET_UNDERSTANDING_LIVE_ENABLED=true` at execution time. Machine observations are append-only and
  need owner approval before an explicit application to a draft target.

Run the local worker once after a Fake-confirmed analysis has been queued:

```bash
DATABASE_URL=postgresql://comfyuiflow:comfyuiflow@127.0.0.1:5448/comfyuiflow pnpm project:worker
```

This never starts automatic retries or provider fallback. The normal local validation ledger is
`Provider 0 / AI ranking 0 / ComfyUI or video generation 0`.

## Phase 3 flexible storyboard workspace

Each active project now links to a separate Storyboards workspace. The local Fake Director creates
exactly three deterministic draft shots with zero external calls. Owner edits append immutable
versions containing 1–20 shots guarded by `If-Match`; shots can be added, removed, and reordered,
while historical versions remain readable and comparable. Empty Storyboards can be permanently
deleted; Storyboards with durable history use recoverable archive/restore.

Asset candidate preview remains read-only. Formal `ShotAssetBinding`, frozen
`AssetResolutionManifest`, and append-only approval decisions are implemented but fail closed while
`PHASE2_STORYBOARD_BINDINGS_ENABLED=false`. Storyboard approval is a creative decision only: it
never authorizes AI, ComfyUI, video generation, QA acceptance, or final assembly.

## Phase 4 Shot Planner

An approved 1–20-shot Storyboard now opens a separate **Shot Plan** workspace. The deterministic
Planner converts every approved Storyboard shot and its frozen asset Manifest into one immutable,
provider-neutral `GenerationSpec v1` record with canonical input, reference, and output hashes.

Owner prompt edits append new versions under `If-Match`; history remains comparable. Preflight
rechecks Storyboard approval, Manifest identity, exact file readiness/approval, project isolation,
and hashes without creating a job or calling a Provider. Shot Plan approval and revocation are
append-only decisions and always expose `generationAuthorized: false`.

Phase 4 contains no Provider/model selection, workflow or ComfyUI parameters, `GenerationJob`,
submission, retry, Artifact, audio, QA, assembly, or publishing path. Its external-call ledger is
`AI 0 / Provider 0 / ComfyUI 0 / video generation 0`.

## Phase 5–6 Generation & QA

An approved Shot Plan now includes a separate **Generate & QA** workspace. A zero-call Preview
revalidates the exact 1–20 selected specs, five semantic image slots, file hashes, registered
Provider profile, immutable workflow SHA, prompt hash, call ceilings, and visible cost information.
Incompatible shots remain visible but cannot be selected.

A confirmed batch creates one Job per shot plus a combined authorization with separate generation
and AI-QA ceilings. The single-concurrency worker consumes each target permission before its one
attempt, never retries or falls back, pauses after ambiguous submission or technical failure, and
reconciles only the recorded original Provider task. Fake generation and Fake QA are the defaults
and perform no external calls.

Generated MP4 bytes live under `PROJECT_GENERATED_STORAGE_DIR`, separate from source assets.
PostgreSQL retains hashes, provider lineage, FFprobe facts, first/middle/final review-frame hashes,
structured advisory AI QA, and append-only Owner PASS/FAIL decisions. Only Owner PASS can qualify an
artifact for a future assembly phase; no output is automatically approved or promoted.

LIVE H3 remains closed unless `PROJECT_GENERATION_LIVE_ENABLED=true`, the registered MCP workflow,
Partner credential, credits, and CodexManager gateway are all ready, and the Owner confirms the
exact action at execution time. That later acceptance is capped at one H3 submission and, only after
a technically valid artifact, one `gpt-5.4` frame-QA call.

## Workflow Agent operation and rollback

`pnpm project:dev` checks/starts project PostgreSQL, deploys existing migrations, checks loopback
ComfyUI health, optionally starts only the existing install named by `COMFYUI_INSTALL_DIR`, and owns
the Web and Worker children it starts. It never installs nodes, models, ComfyUI, or packages, and it
never stops an externally owned process.

`GET /api/projects/:projectId/generation-readiness` reports database, Worker, generation runtime,
bridge, credential, quota, current-price, and implementation state without exposing credentials,
endpoints, paths, raw graphs, task IDs, or machine configuration.

Rollback is additive and fail-closed: set `REAL_GENERATION_ENABLED=false`, then set
`PROJECT_GENERATION_ENGINE=legacy-v1` and restart local services. New real Workflow Agent submission
is blocked. Plans, evidence, artifacts, QA, and Owner decisions remain readable; already-submitted
work is limited to status, retention, supported cancellation, and reconciliation. There is no
destructive down migration.
