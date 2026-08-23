# Implementation Plan: ComfyUI Vertical Spike

**Branch**: `codex/phase-0-discovery` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

## Summary

Prove the smallest safe video path before productization. The repository will provide a local
TypeScript MCP bridge over the confirmed ComfyUI HTTP API, a provider-neutral one-shot Director
contract with OpenAI as the first adapter, and a CLI that performs discovery, zero-call dry-run,
bounded LIVE execution, artifact verification, and a separate human feasibility review. The first
implementation stops at the readiness boundary because this machine currently has no registered
reference-conditioned workflow or usable video model. No real provider call is authorized by this
plan.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22

**Primary Dependencies**: `@modelcontextprotocol/sdk`, `openai`, Zod, Commander, Vitest

**Storage**: Local append-only JSONL evidence and immutable files under `var/spike`; PostgreSQL is
deferred until product Phase 1

**Testing**: Vitest unit/contract/integration tests, fake HTTP ComfyUI, FFmpeg/FFprobe fixtures

**Target Platform**: Local macOS, services bound to `127.0.0.1`

**Project Type**: pnpm workspace containing an MCP stdio server, reusable packages, and a CLI

**Performance Goals**: Readiness/dry-run under 2 seconds excluding hashing; status visible within
one configured polling interval; streamed artifact download

**Constraints**: Dry-run makes zero external calls; LIVE requires environment gates and separate
one-call grants; no retry/fallback; workflow hash must match the authorized hash

**Scale/Scope**: One owner, one shot, one character image, one scene image, one OpenAI Director
request, and at most one ComfyUI submission

## Constitution Check

### Before research

- PASS: video feasibility precedes UI, database, and multi-shot work.
- PASS: creative intent and ComfyUI workflow bindings remain separate.
- PASS: Director uses a provider-neutral contract; OpenAI is first and Qwen is deferred.
- PASS: DRY_RUN is the default and LIVE is bounded by two independent grants.
- PASS: source assets, runs, provider task IDs, outputs, and review are append-only.

### After design

- PASS: the application reaches ComfyUI only through MCP during the vertical spike.
- PASS: the bridge exposes only confirmed HTTP capabilities and does not claim workflow/model
  readiness.
- PASS: PostgreSQL and Next.js are intentionally deferred rather than replaced by a competing
  product architecture.
- PASS: no implementation task may execute a real provider call; the live run is a separate owner
  operation after prerequisites and authorizations exist.

## Architecture

```text
spike CLI
  |-- AiModelProvider --> OpenAI Responses adapter
  |-- evidence store --> append-only JSONL + immutable assets
  `-- GenerationProvider --> MCP client (stdio)
                               `-- project ComfyUI MCP bridge
                                     `-- confirmed ComfyUI HTTP API
```

The MCP bridge owns HTTP translation, schema validation, safe workflow binding, input staging,
status normalization, artifact discovery/download, queue inspection, and targeted cancellation.
The CLI owns domain validation, authorization consumption, run state, prompt/shot schemas, and
human review. Raw workflow JSON is never accepted from ordinary CLI inputs.

## Project Structure

```text
apps/
|-- comfyui-mcp/
|   `-- src/
`-- spike-cli/
    `-- src/
packages/
|-- contracts/src/
|-- comfyui-bridge/src/
|-- ai-providers/src/
`-- spike-core/src/
workflows/
|-- registry.json
`-- README.md
tests/
|-- contract/
|-- integration/
|-- fixtures/
`-- unit/
specs/001-comfyui-vertical-spike/
`-- contracts/
var/spike/                 # ignored runtime evidence and artifacts
```

**Structure Decision**: A small pnpm workspace keeps the MCP transport, ComfyUI HTTP translation,
AI provider adapter, and domain orchestration independently testable without introducing the
future Web/API/Worker/PostgreSQL stack before feasibility is proven.

## Delivery Stages

