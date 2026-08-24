# Implementation Plan: Replace Wan with MiniMax H3 Partner Node

**Branch**: `004-minimax-h3-partner` | **Date**: 2026-08-24 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`/specs/004-minimax-h3-partner/spec.md`

## Summary

Replace the local Wan2.2 generation workflow with one reviewed, hash-locked ComfyUI MiniMax H3
Reference-to-Video Partner Node workflow. It uses the existing two immutable image roles as ordered
H3 reference images, runs at a conservative 768P vertical five-second profile, and saves the
returned video through `SaveVideo`. Keep all paid execution behind the existing one-use authorization
boundary. After a zero-call H3 readiness test passes, remove only the three verified Wan weight files
and retire the Wan workflow JSON from the executable registry.

## Technical Context

**Language/Version**: TypeScript 5.9; Python only inside the existing local ComfyUI installation

**Primary Dependencies**: Zod contracts, Vitest, the application-owned ComfyUI HTTP/MCP bridge,
ComfyUI v0.33.2 API Nodes

**Storage**: Existing local immutable input/artifact storage; ComfyUI output directory; no new
database or secret storage

**Testing**: Vitest contract/integration tests, local ComfyUI `object_info` readiness inspection,
format/lint/type/build/secret scan

**Target Platform**: Local macOS ComfyUI accessed only over `127.0.0.1:8188`

**Project Type**: TypeScript monorepo with an MCP bridge and CLI

**Performance Goals**: Dry-run and readiness remain zero-call. The default paid candidate is one
five-second 768P H3 task; provider-side wait time is not a local latency promise.

**Constraints**: Never store a Comfy account token, key, or credit balance in project files. Never
submit, retry, or charge a task during implementation. H3 reference order is character then scene;
the prompt names them `Image 1` and `Image 2`. No model weights may be deleted until H3 node and
workflow readiness are verified.

**Scale/Scope**: One single-user local execution path, one active workflow, exactly two image
references, 768P 9:16 at 24fps, duration 4–15 seconds (default 5). Context IR, reference video,
reference audio, 2K regeneration, cloud GPU, and direct MiniMax API integration are excluded.

## Constitution Check

| Principle                                          | Plan response                                                                                                | Result |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| I. Prove the Video Path First                      | Preserve one small H3 reference path; a live task remains separately authorized.                             | Pass   |
| II. Separate Creative Intelligence from Generation | The director still supplies only the allowlisted prompt binding; it knows no node details.                   | Pass   |
| III. Provider-Neutral Contracts                    | The workflow registry records only verified H3 Partner Node capabilities; no fallback is added.              | Pass   |
| IV. Zero-Call Defaults                             | Tests only inspect/readiness-check. Live H3 still consumes a grant before one network attempt.               | Pass   |
| V. Durable Provenance                              | Inputs, authorization, job and retained artifact behavior remain unchanged. Historical Wan evidence remains. | Pass   |

## Project Structure

```text
workflows/
├── minimax-h3-reference-to-video.api.json
├── registry.json
└── README.md

packages/contracts/src/index.ts
packages/comfyui-bridge/src/
├── workflow-registry.ts
├── readiness.ts
└── execution.ts

tests/
├── contract/minimax-h3-workflow.test.ts
├── integration/dry-run.test.ts
└── integration/discovery.test.ts

specs/004-minimax-h3-partner/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/minimax-h3-workflow.md
└── tasks.md
```

**Structure Decision**: Reuse the current registry, bridge, authorization, and artifact-retention
layers. This is a workflow migration, not a new provider SDK or service.

## Implementation Phases

1. Add the H3 API workflow and hash-locked registry entry; remove executable Wan entries.
2. Replace Wan-specific contract/integration coverage with H3 graph, binding, and zero-local-model
   readiness coverage.
3. Update user-facing documentation and discovery evidence, preserving historic Wan records only in
   existing feature specifications.
4. Run the H3 readiness check with zero generation calls; only then delete the three exact Wan files.
5. Run the full project verification suite and record that no paid H3 task was submitted.

## Complexity Tracking

No constitution violations require justification.
