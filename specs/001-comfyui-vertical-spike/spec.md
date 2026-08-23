# Feature Specification: ComfyUI Vertical Spike

**Feature Branch**: `codex/phase-0-discovery`

**Created**: 2026-08-23

**Status**: Draft

**Input**: Validate the smallest real path from one character image, one scene image, and one
creative description to one playable video shot before building the broader product.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Verify Generation Readiness Without Spending (Priority: P1)

As the product owner, I can inspect the available generation connection, registered workflow,
required inputs, supported media settings, and exact planned request before any external generation
is attempted.

**Why this priority**: The spike must fail safely when the local generation environment is absent or
misconfigured, and discovery itself must not consume model quota or GPU work.

**Independent Test**: Run the readiness check with no usable generation service and confirm that it
reports each missing prerequisite, produces a zero-call plan, and creates no remote task.

**Acceptance Scenarios**:

1. **Given** no usable ComfyUI control connection, **When** readiness is checked, **Then** the result
   identifies the missing connection and prevents live execution without submitting work.
2. **Given** a connected service but no compatible workflow or model, **When** readiness is checked,
   **Then** the result identifies the missing workflow/model and reports zero generation calls.
3. **Given** all prerequisites are present, **When** a dry run is requested, **Then** the owner sees
   the selected images, shot description, workflow identity and hash, bounded settings, expected
   invocation summary, and `providerCalls = 0`.

---

### User Story 2 - Generate One Real Reference-Conditioned Shot (Priority: P1)

As the product owner, I can explicitly authorize one live attempt that turns one character image,
one scene image, and one creative description into one video shot.

**Why this priority**: This is the earliest proof that the central product promise is technically
feasible and worth further product investment.

**Independent Test**: With one compatible workflow and model available, authorize exactly one
submission and verify that a playable output is retained with its request and task lineage.

**Acceptance Scenarios**:

1. **Given** a successful dry run and an unused one-call authorization, **When** the owner starts the
   spike, **Then** exactly one generation submission is attempted and the resulting task is tracked
   to completion or failure.
2. **Given** the task succeeds, **When** the result is collected, **Then** one playable video file,
   its cryptographic hash, media facts, workflow identity, source-asset hashes, prompt, and provider
   task identifier are preserved.
3. **Given** the task fails or becomes ambiguous, **When** execution stops, **Then** no automatic
   retry, replacement, fallback, or second submission occurs.

---

### User Story 3 - Make a Feasibility Decision (Priority: P2)

As the product owner, I can review the generated shot and technical evidence separately, then record
whether the product may proceed to Project/Asset UI work.

**Why this priority**: A technically completed task does not prove that character, scene, action, or
visual quality is acceptable.

**Independent Test**: Review either a successful or failed run and confirm that technical status and
human feasibility decision remain distinct and that downstream phases stay locked until a decision
is recorded.

**Acceptance Scenarios**:

1. **Given** a playable shot, **When** the owner reviews it, **Then** the owner can record PASS or FAIL
   without altering the original run evidence.
2. **Given** no playable shot or no owner PASS, **When** downstream readiness is evaluated, **Then**
   Project/Asset productization remains blocked unless the owner explicitly accepts the risk.

### Edge Cases

- Character or scene input is missing, unreadable, duplicated, or not a supported image type.
- The selected workflow requires inputs or dimensions that the spike does not provide.
- Workflow content changes after dry-run approval but before live execution.
- The generation service is reachable during discovery but disconnects during submission or polling.
- A submission times out before a durable provider task identifier is returned.
- The service reports success but the artifact is absent, zero-length, corrupt, or not a video.
- The authorization is expired, already consumed, targets different assets, or permits more than one
  live generation attempt.
- Output video is technically playable but fails the owner's character, scene, or action expectation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST discover and report whether a usable ComfyUI control connection exists
  without submitting generation work.
- **FR-002**: When no suitable external control connection exists, the project MUST provide a minimal
  project-owned control boundary that offers only the capabilities needed by this spike.
- **FR-003**: The control boundary MUST expose confirmed workflow discovery/registration,
  submission, status tracking, artifact retrieval, queue inspection, and cancellation only when the
  underlying service confirms the operation.
- **FR-004**: The spike MUST accept exactly one character image, one scene image, and one creative
  description as its user inputs.
- **FR-005**: The system MUST preserve each source image unchanged and record its SHA-256 hash,
  media type, byte size, and role.
