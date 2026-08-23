# Phase 0 Research: ComfyUI Vertical Spike

## Decisions

### R-001: Build a project-owned MCP bridge

**Decision**: Expose a narrow stdio MCP server translating to the installed ComfyUI HTTP API.

**Rationale**: Current Codex MCP configuration exposes no ComfyUI server, tool, resource, or
template. The local ComfyUI source provides the required control endpoints. A bridge keeps the
application boundary MCP-only while avoiding a permanent discovery dead end.

**Alternatives rejected**: Direct HTTP calls from domain code break the intended boundary;
inventing third-party MCP tool names would be unauditable; stopping permanently prevents the
vertical spike.

### R-002: Use HTTP polling; keep WebSocket optional

**Decision**: Submit via `POST /prompt`, poll normalized status with `GET /api/jobs/{prompt_id}`,
retrieve files with `GET /view`, inspect `GET /queue`, and cancel with
`POST /api/jobs/{prompt_id}/cancel`. Use `POST /upload/image` for staged reference inputs.

**Rationale**: These routes are present in the checked-out ComfyUI 0.33.2 source. The jobs endpoint
normalizes pending, in-progress, completed, failed, and cancelled states and includes terminal
outputs. WebSocket `/ws` broadcasts richer progress but is not necessary for correctness.

**Alternatives rejected**: History-only polling has a larger legacy response surface; WebSocket-only
tracking makes restart recovery harder.

### R-003: Register API-format workflows with allowlisted bindings

**Decision**: Version control an API-format workflow plus a manifest containing stable workflow ID,
content hash, required node classes/models, input/output roles, and JSON Pointer bindings.

**Rationale**: ComfyUI accepts a node-object prompt, not an editor workflow. Binding arbitrary user
paths is unsafe and cannot prove that character/scene inputs reach the intended nodes.

**Alternatives rejected**: Raw workflow upload from the CLI enables arbitrary graphs and hidden
network/API nodes; node-name conventions are too fragile.

### R-004: Keep spike evidence local and append-only

**Decision**: Store immutable assets/artifacts plus JSONL events under ignored `var/spike`.

**Rationale**: The spike needs durable authorization and provenance but not the full product data
model. JSONL makes consumption-before-call and historical failures auditable without prematurely
building Prisma migrations.

**Alternatives rejected**: In-memory state cannot survive restart; PostgreSQL/Prisma would delay the
feasibility test and is already planned for product Phase 1.

### R-005: Implement OpenAI first behind `AiModelProvider`

**Decision**: The one-shot Director uses the OpenAI Responses API with the fixed
`gpt-5.4-2026-03-05` snapshot, `store: false`, image inputs, and JSON Schema structured output.
Adapter output is validated again with Zod.

**Rationale**: This preserves provider neutrality while following the revised delivery order.
OpenAI's documented GPT-5.4 modalities include text and image input, but not direct video input.

**Alternatives rejected**: Implementing OpenAI and Qwen simultaneously expands the experiment before
the video path is known. Qwen remains a later adapter against the same contract.

### R-006: Separate the two irreversible calls

**Decision**: Require one exact grant for Director and another exact grant for ComfyUI generation.
Each is consumed before its own network request. Asset uploads and status/artifact reads do not
consume additional generation grants.

**Rationale**: AI creative generation and GPU video generation have separate cost/failure
boundaries. A successful Director call must not implicitly authorize a video submission.

## Confirmed local facts

- ComfyUI checkout: `/Users/tj/Applications/ComfyUI-LadyLala`, version `v0.33.2`, commit `7cee3ce`.
- `server.py` SHA-256:
  `74573b10465505b88b618da86059878e3a56418f84c7dae4073c8824aee35a6c`.
- `openapi.yaml` SHA-256:
  `a3660438bbe9c34e3cd4007e8c0464c30ab880f68828bb5ec2ab298acd907574`.
- Confirmed routes: `/upload/image`, `/prompt`, `/api/jobs/{job_id}`, `/queue`,
  `/api/jobs/{job_id}/cancel`, `/view`, `/object_info`, `/system_stats`, `/ws`.
- `POST /prompt` accepts an optional client-chosen canonical UUID `prompt_id`, enabling query-only
  reconciliation after an ambiguous response.
- `SaveVideo` exists as a base node, but that does not prove an installed generation model or a
  working image-to-video graph.
- ComfyUI was not running and port 8188 was not listening during discovery.
- Standard model directories contain no usable model weights; only configuration/placeholders and
  an incomplete Hugging Face lock were found.
- No saved reference-conditioned API workflow or generated video artifact was found.
- The InstantID custom node source is present, but its required InstantID, ControlNet, and related
  model assets are absent.

## Unknown until a real workflow/model is supplied

- Which video model and workflow meet the character plus scene reference requirement.
- Exact supported duration, resolution, frame rate, VRAM use, and runtime on Apple M1 Pro.
- Whether the chosen graph uses both references semantically and produces an MP4 output record.
- Character, scene, action, and continuity quality.
- Audio support (explicitly outside this spike).

## Source references

- Local ComfyUI `server.py`, `openapi.yaml`, `comfy_execution/jobs.py`, and
  `comfy_extras/nodes_video.py` at the hashes above.
- [OpenAI GPT-5.4 model documentation](https://developers.openai.com/api/docs/models/gpt-5.4)
- [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Qwen vision model documentation](https://www.alibabacloud.com/help/en/model-studio/vision-model)
- [Qwen structured output](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)