### Stage A - Discovery artifacts

Record exact local ComfyUI version/source hashes, endpoints, model/workflow inventory, MCP absence,
and unknown capabilities. Exit when evidence is reproducible and provider calls remain zero.

### Stage B - Minimal project-owned MCP bridge

Implement the tool contract in [contracts/mcp-tools.md](./contracts/mcp-tools.md), safe workflow
registry/bindings, HTTP client, stdio server, and fake-server contract tests. Exit when submit,
status, artifact, queue, cancel, and upload translations pass without a real generation.

### Stage C - Vertical spike preflight and dry-run

Implement asset hashing, one-shot schema, OpenAI adapter contract, append-only evidence,
authorizations, exact request preview, MCP client, and media verification. Exit when a blocked
local readiness report and a fixture-backed ready dry-run both report `providerCalls = 0`.

### Stage D - Separately authorized real attempt

Not part of automated implementation. After an owner installs a compatible model, registers a
verified workflow, supplies source images, enables each LIVE gate, and creates two exact one-call
grants, run one Director request and at most one ComfyUI submission. Verify the MP4 with FFprobe,
then record human PASS/FAIL separately.

## Security and Failure Semantics

- Only `http://127.0.0.1` or `http://localhost` ComfyUI endpoints are accepted by default.
- OpenAI and ComfyUI LIVE gates are separate environment variables; secrets remain environment
  only.
- Grants bind operation, input hashes, prompt/schema version, provider/model or workflow hash,
  maximum calls, expiry, and a random identifier.
- A grant is append-only consumed before the network request. Consumption is not rolled back.
- A deterministic client-generated UUID is sent as ComfyUI `prompt_id`; after an ambiguous submit,
  the system may only query that ID and must not submit again.
- Workflow bindings use an allowlisted JSON Pointer manifest. User input cannot select arbitrary
  nodes, local files, base URLs, or output paths.
- Artifact references are accepted only from terminal job output metadata and are downloaded via
  `/view`; paths are never composed into a local filesystem read.

## Verification Strategy

- Unit: schemas, hashes, JSON Pointer bindings, authorization scope/consumption, status mapping,
  artifact selection, secret redaction.
- Contract: MCP input/output schemas and fake ComfyUI responses for success, validation failure,
  ambiguous submission, cancel, missing artifact, and corrupt artifact.
- Integration: CLI dry-run through a spawned MCP stdio server to fake ComfyUI; assert no POST to
  `/prompt` and no OpenAI request.
- Media: fixture MP4 validated by FFprobe; empty/text files rejected.
- Repository: format, lint, typecheck, test, build, secret scan, and `git diff --check`.

## Migration and Rollback

There is no existing product data. Stage A-C add only source files and ignored local runtime data.
Rollback is removal of this feature branch. Future PostgreSQL migration will import only reviewed
evidence formats after the spike schema is frozen; it will not mutate historical JSONL records.

## Risks and Gates

| Risk                              | Current state          | Mitigation / gate                                               |
| --------------------------------- | ---------------------- | --------------------------------------------------------------- |
| No ComfyUI MCP configured         | Confirmed              | Build project-owned bridge                                      |
| No reference-conditioned workflow | Confirmed              | Block LIVE until registered and verified                        |
| No usable video model files       | Confirmed              | Block LIVE until installed and discovered                       |
| ComfyUI is not running            | Confirmed at discovery | Readiness reports blocked; no auto-start                        |
| Workflow API schema drift         | Possible               | Hash exact API workflow and validate node classes at readiness  |
| Ambiguous submit                  | Possible               | Preselected prompt UUID, query-only reconciliation, no resubmit |
| Semantic video quality            | Unknown                | One real shot plus explicit owner review before product phases  |

## Complexity Tracking

No constitution violations require an exception. The project-owned MCP bridge is required by the
constitution because discovery confirmed no external ComfyUI MCP.
