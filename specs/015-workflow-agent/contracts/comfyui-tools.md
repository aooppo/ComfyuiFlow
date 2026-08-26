# ComfyUI MCP Tool Contract

Existing legacy tools remain for old Batches. The new engine uses the following tools.

## Read-Only Tools

### `comfyui_get_node_catalog`

Returns runtime version, scoped/full catalog hashes, timestamp, and allowlisted summaries. Removes
hidden credential/default values, never submits, and reports `generationCalls: 0`.

### `comfyui_get_node_info`

Accepts one allowlisted class and exact catalog hash. Returns strict required/optional fields,
options/ranges, output types/indices, and output-node flag. Other classes fail closed.

### `comfyui_validate_graph`

Internal-only static validation against exact catalog, allowlist, compiler, pattern, block, bindings,
types, acyclicity, reachability, output, and path/security policy. It never calls `/prompt`.

### `comfyui_check_graph_readiness`

Checks loopback runtime, catalog match, nodes/fields, configured credential profile, safe inputs, and
output capability. Static readiness never promotes technical evidence or proves quota/credits.

## Execution Tool

### `comfyui_submit_execution_plan`

Input contains only `executionPlanId`, `executionPlanSha256`, `generationJobId`,
`authorizationConsumptionId`, and `materializedExecutionSha256`.

The MCP reads the FROZEN plan and bindings from PostgreSQL, rechecks job/target/consumption,
materialized SHA, catalog, allowlist, output prefix, and one-submit authority, then makes at most one
`/prompt` request. The client cannot provide graph, credential, endpoint, output path, or local path.

Unknown network outcome is AMBIGUOUS. Status/cancel/retain use the original prompt ID and never retry
or resubmit.

## Graph Safety Rules

- Graph size/node count are bounded.
- Every class/field exists in the same scoped catalog; required inputs and literal options/ranges pass.
- Edge source/output index/type are valid; graph is acyclic; every node reaches the retained output.
- Nodes and fields belong to the implementation's server-owned allowlist/pattern/block versions.
- Arbitrary file, shell, command, download, URL, endpoint, credential, and output path are rejected.
- Workflow file target is realpath-contained within registry root (including symlink resolution).
- LoadImage uses only frozen opaque staging tokens with exact storage SHA/size/media verification.
- SaveVideo prefix derives from plan ID; caller/LLM cannot supply it.
- Canonical graph hash includes graph, catalog, compiler, workflow, pattern, block, parameter, and
  binding versions, but no credential value.
