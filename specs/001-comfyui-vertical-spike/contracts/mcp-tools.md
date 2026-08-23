# ComfyUI MCP Tool Contract

All tools return JSON content validated by shared Zod schemas. Tool errors are classified and never
include response headers, credentials, raw environment values, or unredacted workflow secrets.

## `comfyui_list_workflows`

Input: `{}`

Output: registered workflow IDs, versions, hashes, enabled state, constraints, and current manifest
validation. This reads the project registry only and makes no ComfyUI request.

## `comfyui_check_readiness`

Input: `{ "workflowId": string }`

Output: endpoint reachability, server facts, manifest/hash validation, missing node classes, missing
declared models, binding validation, and `ready`. It may use read-only ComfyUI requests and MUST
report `generationCalls: 0`.

## `comfyui_stage_input`

Input: `{ "workflowId": string, "role": "character" | "scene", "localPath": string,
"expectedSha256": string }`

Output: server-returned input name/subfolder/type plus verified source hash. The local path must be
inside the spike's immutable input root. This tool calls confirmed `POST /upload/image` but does not
submit a workflow.

## `comfyui_submit_workflow`

Input: `{ "workflowId": string, "workflowSha256": string, "promptId": uuid,
"bindings": { "character": StagedInput, "scene": StagedInput, "shot": ShotSpecification },
"authorization": GrantReference }`

Output: `{ "promptId": uuid, "queueNumber": number, "nodeErrors": object }`.

The tool loads the registered API workflow, verifies the exact hash and grant scope, applies only
manifest bindings, consumes the one-call grant before `POST /prompt`, and never retries.

## `comfyui_get_job_status`

Input: `{ "promptId": uuid }`

Output: normalized status, timestamps, error classification, and output count from
`GET /api/jobs/{promptId}`. A 404 maps to `UNKNOWN`; it never triggers submission.

## `comfyui_get_artifacts`

Input: `{ "promptId": uuid, "runId": uuid, "workflowId": string }`

Output: retained artifact descriptors and hashes under the bridge-controlled artifact root. The
tool accepts only output references returned by the terminal job and declared by the registered
workflow, downloads through `GET /view`, and rejects path traversal or missing media.

## `comfyui_get_queue`

Input: `{}`

Output: normalized running and pending prompt IDs from `GET /queue`; sensitive workflow payloads
are not returned through MCP.

## `comfyui_cancel_job`

Input: `{ "promptId": uuid }`

Output: `{ "cancelled": boolean }` from `POST /api/jobs/{promptId}/cancel`. The operation is
targeted and idempotent; it never clears the global queue.

## Error classes

- `CONFIGURATION`: invalid endpoint, manifest, or workflow hash
- `NOT_READY`: service, node, model, or binding prerequisite missing
- `AUTHORIZATION`: missing, expired, consumed, or mismatched grant
- `PROVIDER_VALIDATION`: ComfyUI rejected the prompt
- `TRANSPORT`: request failed before a confirmed response
- `AMBIGUOUS_SUBMISSION`: request may have reached ComfyUI; query the supplied prompt ID only
- `PROVIDER_FAILED`: terminal execution failure
- `ARTIFACT_INVALID`: missing, corrupt, unsafe, or non-video output
