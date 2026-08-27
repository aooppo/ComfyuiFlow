# Implementation Plan: Per-Graph Zero-Call Technical Evidence

**Branch**: `codex/018-zero-call-graph-evidence` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

## Summary

Add a server-owned, zero-call preflight path for each persisted `MaterializedGraphSnapshot`. It reads ComfyUI runtime facts and a scoped node catalog, validates the exact graph in memory, appends immutable technical evidence, and gates batch creation and submission on a matching PASS record. It never posts `/prompt` during validation.

## Technical Context

**Language/Version**: TypeScript 5.8 / Node.js 22
**Primary Dependencies**: pnpm workspace, Zod, Prisma, MCP SDK
**Storage**: PostgreSQL / Prisma plus existing append-only SQL triggers
**Testing**: Vitest workspace tests and Prisma schema validation
**Target Platform**: local single-user Next.js web/API, worker, and ComfyUI MCP bridge
**Project Type**: TypeScript modular monolith
**Performance Goals**: bounded validation of one persisted graph and its declared node catalog; no runtime mutation
**Constraints**: server-owned graphs only; no credentials in evidence; no `/prompt`, uploads, staging, authorization consumption, or retry from preflight; fail closed
**Scale/Scope**: one canonical dynamic capability chain and one evidence record per preflight result

## Constitution Check

| Principle                          | Result | Evidence                                                                                                               |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| I. One Dynamic Capability Mainline | PASS   | Evidence binds the canonical frozen graph SHA and RuntimeContract digest; no provider/workflow fallback is introduced. |
| II. Separate Creative Intelligence | PASS   | The server validates persisted graph snapshots; no browser or planner raw graph crosses the execution boundary.        |
| III. Honest Capabilities           | PASS   | Node catalog, runtime fingerprint, validator identity, and safe diagnostic facts are captured.                         |
| IV. Zero-Call Defaults             | PASS   | Preflight uses only GET endpoints and does not authorize or submit generation.                                         |
| V. Durable Provenance              | PASS   | Evidence is append-only and batch/submission gates use persisted matching PASS evidence.                               |

Re-check after implementation: required; any route must remain server-owned and pricing/authorization remain independent.

## Design

### Validation flow

```text
Persisted MaterializedGraphSnapshot
  -> load RuntimeContract and allowed node classes
  -> GET /system_stats + GET /object_info
  -> normalize scoped Node Catalog + runtime fingerprint
  -> validate frozen graph in memory
  -> append PASS/FAIL GraphValidationEvidence
  -> return safe evidence view
```

The graph validator checks the frozen SHA, allowed node classes, inputs and safe literal values, required fields, options/ranges, source/output links and compatible types, cycle/orphan conditions, and declared output. The runtime adapter must expose only a safe fingerprint, not raw system data.

### Enforcement flow

```text
batch creation -> every target graph has matching persisted PASS evidence -> create authorization/batch/attempt
submission -> reload evidence -> recapture scoped catalog -> require evidence catalog fingerprint match -> stage -> POST /prompt
```

No validation result can itself grant live authority. Existing action-time authorization, prices, expiry, and consumption checks remain prerequisites.

### Persistence

Add enum `GraphValidationOutcome` and append-only `GraphValidationEvidence`. A record belongs to a `MaterializedGraphSnapshot` and stores graph SHA, RuntimeContract digest, runtime and catalog SHA-256 fingerprints, validator reference/version, PASS/FAIL outcome, safe JSON diagnostics, and timestamp. It has an append-only trigger and no update/delete API.

### API/MCP boundary

The MCP bridge gets a server-owned `preflight_mainline_graph` operation that loads the graph by snapshot id from PostgreSQL and calls a service. It returns only a safe evidence view. The web API may read evidence or request the server operation, but accepts only snapshot identity, never a graph body or claimed outcome.

## Project Structure

```text
packages/comfyui-bridge/src/
├── comfyui-client.ts                 # read-only runtime facts
├── node-catalog.ts                   # scoped normalized catalog
├── zero-call-graph-validator.ts      # static graph validation
├── graph-preflight.ts                # runtime + validator orchestration
└── execution-plan.ts                 # evidence catalog recheck before submission

packages/project-core/
├── prisma/schema.prisma
├── prisma/migrations/202608270002_zero_call_graph_evidence/migration.sql
└── src/
    ├── graph-validation-evidence-service.ts
    ├── generation-lifecycle-service.ts
    └── generation-mainline-store.ts

apps/comfyui-mcp/src/
├── server.ts
├── index.ts
└── graph-preflight-store.ts

packages/*/test/ and apps/comfyui-mcp/test/
```

**Structure Decision**: Extend the existing canonical mainline packages; do not recreate historical Workflow Agent or generic evidence paths.

## Complexity Tracking

No constitution violations or new service boundaries are required.
