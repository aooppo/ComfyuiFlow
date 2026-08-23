# Phase 0A Discovery

**Observed**: 2026-08-23

**External provider calls**: 0

**ComfyUI generation submissions**: 0

## Capability matrix

| Capability                     | Evidence                                  | Status               |
| ------------------------------ | ----------------------------------------- | -------------------- |
| Existing ComfyUI MCP           | No configured tools/resources/templates   | Unavailable          |
| Project-owned MCP bridge       | Eight stdio tools; fake contracts pass    | Implemented          |
| Submit                         | Local `POST /prompt`; returns `prompt_id` | Confirmed API        |
| Status                         | Local `GET /api/jobs/{job_id}`            | Confirmed API        |
| Artifact metadata              | Terminal job `outputs`                    | Confirmed API        |
| Artifact bytes                 | Local `GET /view`                         | Confirmed API        |
| Queue                          | Local `GET /queue`                        | Confirmed API        |
| Targeted cancel                | Local `POST /api/jobs/{job_id}/cancel`    | Confirmed API        |
| Input upload                   | Local `POST /upload/image`                | Confirmed API        |
| WebSocket progress             | Local `/ws`                               | Confirmed, optional  |
| Reference-conditioned workflow | None found                                | Blocked              |
| Usable video model weights     | None found                                | Blocked              |
| Duration/resolution/fps limits | Workflow dependent                        | Unknown              |
| Character/scene fidelity       | Requires real shot and human review       | Unknown              |
| Audio                          | Outside vertical spike                    | Unsupported by scope |

## Local inventory

- ComfyUI: `/Users/tj/Applications/ComfyUI-LadyLala`
- Version/commit: `v0.33.2` / `7cee3ce`
- Runtime during discovery: not running; `127.0.0.1:8188` not listening
- Base video output node: `SaveVideo` source present
- Custom node source: `ComfyUI_InstantID` present
- Models: no usable weights in standard directories; required InstantID/ControlNet weights absent
- Workflows: no saved, enabled reference-conditioned API workflow
- Outputs: no real generated video artifact discovered

## Phase decision

Phase 0A documented the missing external MCP and local generation prerequisites. Phase 0B is now
implemented: the project-owned bridge and fake HTTP/MCP contract tests cover registry, readiness,
input staging, one-shot submit, status, artifact retrieval, queue inspection, and targeted cancel.
Phase 0.5 code, zero-call preview, authorization, provenance, FFprobe, and review gates are also
implemented under fakes.

The real one-shot run remains blocked until an owner supplies a compatible workflow/model, starts
ComfyUI, reviews a zero-call dry-run, and creates two exact LIVE authorizations. Implementation and
tests have made zero OpenAI calls and zero ComfyUI generation submissions.

The current executable discovery result normalizes the blockers as
`NO_REGISTERED_WORKFLOW`, `VIDEO_MODEL_UNVERIFIED`, and `COMFYUI_UNREACHABLE`, with
`providerCalls: 0` and `generationCalls: 0`.
