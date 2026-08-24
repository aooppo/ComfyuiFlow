# MiniMax H3 Partner Workflow Contract

## Workflow identity

| Property           | Value                           |
| ------------------ | ------------------------------- |
| Workflow ID        | `minimax-h3-reference-to-video` |
| Node               | `MinimaxHailuo03ReferenceNode`  |
| Model selection    | `MiniMax H3`                    |
| Output node        | `SaveVideo` (`4`)               |
| Artifact media key | `images`                        |

## Immutable graph inputs

| JSON Pointer                               | Meaning                           | Runtime source                                 |
| ------------------------------------------ | --------------------------------- | ---------------------------------------------- |
| `/1/inputs/image`                          | Character image file              | Immutable staged `CHARACTER` asset             |
| `/2/inputs/image`                          | Scene image file                  | Immutable staged `SCENE` asset                 |
| `/3/inputs/model.reference_images.image_1` | First ordered H3 image reference  | Node 1 output                                  |
| `/3/inputs/model.reference_images.image_2` | Second ordered H3 image reference | Node 2 output                                  |
| `/3/inputs/model.prompt`                   | H3 prompt                         | Director-produced, allowlisted positive prompt |
| `/3/inputs/model.duration`                 | Output duration                   | Bounded shot duration                          |

The prompt compiler must preserve the semantic labels `Image 1` for the character and `Image 2` for
the scene. No arbitrary workflow pointer is user-editable.

## Fixed profile

| Setting               | Value                     |
| --------------------- | ------------------------- |
| Resolution            | `768P`                    |
| Aspect ratio          | `9:16`                    |
| FPS                   | 24                        |
| Duration              | 4–15 seconds; default 5   |
| Watermark             | `false`                   |
| Reference image count | Exactly 2                 |
| Reference video/audio | Not part of this workflow |

## Preconditions for a live submission

1. Local ComfyUI is running on the configured loopback endpoint.
2. Its H3 Partner Node and `SaveVideo` node are discoverable.
3. The owner has logged into ComfyUI and has enough Comfy Credits.
4. The project has a fresh single-use `COMFYUI_SUBMIT` authorization that names this workflow hash
   and both input hashes.

The workflow is never used for an implementation-time probe. A missing Comfy login, credits, node,
or endpoint is a fail-closed condition.
