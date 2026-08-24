# Implementation Plan: DECOROLALA H3 Live Validation

**Branch**: `005-h3-live-validation` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the existing safe vertical-spike path from two to five ordered reference images for one
15-second DECOROLALA IN3725 advertisement. Add a product-specific, hash-locked H3 workflow and an
owner-approved H3 full-reference prompt, while reusing one-use authorization, MCP submission,
append-only evidence, artifact validation, and Human QA. Keep implementation and preflight at zero
calls, then stop for exact action-time confirmation before any LIVE execution.

**Revision**: After the first attempt exposed missing Partner authentication, make the minimum
supported 4-second single-shot validation workflow the sole active entry. Preserve and disable the
15-second graph. Do not generate while preparing or verifying this revision.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22
**Primary Dependencies**: Zod, Vitest, MCP SDK, existing CodexManager Local adapter, ComfyUI v0.33.2 API Nodes
**Storage**: Existing ignored immutable inputs/evidence/artifacts under `var/spike`; no database or secret storage
**Testing**: Contract/integration tests, live zero-call discovery/dry-run, FFprobe, deterministic review frames, full project checks
**Target Platform**: Local macOS, loopback ComfyUI; hosted H3 through owner-managed Comfy Credits
**Project Type**: TypeScript monorepo with CLI, core orchestration, provider adapters, and MCP bridge
**Performance Goals**: Cost-free preflight completes interactively; provider completion time is not promised
**Constraints**: Five exact hashes, fixed Image 1–5 order, 768P 9:16 24fps 15s, one submission, no retry/fallback/2K, no secrets/payment data, explicit Human QA
**Scale/Scope**: One owner, one ad request, five images, one workflow, at most one Director request and one H3 submission

## Constitution Check

### Before research

| Principle                                          | Response                                                                                                | Result |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| I. Prove the Video Path First                      | Completes the single-shot Phase 0.5 gate before broad product work.                                     | Pass   |
| II. Separate Creative Intelligence from Generation | The approved structured prompt and generation spec stay separate from H3 graph bindings.                | Pass   |
| III. Provider-Neutral Contracts                    | Asset roles and run provenance are generalized; H3-specific graph data remains in the workflow adapter. | Pass   |
| IV. Zero-Call Defaults                             | All implementation/preflight is zero-call; LIVE remains exact-scope and single-attempt.                 | Pass   |
| V. Durable Provenance                              | Five input hashes, prompt, workflow hash, task, artifact, and review are append-only.                   | Pass   |

### After design

PASS. The design extends existing bounded interfaces without adding arbitrary endpoints, fallback,
automatic retry, credential storage, or a second generation path. Historical two-reference and Wan
evidence remains intact.

## Project Structure

```text
apps/
├── comfyui-mcp/src/server.ts
└── spike-cli/src/{index.ts,mcp-client.ts}

packages/
├── contracts/src/index.ts
├── comfyui-bridge/src/{workflow-registry.ts,execution.ts}
└── spike-core/src/{assets.ts,preflight.ts}

workflows/
├── minimax-h3-reference-to-video.api.json
├── minimax-h3-decorolala-ad-15s-v1.api.json
├── minimax-h3-decorolala-validation-4s-v1.api.json
└── registry.json

tests/
├── contract/minimax-h3-workflow.test.ts
└── integration/{discovery.test.ts,dry-run.test.ts,live-safety.test.ts}

specs/005-h3-live-validation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── verification.md
├── contracts/h3-live-attempt.md
├── checklists/requirements.md
└── tasks.md
```

**Structure Decision**: Generalize only the existing asset/binding/staging contracts needed for
five references. Keep the product-specific prompt and graph in versioned workflow/spec artifacts.
Do not add UI, database, queue, or a direct MiniMax integration before the quality gate.

## Implementation Sequence

1. Freeze source-task facts, five paths/hashes, H3 full-reference prompt, and fixed profile.
2. Extend contracts, ingestion, provenance, workflow materialization, MCP staging, and CLI assembly
   from two to the five registered advertisement roles while retaining legacy requests.
3. Add the five-reference graph and contract/integration coverage; disable but preserve the old
   two-reference executable entry.
4. Run the full verification suite and exact real-asset zero-call dry-run.
5. Present the exact scope/cost uncertainty and pause for action-time owner confirmation.
6. If confirmed, create fresh grants and execute at most once; retain/inspect the artifact.
7. Record owner `PASS`, `FAIL`, or `RISK_ACCEPTED`; only the first or third opens Phase 1.

## Rollback and Failure Handling

- Before LIVE, code/docs/workflow changes are locally reversible and have no provider state.
- After grant consumption or a durable task ID, evidence is immutable and query-only
  reconciliation is the only allowed recovery.
- Failure or Human QA `FAIL` closes the gate and does not authorize a new prompt or submission.

## Complexity Tracking

No constitution violations require justification.
