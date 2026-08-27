# Data Model: Remote H3 Reference Capability Pack

## Pack profile

The existing immutable Capability Pack keeps its versioned identity, model identity, runtime target, node allowlist, intent modes, and bounded envelope. The H3 profile is valid only with:

| Fact                  | Required value                                                  |
| --------------------- | --------------------------------------------------------------- |
| Compiler profile      | `h3-reference-video-v1`                                         |
| Model node            | `MinimaxHailuo03ReferenceNode`                                  |
| Remote model selector | `MiniMax H3`                                                    |
| Loader                | `LoadImage`                                                     |
| Output                | `SaveVideo` with server-owned MP4/auto codec policy             |
| Allowed node classes  | sorted `LoadImage`, `MinimaxHailuo03ReferenceNode`, `SaveVideo` |

## Compilation context

`GraphIntent` holds image asset IDs, prompt, duration, ratio, resolution, and seed. The server-only compilation context holds the corresponding ordered staged input names. Their lengths must match exactly; their names are opaque safe ComfyUI staged names, never filesystem paths.

## Runtime dynamic option

The normalized runtime catalog adds optional safe dynamic options to a selector input. Each option has a scalar key and a bounded flattened list of required/optional nested inputs, such as `model.prompt` and `model.reference_images.image_1`. The validator selects these fields only when the graph uses that selector value.
