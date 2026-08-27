# Generation Mainline Contract

All mutations require same-origin protection and an idempotency key. They return immutable records; no endpoint accepts a raw graph or chooses a provider/workflow string.

| Surface                                               | Request purpose                                            | Result                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `POST /api/generation-plans`                          | Plan selected storyboard shots from registry data          | frozen preview with identities, references, graph digest, blockers |
| `POST /api/generation-plans/{id}/authorizations`      | Create bounded zero-call authorization                     | video/AI-QA caps, prices, expiry, consumption-free state           |
| `POST /api/generation-batches`                        | Create batch from valid authorization and selected targets | immutable Batch/Target records; no provider call                   |
| `GET /api/generation-attempts/{id}`                   | Inspect status and evidence                                | Attempt, Artifact, QA, Owner decision, limits, consumption         |
| `POST /api/generation-artifacts/{id}/retain`          | Retain output through server-owned adapter                 | artifact technical facts and frames                                |
| `POST /api/generation-artifacts/{id}/owner-decisions` | Append Owner PASS/FAIL/RISK_ACCEPTED                       | decision record only                                               |
| `POST /api/generation-retry-previews`                 | Create zero-call retry after Owner FAIL                    | preview only; no authorization or submission                       |
| `POST /api/generation-assemblies`                     | Idempotently request eligible assembly                     | assembly keyed by source digest                                    |
| `GET /api/capability-registry`                        | Read dynamic capability and RuntimeContract facts          | registry without retired aliases                                   |

The MCP boundary exposes exactly `submit_generation_attempt`, `get_generation_attempt_status`, and `retain_generation_artifacts`. Each action receives only an attempt identifier plus frozen identity/digest references. MCP loads the RuntimeContract, checks current `/object_info`, validates the database graph snapshot, and rejects mismatches.
