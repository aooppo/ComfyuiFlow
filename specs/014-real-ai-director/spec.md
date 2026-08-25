# Feature Specification: Real AI Director Proposal Workflow

**Feature Branch**: `codex/014-real-ai-director`
**Created**: 2026-08-25
**Status**: Approved for implementation; no LIVE AI call is authorized

## Clarifications

### Session 2026-08-25

- Both external profiles request the exact model `gpt-5.6-terra`; no `gpt-5.4` fallback is allowed.
- Each run selects exactly one Provider. Dual comparison, automatic routing, retries, repair calls,
  and cross-Provider fallback are out of scope.
- The AI chooses 1 through the owner-selected maximum number of shots. The maximum is 1-20 and
  defaults to 3.
- The current Storyboard is comparison and concurrency context, not an instruction to rewrite its
  shot text.
- Every adopted shot must use at least one confirmed reference. Edits may only use references bound
  to the originating run.

## User Scenarios & Testing

### User Story 1 - Preview and Authorize One Director Run (Priority: P1)

As the owner, I select one Provider and a maximum shot count, review deterministic recommended
approved images, and see a zero-call preview before explicitly authorizing at most one call.

**Independent Test**: With the Fake V2 profile, preview a three-shot limit, confirm selected
references, and queue one run while the external-call ledger remains zero.

**Acceptance Scenarios**:

1. Preview recommends at most nine same-project, active, approved, READY, hash-verified images in a
   stable business order and explains every rejected candidate.
2. Preview returns Provider/model, exact references, maximum shots, request/scope hashes, cost
   ceiling, price expiry, one-call maximum, no-retry statement, and `externalCalls: 0` without writes.
3. Confirmation recomputes preview and atomically creates the run, exact reference snapshots, and
   one-use authorization only when head, `If-Match`, idempotency, price, and hashes still match.
4. Credentials, model, endpoint, internal IDs, and paths cannot be overridden by the browser.

### User Story 2 - Produce and Inspect an Immutable Proposal (Priority: P1)

As the owner, I can wait for one bounded Director attempt and inspect a proposal without changing
the current Storyboard or its approval.

**Independent Test**: Run `fake-storyboard-v2`; it creates one immutable proposal containing no more
than the selected maximum while Storyboard head and approval remain byte-for-byte unchanged.

**Acceptance Scenarios**:

1. Worker transitions `QUEUED -> RUNNING -> COMPLETED | FAILED | AMBIGUOUS`, consumes authorization
   and appends the Attempt before any network operation, and never retries or falls back.
2. V2 output contains 1 through `maxShotCount` contiguous shots, a narrative summary, non-empty shot
   fields, and at least one known reference alias per shot.
3. Unknown aliases, duplicate or missing ordinals, excess/zero shots, empty fields, or reference-free
   shots fail the entire attempt without clipping or repair.
4. The server derives stable shot keys from normalized output hash and ordinal; model output never
   supplies UUIDs.
5. Persisted proposals omit credentials, absolute paths, Base64 images, and raw sensitive responses.

### User Story 3 - Edit, Reject, or Adopt a Proposal (Priority: P1)

As the owner, I compare the proposal with the current Storyboard, edit proposed text and reference
usage, then explicitly reject it or adopt it as a new version.

**Independent Test**: Edit a Fake proposal, reject one proposal without Storyboard mutation, then
adopt another with `If-Match`; adoption appends an `AI_DIRECTOR` version and clears only the current
approval while preserving all prior history.

**Acceptance Scenarios**:

1. Proposal generation never changes Storyboard head or approval.
2. Rejection appends a decision only.
3. Adoption revalidates every bound asset/version/file/hash and rejects drift or cross-project data
   without substituting another image.
4. Adoption atomically checks `If-Match` and current head, appends one StoryboardVersion sourced from
   the proposal, and follows existing approval-clearing rules.
5. Existing Storyboard versions, manifests, shot plans, generation jobs, QA, and Owner decisions
   remain readable and unchanged.

### User Story 4 - Use Explicit Terra Provider Profiles Safely (Priority: P2)

As an operator, I can configure CodexManager Local or official OpenAI as separate Terra profiles,
with current billing facts and a disabled-by-default LIVE gate.

**Independent Test**: Mock CodexManager JSON/SSE and OpenAI structured responses; each adapter makes
exactly one request, records the actual returned model, and performs no retry or fallback.

## Edge Cases

- No eligible reference exists, more than nine are selected, or a candidate becomes stale between
  preview, confirmation, execution, and adoption.
