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
| `pnpm test`           | PASS - 13 files, 31 tests                   |
| `pnpm build`          | PASS - six workspace projects               |
| `pnpm format:check`   | PASS                                        |
| `pnpm secret:scan`    | PASS                                        |
| `git diff --check`    | PASS                                        |
| `pnpm spike discover` | PASS - ready workflow, `generationCalls: 0` |

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
- The registered Wan2.2 workflow is hash locked, routes both inputs into the composed start frame,
  contains no API/network node, and fixes one H.264 MP4 output.
- The official 9,999,658,848-byte diffusion model, 1,409,400,960-byte VAE, and
  6,735,906,897-byte text encoder match their published Hugging Face LFS SHA-256 values.
- Live local discovery reports `ready: true`, no missing models/nodes/bindings, matching workflow
  hash, empty queue and blockers, `providerCalls: 0`, and `generationCalls: 0`.
- The technical fixture dry-run records distinct character/scene hashes, the fixed OpenAI snapshot,
  2.0625-second 512x288/16 fps profile, expected MCP invocation, and zero provider calls.
- Two fixture inputs were uploaded through the MCP staging tool solely for validation. ComfyUI's
  native no-queue prompt validator returned `valid: true`, output node `20`, no node errors, and
  `generationCalls: 0`.
- The local runtime warns that OpenCV and PyAV bundle different FFmpeg dynamic libraries. Startup,
  readiness, input staging, and prompt validation pass; the warning remains under observation for
  the one real execution.
- The final Spec Kit convergence pass found no remaining buildable gaps: all 55 tasks are complete,
  and the separately authorized real attempt remains an explicit execution gate rather than an
  implementation task.

## Remaining real-world gate

A real Phase 0.5 result is not claimed. Workflow, model, runtime, and technical dry-run readiness
are complete. Execution now requires owner-selected character and scene images, an environment-only
OpenAI API key, review of the exact asset dry-run, and two new one-call authorizations. After that
single attempt, the retained MP4 still requires explicit owner PASS/FAIL review.
