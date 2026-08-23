# Implementation Plan: CodexManager Local Test Provider

**Branch**: `codex/phase-0-discovery` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-codexmanager-local-provider/spec.md`

## Summary

Add a controlled `codexmanager-local` implementation of the existing provider-neutral Director
contract, using the fixed loopback CodexManager Responses-compatible gateway and its own
environment-only credential. Make it the default for spike dry-run and LIVE Director wiring while
preserving the official OpenAI adapter as an explicit alternative. Tests use injected fake clients;
no real model call is authorized by this feature.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22

**Primary Dependencies**: OpenAI JavaScript SDK 7.5, Zod 4, Commander, existing workspace packages

**Storage**: Existing append-only local spike evidence; no new database or secret persistence

**Testing**: Vitest contract/integration tests, ESLint, TypeScript, Prettier, secret scan

**Target Platform**: Local macOS single-user runtime with CodexManager on loopback

**Project Type**: pnpm workspace library plus CLI

**Performance Goals**: Configuration/readiness validation completes within a bounded 2-second
timeout; dry-run makes zero model calls

**Constraints**: Fixed `http://127.0.0.1:48760/v1`; environment-only key; Responses API; two image
inputs; strict structured output; no fallback, repair, retry, or arbitrary URL

**Scale/Scope**: One new Creative AI provider, one Director flow, CLI dry-run/run integration, and
contract tests

## Constitution Check

### Before research

- **I — Prove the Video Path First**: PASS. This removes the Director credential blocker without
  expanding beyond the single-shot vertical spike.
- **II — Separate Creative Intelligence from Generation**: PASS. The new class implements
  `AiModelProvider`; ComfyUI workflow details do not enter the adapter.
- **III — Provider-Neutral Contracts and Honest Capabilities**: PASS. The local gateway has its own
  provider identity and verified capability claims; the user explicitly promoted it to the active
  experiment.
- **IV — Zero-Call Defaults and Bounded Live Execution**: PASS. Dry-run remains zero-call and LIVE
  retains the existing one-call grant.
- **V — Durable Provenance and Verification**: PASS. Provider/model/response provenance remains
  append-only and fake-client contract tests cover the wire translation.
- **MVP arbitrary endpoints exclusion**: PASS. The endpoint is a fixed application-controlled
  loopback constant, not user input.

### After design

PASS with the same findings. The contract fixes provider identity and destination classification,
the data model contains no secret value, and quickstart validation separates gateway readiness
from paid model execution.

## Project Structure

### Documentation (this feature)

```text
specs/002-codexmanager-local-provider/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── provider-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/ai-providers/src/
├── codexmanager-local-provider.ts
├── openai-provider.ts
├── provider.ts
└── index.ts

packages/spike-core/src/
├── config.ts
└── preflight.ts

apps/spike-cli/src/index.ts

tests/
├── contract/codexmanager-local-provider.test.ts
├── integration/dry-run.test.ts
└── unit/security.test.ts
```

**Structure Decision**: Extend the existing provider package and spike CLI. Do not add another
service, database, arbitrary endpoint registry, or generic relay abstraction.

## Implementation Sequence

1. Add failing contract/config/dry-run tests for the registered local provider.
2. Add fixed provider constants and a local Responses adapter using an injected client in tests.
3. Extend runtime configuration with distinct environment names and a loopback invariant.
4. Change spike dry-run scope/provenance and LIVE wiring to the local provider default.
5. Verify no fallback, no secret exposure, zero calls in dry-run, and all repository quality gates.

## Rollback

Revert the provider selection in preflight/CLI to `openai` and remove the local adapter/config
fields. Existing evidence remains valid because provider identity is stored with each run. No data
migration or secret cleanup is required because no credential is persisted.

## Complexity Tracking

No constitution violation requires justification.
