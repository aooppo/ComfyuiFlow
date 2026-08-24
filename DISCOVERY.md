# Phase 0A–0.5 Discovery and Readiness

**Original Wan evidence observed**: 2026-08-23

**MiniMax H3 migration verified**: 2026-08-24

**Five-reference DECOROLALA readiness verified**: 2026-08-24

**CodexManager Director calls**: 5 separately authorized calls

**Official OpenAI calls**: 0

**ComfyUI generation submissions**: 1 historical Wan submission; 1 authorized H3 local submission
that failed at Partner Node authentication before provider generation

## Current capability matrix

| Capability                 | Evidence                                                           | Status                  |
| -------------------------- | ------------------------------------------------------------------ | ----------------------- |
| Existing ComfyUI MCP       | No configured external tools/resources/templates                   | Unavailable             |
| Project-owned MCP bridge   | Eight stdio tools; fake contracts pass                             | Implemented             |
| Local ComfyUI endpoint     | `127.0.0.1:8188`                                                   | Confirmed               |
| Partner Node runtime       | API Nodes enabled in ComfyUI v0.33.2                               | Confirmed               |
| H3 Reference-to-Video node | `MinimaxHailuo03ReferenceNode` from live `object_info`             | Confirmed               |
| H3 First/Last-Frame node   | `MinimaxHailuo03FirstLastFrameNode` from live `object_info`        | Confirmed               |
| Saved H3 video output      | Core `SaveVideo` accepts `VIDEO` and emits `images` artifact media | Confirmed               |
| Active project workflow    | Hash-locked `minimax-h3-decorolala-validation-4s-v1`               | Credential blocked      |
| Local H3/Wan weights       | No active workflow dependency                                      | Removed after readiness |
| Paid H3 execution          | One exact confirmed attempt; Partner Node returned unauthorized    | Failed; no retry        |

## H3 workflow facts

- Model: `MiniMax H3` through the ComfyUI Partner Node, not a local model download.
- Node capability: live `object_info` exposes up to nine ordered image references; the active graph
  deliberately allows only the five reviewed roles.
- Inputs: scene `Image 1`, product `Image 2`, full-body character `Image 3`, face identity
  `Image 4`, and rear/side identity `Image 5`.
- Profile: fixed 768P, 9:16, 24fps, 4 seconds, watermark off. The installed H3 node rejects the
  owner's requested 2 seconds because its live duration range is 4–15 seconds.
- Prompt: validated H3 full-reference sections with five timed shots, one red-wine glass, no
  narration/dialogue/generated text/logo, continuous ambience, and instrumental music.
- Output: `VIDEO` is passed to `SaveVideo`, yielding one retained MP4 on a future authorized run.
- Account boundary: the Partner Node credential and Comfy Credits are owned by the local ComfyUI
  account. The direct bridge accepts an environment-only API key or short-lived auth token, reports
  only configured/missing, and never records the value in workflow, scope, evidence, or output.
- Live result: run `f0344cf0-aa79-42ba-8711-f5eba558452b` created local prompt
  `3207e7d3-2a90-4789-8200-161e0305270b`, then failed while uploading inputs because the direct
  `/prompt` payload had no Partner credential. No retry or replacement submission occurred.
- Cost-minimized revision: the 15-second graph is preserved but disabled. The active four-second
  single-shot validation has a local price-badge estimate of `$0.5148` and has not been submitted.

## Retired Wan inventory

The following local files were verified before deletion. They were the only runtime-model deletion
targets, totaling 18,144,966,705 bytes:

| Former path                                            |         Bytes | Verified SHA-256                                                   |
| ------------------------------------------------------ | ------------: | ------------------------------------------------------------------ |
| `diffusion_models/wan2.2_ti2v_5B_fp16.safetensors`     | 9,999,658,848 | `456f901338bd9eadbded3828b819109a9b68e8a525ca5cf8d0049a69fcfeca1e` |
| `vae/wan2.2_vae.safetensors`                           | 1,409,400,960 | `e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156` |
| `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 6,735,906,897 | `c3355d30191f1f066b26d93fba017ae9809dce6c627dda5f6a66eaa651204f68` |

The failed Wan output and review record remain historical evidence. They do not establish H3
quality, and no H3 generation claim is made until one separately authorized task is retained and
reviewed.
