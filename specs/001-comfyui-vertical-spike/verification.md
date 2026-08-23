# Verification Evidence

**Date**: 2026-08-23

**Branch**: `codex/phase-0-discovery`

**OpenAI calls**: 0

**Real ComfyUI generation submissions**: 0

## Final automated checks

| Command               | Result                                      |
| --------------------- | ------------------------------------------- |
| `pnpm lint`           | PASS                                        |
| `pnpm typecheck`      | PASS                                        |
| `pnpm test`           | PASS - 12 files, 28 tests                   |
| `pnpm build`          | PASS - six workspace projects               |
| `pnpm format:check`   | PASS                                        |
| `pnpm secret:scan`    | PASS                                        |
| `git diff --check`    | PASS                                        |
| `pnpm spike discover` | PASS - empty registry, `generationCalls: 0` |

`pnpm db:validate` is not applicable to this feasibility spike because PostgreSQL/Prisma is gated
until product Phase 1.

## Verified boundaries

- Real local source inspection confirmed ComfyUI submit/status/artifact/queue/cancel/upload routes.
- Fake HTTP plus in-memory MCP tests verified the bridge contract and one-submit limit.
- Fake OpenAI tests verified the Responses structured-output request, fixed model snapshot,
  two image inputs, `store: false`, invalid-output failure, and no repair/fallback request.
- A deterministic local FFmpeg fixture was verified by FFprobe as H.264, 160x96, 24 fps, 0.5 s,
  silent video.
- Grant reuse, LIVE-disabled submit, ambiguous submit, append-only review, and productization-gate
  behavior are covered by automated tests.
- Director authorization/response failure, status transport failure, duplicate assets, artifact
  validation failure, and query-only reconciliation are covered by automated tests.
- The actual local registry is empty. Discovery reports `NO_REGISTERED_WORKFLOW`,
  `VIDEO_MODEL_UNVERIFIED`, and `COMFYUI_UNREACHABLE` with zero Provider calls and zero generation
  submissions.
- Final Spec Kit convergence found no remaining implementation gaps against FR-001 through FR-020,
  SC-001 through SC-007, the user-story acceptance scenarios, plan decisions, or Constitution.

## Remaining real-world gate

A real Phase 0.5 result is not claimed. It requires an owner-reviewed reference-conditioned API
workflow, exact model weights, a running local ComfyUI, one character image, one scene image, a
reviewed zero-call dry-run, and two new one-call authorizations. After that one attempt, the retained
MP4 still requires explicit owner PASS/FAIL review.
