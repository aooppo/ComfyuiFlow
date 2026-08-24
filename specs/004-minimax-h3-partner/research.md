# Research: MiniMax H3 Partner Node Migration

## R-001: Use the installed H3 Partner Node rather than local H3 weights

**Decision**: Use `MinimaxHailuo03ReferenceNode` in the existing local ComfyUI installation.

**Rationale**: A live `GET /object_info/MinimaxHailuo03ReferenceNode` on 2026-08-24 confirmed the
node is loaded on `127.0.0.1:8188`. It offers MiniMax H3, 768P/2K, 4–15 seconds, up to nine
reference images, a hidden Comfy account credential, and a `VIDEO` result. It runs as a Partner Node
and requires no local H3 or Wan model files.

**Alternatives considered**:

- Keep Wan2.2 locally: rejected because the owner retired it after failed visual output and it keeps
  18GB of local weights.
- Rent a GPU for open-weight H3: rejected for the current low-volume development stage because it
  introduces setup, model, and runtime compatibility work without improving the local development
  loop.
- Call MiniMax API directly: deferred; the current project already has a ComfyUI workflow boundary
  and Partner Node account/credit flow is the requested path.

## R-002: Use two ordered reference images

**Decision**: Bind the character to H3 `image_1` and the scene to `image_2`; require the prompt to
refer to them as `Image 1` and `Image 2`.

**Rationale**: The running node describes image references as ordered by connection. The project
already validates two separate, immutable character and scene assets, so its public request contract
does not need to change.

**Alternatives considered**:

- First/last-frame node: rejected because the scene image is a reference, not a mandatory target
  last frame.
- One composed start frame: rejected because it discards the two-reference capability that H3 is
  intended to provide.

## R-003: Default to a bounded 768P vertical shot

**Decision**: Default to five seconds, 768P, 9:16, and 24fps; permit only 4–15 seconds.

**Rationale**: This gives a low-cost advertising-shot preview. The installed node supports these
H3 limits. The project retains deterministic assembly outside generation for a sub-minute ad.

**Alternatives considered**:

- Default to 2K: deferred until a selected 768P shot has passed visual and audio review.
- Longer one-shot ad generation: rejected because H3 has a 15-second maximum and the product
  already treats an ad as separately planned shots.

## R-004: Use SaveVideo and the existing artifact path

**Decision**: Connect H3 `VIDEO` to ComfyUI core `SaveVideo`, declaring output node `4` and media
key `images`.

**Rationale**: Live local node inspection confirms `SaveVideo` accepts `VIDEO`, is an output node,
and emits its saved-video result under the history `images` media key. The existing bridge already
filters and retains declared output media safely.

## R-005: Delete only exact verified Wan runtime assets after readiness

**Decision**: Delete exactly these files after the zero-call H3 readiness test passes:

- `/Users/tj/Applications/ComfyUI-LadyLala/models/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors`
- `/Users/tj/Applications/ComfyUI-LadyLala/models/vae/wan2.2_vae.safetensors`
- `/Users/tj/Applications/ComfyUI-LadyLala/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`

**Rationale**: Their exact inventory total is 18,144,966,705 bytes (approximately 16.9 GiB). No
ComfyUI source, user input, output artifact, or historical specification is a deletion target.

**Alternatives considered**:

- Delete the whole ComfyUI model folder: rejected as too broad and destructive.
- Delete bundled Wan/partner-node source: rejected because it is part of the ComfyUI installation
  and unrelated to local model storage.
