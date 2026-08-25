# Implementation Plan: Real AI Director Proposal Workflow

**Branch**: `codex/014-real-ai-director` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the provider-neutral Storyboard Director additively. V1 fixed-three Fake generation remains
unchanged. V2 introduces exact approved-reference snapshots, explicit server-owned Provider profiles,
one-use authorization, a single worker attempt, immutable proposals, and explicit adoption.
CodexManager Local and official OpenAI request `gpt-5.6-terra`; Fake V2 exercises the entire path
with zero external calls.

## Technical Context

**Stack**: TypeScript 5.9, Node.js 22, Next.js 15/React 19, Prisma 6/PostgreSQL, Zod 4
**Architecture**: Existing modular monolith; contracts/adapters in packages, server rules in
`project-core`, thin Next routes, standalone single-concurrency worker
**Testing**: Vitest unit/contract/integration, serial isolated PostgreSQL, migration rehearsal,
ESLint/typecheck/Prettier, `.next-build` build, browser Fake acceptance
**Constraints**: additive schema, immutable lineage, no retry/fallback, one Provider per run, no LIVE
calls in implementation, no secrets/paths/raw responses in persisted proposals or public DTOs

## Constitution Check

| Gate                                           | Design response                                                     | Status |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Separate creative intelligence from generation | Proposal/adoption never invokes generation                          | PASS   |
| Provider-neutral contracts                     | One V2 contract, three profiles, no browser model override          | PASS   |
| Zero-call and bounded LIVE                     | Preview zero-call; authorization consumed before I/O                | PASS   |
| Durable provenance                             | References, price, attempts, hash, proposal and decisions immutable | PASS   |
| Historical compatibility                       | Additive migration and unchanged V1 Fake path                       | PASS   |

No constitution amendment is required.

## Architecture and Interfaces

1. `packages/contracts` owns strict V2 request/proposal schemas and normalization.
2. `packages/ai-providers` exposes `generateStoryboardV2`; Fake is deterministic, while Terra
   adapters issue exactly one Responses request and report the actual returned model.
3. `project-core` owns profiles, eligible references, preview hashing, confirmation, worker
   consumption, proposal persistence, decisions, and adoption.
4. Next API routes validate safe DTOs and delegate to `project-core`.
5. The Storyboard client renders the Chinese workflow and polls run state.

See [data-model.md](./data-model.md) and [contracts/director-api.md](./contracts/director-api.md).

## Migration and Rollback

- Add enums/tables/nullable relations only; never update historical rows in migration SQL.
- Existing V1 runs and `FAKE_DIRECTOR` records remain readable.
- Rollback disables UI/routes and LIVE gate while retaining immutable rows; no destructive cleanup.

## Security and Failure Semantics

- Provider/model/endpoint/credential/price registry is server-owned.
- Input aliases are safe tokens; requests contain semantic facts and image bytes, but no database IDs
  or filesystem paths.
- Authorization consumption and Attempt creation commit before adapter invocation.
- Definite failures become FAILED; uncertain states become AMBIGUOUS. Neither retries or reroutes.
- Adoption rechecks exact semantic version, active binding, READY file, and SHA-256.

## Verification

Contract tests cover V1 compatibility, V2 strictness, and one-request JSON/SSE adapters. PostgreSQL
tests cover zero-write preview, stale/concurrent confirmation, consumption, leases, immutable
proposal, reject/adopt, migration preservation, and zero-call ledgers. Browser acceptance uses Fake
V2 only. Full gates include Prisma format/validate, migration rehearsal, format, lint, typecheck,
tests, serial DB tests, `.next-build`, secret scan, and diff check.
