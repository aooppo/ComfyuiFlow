# Verification: DECOROLALA H3 Live Validation

**Started**: 2026-08-24

## Owner prerequisites

- Comfy login: owner-reported complete
- Credits: owner-reported USD 10 purchased
- Exact LIVE request confirmation: received for scope
  `88d59c86ff42a56a9469c45d8475c522a68c0908348124865f9f60e89f181b08`, at most one
  Director call and one H3 submission, estimated `$1.9305`, with no retry

## Zero-call evidence

- H3 node supports Image 1–9 and 4–15 seconds according to live `object_info`.
- Active workflow: `minimax-h3-decorolala-ad-15s-v1`.
- Graph SHA-256: `e5aeb79cf71b7e7f9e3aa9935756a406460b63db1d448f43239d9d3a3ca7fe37`.
- Profile: 768×1344, 24fps, 15 seconds.
- Workflow hash/nodes/bindings/models: ready, no blockers.
- Queue: empty.
- Exact real-asset dry-run: five distinct SHA-256 values; the complete generation prompt is bound
  into final scope hash `88d59c86ff42a56a9469c45d8475c522a68c0908348124865f9f60e89f181b08`.
- Provider calls / generation calls: `0 / 0`.
- Source dimensions: scene `1672×941`, product `1187×745`, and each character view
  `1122×1402`; all satisfy the installed H3 node's minimum 256px and 0.4–2.5 aspect-ratio guard.
- Installed Partner Node price badge: 768P rate `$0.1287/second`; five images incur no extra image
  fee, so the current local estimate for 15 seconds is `$1.9305`. Provider settlement remains
  authoritative.
- Final checks passed: format, lint, typecheck, 14 test files / 46 tests, build, secret scan, and
  `git diff --check`.

## Single authorized live attempt

- Run ID: `f0344cf0-aa79-42ba-8711-f5eba558452b`
- Director grant: `d4d68f01-aaef-42c1-bcf0-5739a7db4812`; consumed once.
- Director result: completed once with response ID
  `resp_0bfc43f0699deb53016a8c146b30bc87d1b5c30c930eeda5fc` and no retry.
- H3 submission grant: `31f91136-6a75-4f1b-9e03-f0bf3145fee1`; consumed once.
- Local ComfyUI prompt ID: `3207e7d3-2a90-4789-8200-161e0305270b`.
- Terminal status: `FAILED`; no retry, fallback, or replacement submission was made.
- Failure boundary: `MinimaxHailuo03ReferenceNode` failed while uploading the five inputs to the
  Partner Node service, before provider generation, with `Unauthorized: Please login first to use
this node.`
- Outputs: `0`; retained artifact: none; technical/Human video review is therefore unavailable.
- Billing: the local job record does not expose a charge. Because the failure occurred during input
  upload before provider generation, no `$1.9305` generation settlement is evidenced; the Comfy
  account balance remains the authoritative confirmation.
- Root cause: the direct `/prompt` submission carried only `comfy_usage_source` in `extra_data`; it
  did not carry the frontend-acquired `AUTH_TOKEN_COMFY_ORG`. A login in a browser tab does not by
  itself attach that credential to this API submission path.

## Post-failure authentication hardening (zero generation calls)

- Added environment-only `COMFYUI_API_KEY` (preferred) / `COMFYUI_AUTH_TOKEN` support. The value is
  injected only into ComfyUI `extra_data` in memory and is excluded from workflow hashes,
  authorization scope, evidence, and output.
- Marked both registered H3 Partner Node workflows as requiring Comfy Org authentication.
- Readiness now reports only `comfyOrgCredentialConfigured: true|false` and blocks with
  `COMFY_ORG_CREDENTIAL_MISSING` when absent.
- Submission independently checks the same prerequisite before consuming a generation grant.
- The exact five-reference dry-run now fails closed on the missing credential with Provider and
  generation calls `0 / 0`; its scope remains
  `88d59c86ff42a56a9469c45d8475c522a68c0908348124865f9f60e89f181b08`.
- Contract/unit regression coverage proves credential injection, missing-credential readiness,
  pre-consumption blocking, and recursive redaction without making a generation call.
- Final checks passed after hardening: format, lint, typecheck, 14 test files / 49 tests, build,
  secret scan, and `git diff --check`.

## Pending

- Configure an owner-controlled environment credential and repeat the zero-generation readiness
  check until `COMFY_ORG_CREDENTIAL_MISSING` clears; no new paid-call authorization exists.
- Artifact/media/review-frame evidence and owner visual decision remain unavailable for this failed
  attempt.

