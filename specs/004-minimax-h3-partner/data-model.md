# Data Model: MiniMax H3 Partner Node Migration

## Existing `WorkflowManifest` changes

| Field                      | H3 value / rule                                          |
| -------------------------- | -------------------------------------------------------- |
| `workflowId`               | `minimax-h3-reference-to-video`                          |
| `enabled`                  | `true`; no Wan workflow remains registered               |
| `requiredNodeClasses`      | `LoadImage`, `MinimaxHailuo03ReferenceNode`, `SaveVideo` |
| `requiredModels`           | Empty; hosted H3 requires no local model inventory       |
| `constraints`              | 4–15s, default 5s, 768×1344, 24fps, video output         |
| `bindings.character`       | Ordered H3 reference image 1                             |
| `bindings.scene`           | Ordered H3 reference image 2                             |
| `bindings.positivePrompt`  | H3 prompt that names `Image 1` and `Image 2`             |
| `bindings.durationSeconds` | H3 duration input                                        |
| `output`                   | `SaveVideo` node 4, `images` media key                   |

## Existing submission lifecycle

No entity schema changes are required.

```text
DRY_RUN -> READY_CHECKED -> AUTHORIZED -> SUBMITTED -> COMPLETED | FAILED | UNKNOWN
```

`READY_CHECKED` is cost-free. `AUTHORIZED` is still a one-use owner grant. The Comfy account token
and prepaid credit balance are owned by ComfyUI and never enter the project's data model.

## Retired asset set

The migration records the three absolute Wan weight paths in verification documentation only. They
are not stored in a runtime config and cannot be deleted by an application endpoint.