- Two tabs confirm the same preview or adopt against the same head.
- Price facts expire or change after preview; billing channel or cost ceiling is absent.
- Worker lease is lost or the process crashes after authorization consumption but before a result.
- Provider returns HTTP failure, timeout, malformed JSON/SSE, no response ID, mismatched model,
  duplicate ordinals, unknown aliases, or a structurally valid but semantically ambiguous result.
- A historical V1 Fake run/version is read after the additive migration.

## Requirements

### Functional Requirements

- **FR-001**: Existing `StoryboardGenerationRequestV1`, fixed-three Fake Provider behavior, hashes,
  runs, and versions MUST remain compatible and readable.
- **FR-002**: V2 MUST use contract `storyboard-generation-v2` and prompt
  `storyboard-director-v2`, with one explicit Provider/model, creative brief, max shot count, current
  head snapshot, and 1-9 ordered safe reference aliases plus semantic facts.
- **FR-003**: Provider-bound requests MUST NOT expose database IDs, credentials, absolute paths, or
  independently resolvable internal identifiers.
- **FR-004**: V2 output validation MUST enforce all strict structural and reference rules without
  clipping, repair calls, retry, or fallback.
- **FR-005**: Profiles MUST include `fake-storyboard-v2`, CodexManager Local `gpt-5.6-terra`, and
  official OpenAI `gpt-5.6-terra`; actual returned model MUST be recorded.
- **FR-006**: Each external profile MUST have a server-owned billing channel, conservative per-call
  ceiling, price effective timestamp, and expiry; missing or stale facts MUST fail closed.
- **FR-007**: LIVE Director work MUST default disabled behind
  `PROJECT_STORYBOARD_DIRECTOR_LIVE_ENABLED`; credentials, endpoints, and model selection MUST remain
  server-owned.
- **FR-008**: Preview MUST be deterministic, read-only, zero-call, and expose all selected/unselected
  candidates and rejection reasons without silent substitution.
- **FR-009**: Confirmation MUST recompute preview and atomically persist run, exact input references,
  one-use authorization, scope hash, price snapshot, and `QUEUED` state.
- **FR-010**: Confirmation and adoption MUST enforce project scope, current head, `If-Match`, stable
  idempotency, hash validity, and stale-price protection.
- **FR-011**: Authorization MUST be consumed and one Attempt appended before network I/O; all hard,
  timeout, invalid-output, crash, and ambiguous outcomes retain that evidence and cannot retry.
- **FR-012**: Proposal creation MUST be immutable and MUST NOT change Storyboard head or approval.
- **FR-013**: Adoption MUST revalidate exact references and append one `AI_DIRECTOR` StoryboardVersion
  linked to its proposal; rejection MUST append only a ProposalDecision.
- **FR-014**: The migration MUST be additive and add Authorization, Attempt, InputReference,
  Proposal, ProposalDecision, and `AI_DIRECTOR` source provenance without rewriting old rows.
- **FR-015**: The seven specified API operations MUST use safe DTOs and thin routes over server-side
  business validation.
- **FR-016**: The Storyboard UI MUST provide the complete Chinese business-language workflow with
  technical facts collapsed by default and recoverable stale-tab conflicts.
- **FR-017**: Automated implementation and acceptance MUST make zero CodexManager, OpenAI, ComfyUI,
  or video-generation calls; LIVE acceptance requires a later fresh per-Provider authorization.

### Key Entities

- **StoryboardDirectorRun**: One Provider-specific immutable input scope and lifecycle.
- **StoryboardDirectorAuthorization / Attempt**: One-use call authority and durable consumption.
- **StoryboardDirectorInputReference**: Ordered exact semantic/file/hash snapshot.
- **StoryboardDirectorProposal**: Normalized immutable proposal and output hash.
- **StoryboardDirectorProposalDecision**: Append-only rejected/adopted owner decision.

## Success Criteria

- **SC-001**: Fake V2 completes preview, queue, proposal, edit, reject, and adopt with all external
  call ledgers at zero.
- **SC-002**: One hundred percent of previews are write-free and return `externalCalls: 0`.
- **SC-003**: One hundred percent of external attempts consume exactly one authorization before the
  single mocked request and execute zero retries/fallbacks.
- **SC-004**: Proposal completion changes neither Storyboard head nor approval; adoption appends one
  version and preserves all historical production records.
- **SC-005**: Every stale head, asset hash, approval, binding, or price fact fails before external I/O
  or adoption mutation.
- **SC-006**: Existing V1 fixed-three Fake tests and historical data checks continue to pass.

## Boundaries

No dual-model comparison, automatic Provider selection, Qwen, output-repair call, keyframe/video
generation, AI QA, Human PASS, assembly, or publishing is included. Phase 13 T057, continuity v6
approval, and keyframe retry remain unfinished and unchanged.