## Minimum-cost validation revision (zero generation calls)

- The installed `MinimaxHailuo03ReferenceNode` live schema reports duration `min: 4`, `max: 15`,
  so the requested 2 seconds is unsupported. The active target is the minimum 4 seconds.
- Active workflow: `minimax-h3-decorolala-validation-4s-v1`.
- Graph SHA-256: `6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a`.
- Profile: 768×1344, 9:16, 24fps, 4 seconds, watermark off.
- Estimated H3 cost: `$0.5148` (`4 × $0.1287` at the installed 768P badge rate); provider
  settlement remains authoritative.
- Prompt: six-section full-reference structure, one continuous untimed shot, minimal breathing,
  gaze, fire flicker, and optical push; walking, glass placement, sitting, and cuts are excluded.
- Historical `minimax-h3-decorolala-ad-15s-v1` remains hash-locked and disabled; it was not edited
  or submitted.
- Exact real-asset dry-run scope:
  `051fd0759c720b885c778e45e49ed8b0f9fd293f241d70f5b44a4021c3bb6a7f`.
- Dry-run facts: five original SHA-256 values unchanged, workflow graph/bindings/nodes valid,
  Provider/generation calls `0 / 0`, and no grants created.
- Current blocker: `COMFY_ORG_CREDENTIAL_MISSING`; no short validation may be submitted until this
  clears in a fresh zero-call readiness check.
- Checks passed: format, lint, typecheck, 14 test files / 50 tests, build, secret scan, and
  `git diff --check`.

## Partner credential readiness for the four-second scope

- Owner added a credential under the Comfy-compatible `COMFY_API_KEY` name in the ignored project
  `.env`; its value was never read into output or evidence.
- The CLI/MCP now safely loads the ignored project `.env` and accepts `COMFY_API_KEY` as an alias
  for the preferred `COMFYUI_API_KEY` name.
- Fresh exact real-asset dry-run: `ready: true`, `comfyOrgCredentialConfigured: true`, blockers
  empty, Provider/generation calls `0 / 0`, no grants created.
- Scope remains `051fd0759c720b885c778e45e49ed8b0f9fd293f241d70f5b44a4021c3bb6a7f`.
- Compatibility checks passed: format, lint, typecheck, 14 test files / 50 tests, build, secret
  scan, and `git diff --check`.
- No short H3 execution is authorized yet. A fresh exact owner confirmation is still required.

## Authorized four-second live validation

- Exact owner confirmation received for scope
  `051fd0759c720b885c778e45e49ed8b0f9fd293f241d70f5b44a4021c3bb6a7f`, at most one Director
  call and one H3 submission, estimated `$0.5148`, with no retry.
- Run ID: `f7d040cd-785f-4f07-9b09-0cf2a4e474e7`.
- Director grant: `a1ccc62f-90cd-44d8-a588-f970d6cd3c3d`; consumed once.
- H3 submission grant: `d575f666-949a-4030-9e8b-452976a74aa2`; consumed once.
- Local/Provider-bound prompt ID: `5a0528e6-21e0-4e6d-8fe2-11a954085cb3`.
- Terminal status: `COMPLETED`; no retry, fallback, replacement, 15-second submission, or second
  task was created.
- Artifact ID: `4132e57c-fc4c-4190-8a0a-04fa5fecf1d5`.
- Artifact SHA-256: `e23a6fc7e1040cf5ab1b0e663c1312300fa923b38e2a8b0a4525f340463c53a3`.
- Artifact: MP4, 1,342,542 bytes, H.264 768×1344 at 24fps, 4.458333 seconds, approximately
  2.409 Mbps; AAC stereo 32kHz audio, 4.45 seconds.
- Deterministic review frames retained at 0.00s, 2.20s, and 4.30s under the run artifact's
  `review/` directory.
- Technical visual inspection: no severe color blocks, stretching, progressive corruption, or
  structural collapse; the character, table, room, and single half-filled red-wine glass remain
  broadly stable across the three frames.
- Human-review risks: exact face/product fidelity remains an owner judgment; a small light-colored
  shape appears in the rug/floor area behind the table near the final frame; audio presence is
  verified but its semantic content requires listening.
- Owner Human QA decision: `PASS`, recorded at `2026-08-24T11:40:21.059Z` under review ID
  `f54c2866-62fc-4304-8d9c-d8d6e48938ce` for artifact
  `4132e57c-fc4c-4190-8a0a-04fa5fecf1d5`.
- The owner gate is open with reason `OWNER_PASS`. This decision applies only to the retained
  four-second reference-stability validation artifact; it does not authorize or approve a paid
  15-second generation.
