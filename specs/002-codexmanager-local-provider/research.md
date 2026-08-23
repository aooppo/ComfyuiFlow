# Research: CodexManager Local Test Provider

## R-001 — Treat the gateway as a separate provider

**Decision**: Register `codexmanager-local` independently from `openai`.

**Rationale**: OpenAI-compatible transport does not prove upstream model identity, billing,
retention, error, or capability equivalence. Separate provenance prevents a gateway response from
being reported as official OpenAI.

**Alternatives considered**: Reuse provider ID `openai` (rejected: dishonest provenance); generic
user-supplied compatible endpoint (rejected: constitution and SSRF/secret risk).

## R-002 — Fix the endpoint and isolate the key

**Decision**: Use `http://127.0.0.1:48760/v1` as an application constant and read only
`CODEX_MANAGER_API_KEY` from the environment.

**Rationale**: The gateway is local, currently exposes `/health`, requires bearer authentication
for `/v1/models`, and was previously verified with Responses wire behavior. A fixed loopback target
preserves the controlled-provider boundary.

**Alternatives considered**: Store the key in config (rejected: secret exposure); accept a base URL
from requests (rejected: arbitrary relay and SSRF risk).

## R-003 — Reuse the strict Director contract

**Decision**: Send the same two image inputs, `store: false`, prompt, Zod structured-output format,
and post-response duration validation as the official adapter. Request the local gateway's
supported `gpt-5.4` alias while official OpenAI retains its pinned snapshot.

**Rationale**: The OpenAI Responses contract supports text/image inputs and JSON output. Shared
domain validation makes compatibility testable without weakening output guarantees.

**Alternatives considered**: Chat Completions translation (rejected: different wire contract);
plain JSON mode or repair call (rejected: weaker validation and extra calls).

The first authorized compatibility attempt proved that CodexManager rejects
`gpt-5.4-2026-03-05` with `model_not_found` while `/v1/models` advertises `gpt-5.4`. Alias drift is
therefore an explicit local-provider limitation rather than hidden remapping.

## R-004 — Make test default without automatic fallback

**Decision**: Dry-run and spike LIVE wiring select `codexmanager-local` by default. Missing gateway
configuration fails closed; official OpenAI remains code-selectable but is never chosen
automatically.

**Rationale**: This is the user's explicit test default while Constitution IV forbids silent paid
fallbacks.

**Alternatives considered**: Environment-controlled arbitrary default (rejected for this bounded
spike); local-then-OpenAI fallback (rejected: authorization and provenance violation).
