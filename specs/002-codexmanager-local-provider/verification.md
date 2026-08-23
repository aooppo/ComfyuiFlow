# Verification Evidence: CodexManager Local Test Provider

**Date**: 2026-08-23

**Branch**: `codex/phase-0-discovery`

**CodexManager Director requests**: 4 separately authorized calls

**Official OpenAI calls**: 0

**ComfyUI generation submissions**: 1 separately authorized call

## Automated checks

| Command             | Result                        |
| ------------------- | ----------------------------- |
| `pnpm lint`         | PASS                          |
| `pnpm typecheck`    | PASS                          |
| `pnpm test`         | PASS — 14 files, 40 tests     |
| `pnpm build`        | PASS — six workspace projects |
| `pnpm format:check` | PASS                          |
| `pnpm secret:scan`  | PASS                          |
| `git diff --check`  | PASS                          |

`pnpm db:validate` is not applicable because this vertical spike has no Prisma/PostgreSQL schema.

## Contract evidence

- `codexmanager-local` is distinct from official `openai` and exports a fixed
  `http://127.0.0.1:48760/v1` destination.
- The credential is read only from `CODEX_MANAGER_API_KEY`; configuration output contains only
  configured state or a non-secret reason.
- Contract tests verify two image inputs, Responses structured output, `store:false`, explicit
  `stream:false`, JSON and SSE response parsing, requested and resolved model provenance, usage
  parsing, exact duration, and one request only.
- Missing credentials skip the network probe. Unreachable health, invalid output, transport
  failure, incomplete SSE, and unregistered provider/model requests fail closed without repair or
  fallback.
- Secret redaction recognizes credential-named object fields, and the repository secret scan
  passes.

## Local zero-call dry-run

The technical request was processed before LIVE verification. Observed facts:

- `director.providerId`: `codexmanager-local`
- `director.modelId`: `gpt-5.4`
- `director.destination`: `loopback-local`
- `director.readiness.configured`: `true`
- ComfyUI workflow readiness: `true`
- authorization scope hash:
  `791dadc56d26a766b01641bfe989043ac298753af541a81ce14d2461cdc289e1`
- `providerCalls`: `0`
- `generationCalls`: `0`

The readiness check called only the local `/health` endpoint and did not create a model response or
consume an authorization.

## Separately authorized LIVE compatibility evidence

Each attempt used a new exact one-call Director grant. Failed grants were not refunded, and no
request was automatically retried or sent to official OpenAI.

1. Request-log ID `15848` used the unsupported official snapshot name
   `gpt-5.4-2026-03-05`; CodexManager returned HTTP 404 `model_not_found`.
2. Request-log ID `15850` used the supported `gpt-5.4` alias. CodexManager completed it with HTTP
   200, but the initial SDK adapter rejected the gateway's SSE body while expecting JSON.
3. After adding explicit `stream:false` plus JSON/SSE parsing, newly approved grant
   `3a7da8cf-4b6e-4a4e-8738-4c8697495e92` made exactly one request. Request-log ID `15851` records
   `POST /v1/responses`, model `gpt-5.4`, HTTP 200, and 8732 ms. The adapter returned response ID
   `resp_03ae30e81ceb61fd016a8a750d53c087d1a897e9c9fb5b144c`, status `completed`, valid
   `ShotSpecification@1.0.0`, exact duration `2.0625`, and usage of 443 input, 397 output, and 840
   total tokens.

The successful final response reported `responseTransport: json`; SSE contract coverage remains to
handle gateways that still stream despite a non-streaming request. CodexManager request logs prove
the local route was used. No ComfyUI submission occurred in any compatibility attempt.

## Subsequent authorized vertical-spike evidence

After compatibility verification, the owner selected real character and scene assets and approved
scope `76ce57044ecdfdd47dc711233882b8ae5a26ba587c5d5a758294c0ebe0f36818` for exactly one
additional CodexManager Director call and one ComfyUI submission.

- Run `6255990b-2870-4762-9a32-faa0a1728002` consumed both grants once.
- The Director returned response `resp_005a96195957c122016a8a76d30bb487d1b4c25898f77289ad`,
  valid structured output, exact duration `2.0625`, and 4,562 total tokens.
- ComfyUI prompt `5f21fc8d-c00e-45f2-b962-1e8cd9deb3e9` executed once in about 304 seconds.
- The local 120-second polling limit expired before ComfyUI finished. No retry or resubmission was
  made; query-only reconciliation retained the same completed prompt.
- The retained artifact is H.264, 512x288, 16 fps, 2.0625 seconds, silent, 302,355 bytes, with
  SHA-256 `86de7ccb94a84a5e051b6ce2cbc3d77db35a8b5304df5583a2e23421fefe03e3`.
- Technical status is `COMPLETED` with a valid evidence chain. Owner review
  `8fec9ea6-a23b-4ee3-8b54-413259478f96` recorded `FAIL` for severe color blocks, stretching, and
  structural collapse in the middle and final frames. The productization gate is closed as
  `OWNER_FAIL`.

The polling-limit recovery now records future exhaustion as `AMBIGUOUS` and accepts legacy
`FAILED/POLL_LIMIT` records for reconciliation. Its generation port cannot submit, and regression
coverage verifies that reconciliation never creates a second submission.
