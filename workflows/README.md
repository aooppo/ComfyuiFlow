# Workflow Registry

The registry contains only owner-reviewed, API-format ComfyUI workflows and their hash-locked
manifests. A reachable ComfyUI server alone is not generation readiness. Model weights, secrets,
and generated media must never be committed here.

## Wan2.2 TI2V 5B dual-reference pilot

`wan22-ti2v-5b-dual-reference.api.json` uses only ComfyUI core nodes and the official Wan2.2 TI2V
5B model set. The scene is scaled to the fixed output size; the character and its alpha mask are
scaled and composited into that scene before the combined start frame reaches Wan2.2. A
transparent-background character PNG is strongly preferred; an opaque image is composited as a
192x256 rectangle.

The graph is bounded to 512x288, 33 frames at 16 fps (2.0625 seconds), 12 sampling steps, one
batch, a fixed seed, and one H.264 MP4 output. Changing any graph value requires a new workflow
version, SHA-256, dry-run, and authorization. Every revision must continue to declare its exact
required node classes and model filenames, allowlisted character/scene/prompt bindings, and one
video output node/media key. Hidden network/API nodes and arbitrary paths are not permitted.
