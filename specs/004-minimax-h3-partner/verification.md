# Verification: MiniMax H3 Partner Node Migration

**Verified**: 2026-08-24

## Scope and paid-call boundary

- MiniMax H3 Partner Node submissions: **0**
- Comfy Credit purchases: **0**
- Project provider calls: **0**
- ComfyUI generation submissions during migration: **0**
- Existing historical Wan submission: **not replayed**

## Local ComfyUI compatibility

Live loopback inspection on `127.0.0.1:8188` confirmed:

- `MinimaxHailuo03ReferenceNode` is available with `MiniMax H3`, 768P/2K, 4–15 seconds, ordered
  image references, and hidden Comfy account credentials.
- `MinimaxHailuo03FirstLastFrameNode` is available.
- `SaveVideo` is available, accepts `VIDEO`, and saves its history artifact under `images`.

The project readiness command then passed for `minimax-h3-reference-to-video`:

- enabled workflow count: 1
- graph SHA-256: `3588cc5b374846c52adbd2b0d511e3a00ae4f81cae76d77d9fa83a3e7e99bfe1`
- missing node classes: none
- missing local models: none
- binding errors: none
- blockers: none
- provider calls / generation calls: `0 / 0`

## Wan cleanup

After the successful H3 readiness result, the following exact local files were deleted:

| Former path                                                                                           |                           Bytes reclaimed |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------: |
| `/Users/tj/Applications/ComfyUI-LadyLala/models/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors`     |                             9,999,658,848 |
| `/Users/tj/Applications/ComfyUI-LadyLala/models/vae/wan2.2_vae.safetensors`                           |                             1,409,400,960 |
| `/Users/tj/Applications/ComfyUI-LadyLala/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` |                             6,735,906,897 |
| **Total**                                                                                             | **18,144,966,705 bytes (about 16.9 GiB)** |

All three exact paths were read back as absent. No other file within the ComfyUI application was a
deletion target. A second H3 readiness command passed after cleanup.

## Automated verification

All commands passed after the workflow hash was refreshed following JSON formatting:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test                  # 14 files, 45 tests passed
pnpm build
pnpm secret:scan
pnpm spike discover        # H3 ready; 0 provider / 0 generation calls
git diff --check
```

## Spec Kit convergence

The completed implementation, workflow contract, test coverage, local readiness evidence, precise
Wan cleanup, and paid-call boundary were compared with `spec.md`, `plan.md`, and `tasks.md`.
No genuinely unmet implementation task was found, so no convergence phase was appended.

## Human verification still required

No H3 video was generated, so visual quality, audio quality, Comfy-account authorization, credit
balance, and charge behavior remain unverified. Before the first paid attempt, the owner must log in
to ComfyUI, obtain credits, approve one exact H3 request, and review the retained MP4.
