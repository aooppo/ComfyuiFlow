# Verification: Wan2.2 Stability Recovery

## Zero-call boundary

- Candidate: `wan22-ti2v-5b-dual-reference-stable@2.0.0`
- Workflow SHA-256: `21c81e245f453e04939a74cb5ac5ce1adf377301b5685d47b4b7223e4e60bf7d`
- Failed v1 SHA-256 preserved: `755d1bb9babb6c218eafa02c8bc7005c44232135e81d47b85f8de78e76c815a0`
- Real Director calls during recovery validation: 0
- Real ComfyUI submissions during recovery validation: 0

## Evidence

**Date**: 2026-08-24

| Check                              | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `pnpm lint`                        | PASS                                                                  |
| `pnpm typecheck`                   | PASS                                                                  |
| `pnpm test`                        | PASS - 14 files, 46 tests                                             |
| `pnpm build`                       | PASS - six workspace projects                                         |
| `pnpm format:check`                | PASS                                                                  |
| `pnpm secret:scan`                 | PASS                                                                  |
| `git diff --check`                 | PASS                                                                  |
| Requirements checklist             | PASS - 16/16 complete                                                 |
| Live discovery                     | PASS - enabled v2 ready, queue empty, no blockers, generation calls 0 |
| Native ComfyUI no-queue validation | PASS - `valid: true`, output `20`, no node errors                     |
| Exact asset dry-run                | PASS - provider calls 0, workflow ready                               |

The native validator repeated the pre-existing OpenCV/PyAV duplicate FFmpeg library warning and a
non-required `nodes_replacements.py` import warning. Neither affected the reviewed core-node graph;
validation returned no workflow node errors. No prompt was enqueued.

Exact dry-run authorization scope:

```text
f0a299fccbf90b82a0f1160eafd68b55c6b281492481b32b30216470d6fac376
```

The scope binds the two supplied asset hashes, `codexmanager-local` / `gpt-5.4`, Director template
`director-one-shot-v1`, workflow v2, and workflow SHA-256
`21c81e245f453e04939a74cb5ac5ce1adf377301b5685d47b4b7223e4e60bf7d`.

## Separately authorized execution

The owner authorized exact scope
`f0a299fccbf90b82a0f1160eafd68b55c6b281492481b32b30216470d6fac376` for at most one
`codexmanager-local` Director call and one ComfyUI generation submission.

| Evidence              | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Run                   | `4d8e35ce-4767-4e10-88e8-595f71369e6b`                             |
| Director calls        | 1                                                                  |
| ComfyUI submissions   | 1                                                                  |
| Prompt                | `9bde842b-8ba5-4ab8-a644-49325a328d38`                             |
| Artifact              | `772b7ed3-1258-474d-8083-aab2598e89b0`                             |
| Artifact SHA-256      | `1a339e844600d408e84c66caca256226a160a2ce25041277a170c1d646476ce7` |
| Media                 | H.264, 512x288, 16 fps, 33 frames, 2.0625 seconds, no audio        |
| Contact sheet SHA-256 | `d1630da37bde6c0ec97f37f565db50521b00fc681f7cc5b65675c6c7858f9b6c` |
| Technical status      | `COMPLETED`, hash chain valid                                      |
| Product gate          | Closed, `REVIEW_REQUIRED`                                          |

ComfyUI completed all 20 sampling steps without a runtime error. Technical visual inspection of
the deterministic first/middle/final contact sheet found a clear first frame followed by severe
neon color blocks, horizontal stretching, and structural collapse in the middle and final frames.
The stable v2 candidate therefore does not meet the intended quality target. This is technical
inspection evidence only; the append-only owner Human QA decision remains pending and no retry was
started.