- **FR-006**: The system MUST select one explicitly registered, versioned, reference-conditioned
  video workflow and record its content hash.
- **FR-007**: The system MUST reject a workflow that lacks a verified binding for every required
  input or output.
- **FR-008**: The system MUST produce a structured one-shot description containing start state,
  action, end state, camera, composition, continuity requirements, and duration before video
  generation.
- **FR-009**: The system MUST support a DRY_RUN that presents all inputs, workflow identity,
  generated shot specification, bounded settings, and expected invocation while recording zero
  external calls.
- **FR-010**: A live spike MUST require separate server-side gates and persisted authorizations for
  a maximum of one AI Director call and one video-generation submission, scoped to the exact source
  hashes, model or workflow identity, and prompt version.
- **FR-011**: Each authorization MUST be consumed before its network attempt and MUST NOT be
  automatically restored after validation, transport, timeout, or provider failure.
- **FR-012**: The system MUST persist an append-only run record before submission and MUST persist the
  provider task identifier as soon as it is returned.
- **FR-013**: If submission outcome is ambiguous and no idempotent reconciliation is available, the
  run MUST stop as ambiguous and MUST NOT resubmit automatically.
- **FR-014**: The system MUST poll only the existing task after a durable task identifier is known.
- **FR-015**: A successful task MUST yield one locally retained video artifact with SHA-256, byte
  size, duration, resolution, frame rate, codec, and source lineage.
- **FR-016**: Missing, empty, corrupt, or non-video output MUST be recorded as a failed spike even if
  the provider reports technical success.
- **FR-017**: Technical run status and human feasibility review MUST be stored separately; the system
  MUST NOT create a human PASS automatically.
- **FR-018**: No automatic retry, provider fallback, workflow replacement, parallel submission, AI
  QA, final assembly, or additional shot generation is permitted in this feature.
- **FR-019**: Productization phases MUST remain gated until the spike has a playable artifact and an
  explicit owner PASS, or the owner separately records risk acceptance.
- **FR-020**: Secrets MUST come only from the runtime environment and MUST never appear in persisted
  evidence, logs, command output, or API responses.

### Key Entities

- **Spike Input Asset**: An immutable character or scene reference with role and integrity metadata.
- **Shot Specification**: The structured creative intent for the single shot, independent of the
  generation workflow's internal node representation.
- **Workflow Registration**: The selected workflow's identity, version, hash, supported inputs,
  constraints, and verified bindings.
- **Spike Run**: The append-only execution record containing dry/live mode, authorization, status,
  timestamps, and failure classification.
- **Provider Task**: The durable external task reference and last confirmed status.
- **Video Artifact**: The locally retained output and verified media/provenance facts.
- **Feasibility Review**: The owner's separate PASS/FAIL decision and optional notes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A readiness check completes without a generation submission and reports every required
  prerequisite as ready or blocked.
- **SC-002**: Every dry run reports `providerCalls = 0` and contains enough information for the owner
  to identify both source images, the one-shot intent, and the selected workflow.
- **SC-003**: A live spike can make no more than one AI Director call and one video-generation
  submission under separate authorizations, including all failure paths.
- **SC-004**: On success, the owner can play one retained video and verify its source hashes,
  workflow hash, task identifier, duration, dimensions, frame rate, and codec.
- **SC-005**: On any failure or ambiguous outcome, zero automatic retries or replacement submissions
  occur and the failure is visible within one status-refresh interval.
- **SC-006**: Downstream productization remains blocked until the owner records PASS or explicit risk
  acceptance.
- **SC-007**: Automated verification covers all dry-run, authorization, fail-stop, lineage, and media
  validation requirements without contacting a real AI or generation provider.

## Assumptions

- The spike is operated locally by one product owner; authentication and multi-user permissions are
  deferred.
- The owner will separately provide or approve a compatible reference-conditioned workflow, its
  required model assets, and the exact one-call LIVE authorization.
- The first spike uses OpenAI for the one-shot structured creative step; the provider-neutral
  contract is retained, while Qwen implementation is deferred until after the three-shot path.
- The generated shot may be silent; audio generation is not a feasibility requirement.
- Project/Asset Web UI, PostgreSQL product state, storyboard editing, multi-shot orchestration,
  frame QA, retries, Qwen comparison, and final assembly are separate follow-up features.
