# Phase 0A-0.5 Discovery and Readiness

**Observed**: 2026-08-23

**CodexManager Director calls**: 4 separately authorized calls

**Official OpenAI calls**: 0

**ComfyUI generation submissions**: 1 separately authorized submission

**Default Creative AI test Provider**: `codexmanager-local`

## Capability matrix

| Capability                     | Evidence                                  | Status               |
| ------------------------------ | ----------------------------------------- | -------------------- |
| Existing ComfyUI MCP           | No configured tools/resources/templates   | Unavailable          |
| Project-owned MCP bridge       | Eight stdio tools; fake contracts pass    | Implemented          |
| Submit                         | Local `POST /prompt`; returns `prompt_id` | Confirmed API        |
| Status                         | Local `GET /api/jobs/{job_id}`            | Confirmed API        |
| Artifact metadata              | Terminal job `outputs`                    | Confirmed API        |
| Artifact bytes                 | Local `GET /view`                         | Confirmed API        |
| Queue                          | Local `GET /queue`                        | Confirmed API        |
| Targeted cancel                | Local `POST /api/jobs/{job_id}/cancel`    | Confirmed API        |
| Input upload                   | Local `POST /upload/image`                | Confirmed API        |
| WebSocket progress             | Local `/ws`                               | Confirmed, optional  |
| Reference-conditioned workflow | Hash-locked dual-reference Wan2.2 graph   | Ready                |
| Usable video model weights     | Three official artifacts; SHA verified    | Ready                |
| Duration/resolution/fps limits | 2.0625 s / 512x288 / 16 fps               | Fixed pilot profile  |
| Character/scene fidelity       | Real shot plus owner review               | FAIL — severe drift  |
| Audio                          | Outside vertical spike                    | Unsupported by scope |

## Local inventory

- ComfyUI: `/Users/tj/Applications/ComfyUI-LadyLala`
- Version/commit: `v0.33.2` / `7cee3ce`
- Current runtime: running on `127.0.0.1:8188`, Apple MPS, 32 GB unified memory
- Base video output node: `SaveVideo` source present
- Custom node source: `ComfyUI_InstantID` present
- Models: official Wan2.2 TI2V 5B diffusion model, VAE, and UMT5 encoder installed in standard
  directories and verified against their published Hugging Face LFS SHA-256 values
- Workflow: `wan22-ti2v-5b-dual-reference` version `1.0.0`, SHA-256
  `755d1bb9babb6c218eafa02c8bc7005c44232135e81d47b85f8de78e76c815a0`
- Workflow input path: scene scale plus alpha-aware character composite produces the single Wan2.2
  start frame; positive prompt is an independent allowlisted binding
- Workflow output: node `20`, `images` media key, H.264 MP4
- Output: one retained H.264 MP4, 512x288, 16 fps, 2.0625 seconds, no audio; SHA-256
  `86de7ccb94a84a5e051b6ce2cbc3d77db35a8b5304df5583a2e23421fefe03e3`
- CodexManager local gateway: `127.0.0.1:48760`, fixed loopback registration; `/health` is reachable
  and model endpoints require the environment-only platform key
- Runtime warning: OpenCV and PyAV bundle different FFmpeg dynamic libraries. Startup and prompt
  validation succeed, but the warning remains a risk to observe during the one real run.

## Verified model artifacts

| Model inventory path                                   |         Bytes | SHA-256                                                            |
| ------------------------------------------------------ | ------------: | ------------------------------------------------------------------ |
| `diffusion_models/wan2.2_ti2v_5B_fp16.safetensors`     | 9,999,658,848 | `456f901338bd9eadbded3828b819109a9b68e8a525ca5cf8d0049a69fcfeca1e` |
| `vae/wan2.2_vae.safetensors`                           | 1,409,400,960 | `e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156` |
| `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 6,735,906,897 | `c3355d30191f1f066b26d93fba017ae9809dce6c627dda5f6a66eaa651204f68` |

## Phase decision

Phase 0A documented the missing external MCP. Phase 0B implemented and fake-contract-tested the
project-owned bridge. Phase 0.5 now has a locally running service, verified official model files,
a registered dual-reference workflow, and a successful zero-call dry-run.

Current `pnpm spike discover` reports `ready: true`, an empty blocker list, matching workflow hash,
no missing nodes/models/bindings, `providerCalls: 0`, and `generationCalls: 0`. A technical fixture
dry-run identified two distinct immutable input hashes and the fixed 2.0625-second generation
profile. Two local input uploads were separately used for no-queue native prompt validation;
ComfyUI returned `valid: true`, output node `20`, and no node errors.

The exact-scope one-shot run completed with `codexmanager-local` and one ComfyUI submission. The
local 120-second polling limit expired while the same prompt continued, so query-only
reconciliation retained and validated that existing artifact without resubmission. Run
`6255990b-2870-4762-9a32-faa0a1728002` has a valid technical chain and an append-only owner `FAIL`:
the first frame was recognizable, but the middle and final frames showed severe color blocks,
stretching, and structural collapse. The productization gate remains closed as `OWNER_FAIL`.
