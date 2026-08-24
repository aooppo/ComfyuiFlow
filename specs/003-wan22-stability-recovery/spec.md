# Feature Specification: Wan2.2 Stability Recovery

**Feature Branch**: `codex/phase-0-discovery`

**Created**: 2026-08-23

**Status**: Approved

**Input**: User description: "I have no ComfyUI background. Adjust the failed workflow so the generated shot can pass Human QA."

## User Scenarios & Testing

### User Story 1 - Receive a safer candidate without learning ComfyUI (Priority: P1)

As a non-technical project owner, I want the system to turn the failed shot evidence into a safer
generation candidate and explain the changes in plain language so that I can continue without
understanding workflows, nodes, samplers, or model internals.

**Why this priority**: The previous shot was technically playable but visibly corrupted. The owner
needs an evidence-based recovery path, not a ComfyUI tutorial.

**Independent Test**: Prepare the replacement candidate and verify that the failed workflow and
artifact remain preserved, the new candidate is independently identified, its expected media
profile and behavioral changes are visible, and no model or generation call occurs.

**Acceptance Scenarios**:

1. **Given** an owner-reviewed failed shot, **When** a replacement candidate is prepared, **Then**
   the old evidence remains unchanged and the new candidate identifies the quality risks it is
   designed to reduce.
2. **Given** the owner has not authorized another attempt, **When** the candidate is previewed,
   **Then** no Creative AI or video-generation request is made.

---

### User Story 2 - Run one controlled recovery attempt (Priority: P1)

As the project owner, I want to authorize one clearly bounded recovery attempt using the selected
assets and candidate so that I can judge a real result without accidental retries or hidden calls.

**Why this priority**: Human QA can only approve a real video, but each model and generation call is
an irreversible boundary.

**Independent Test**: Bind the candidate to the exact asset and workflow hashes, authorize at most
one Director request and one generation submission, retain a playable artifact, and present it for
owner review without retrying automatically.

**Acceptance Scenarios**:

1. **Given** an exact preview and two one-call authorizations, **When** recovery runs, **Then** at
   most one Director request and one generation submission occur.
2. **Given** the provider finishes after the local polling window, **When** recovery reconciles the
   existing task, **Then** it retrieves that task without submitting another one.
3. **Given** a retained artifact, **When** the owner reviews it, **Then** the decision and notes are
   appended without replacing any prior review.

---

### User Story 3 - Continue honestly if quality still fails (Priority: P2)

As the project owner, I want a failed recovery attempt to produce understandable visual evidence
and a bounded next recommendation so that the project improves without claiming success or blindly
spending more resources.

**Why this priority**: Open video generation is probabilistic; a safer candidate can improve the
odds but cannot honestly guarantee approval before the owner sees the result.

**Independent Test**: Record a failed review, inspect representative frames, confirm the product
gate remains closed, and verify that no follow-up generation begins without another exact preview
and authorization.

**Acceptance Scenarios**:

1. **Given** the replacement video still contains visible corruption, **When** the owner records
   `FAIL`, **Then** the system keeps the gate closed and makes no automatic retry.
2. **Given** a failed review, **When** the owner asks what to do next, **Then** the system reports the
   observed failure in plain language and proposes one bounded change set for a separately
   authorized attempt.

### Edge Cases

- The replacement candidate is technically valid but still fails identity or scene consistency.
- The local machine cannot complete the safer media profile within available memory.
- A generation finishes after the local polling window.
- A video container is playable but sampled frames show severe color or geometry corruption.
- The workflow content or source assets change after preview approval.
- The owner rejects the result even when automated media checks pass.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST preserve the failed workflow, artifact, provenance, and owner review.
- **FR-002**: The system MUST create a separately identified recovery candidate rather than
  replacing the failed workflow in place.
- **FR-003**: The recovery candidate MUST be based on reviewed reference behavior and MUST record
  the quality-related differences from the failed candidate.
- **FR-004**: The recovery preview MUST explain the intended stability improvements, source assets,
  output profile, and maximum call counts in plain language.
- **FR-005**: Preview and validation MUST make zero Creative AI and generation calls.
- **FR-006**: A real recovery attempt MUST require exact-scope, one-call authorizations before any
  network or generation request.
- **FR-007**: Failure, timeout, or ambiguous completion MUST NOT trigger automatic retry,
  replacement, fallback, or resubmission.
- **FR-008**: Reconciliation MUST query only an already-bound provider task and MUST have no
  submission capability.
- **FR-009**: Every retained video MUST be checked for playable media properties and represented by
  at least the first, middle, and final frame for owner review.
- **FR-010**: Technical success MUST remain separate from Human QA; only an explicit owner `PASS`
  may open the productization gate.
- **FR-011**: Each recovery result and owner decision MUST be append-only and linked to the exact
  source asset and workflow identities.
- **FR-012**: If Human QA still fails, the system MUST stop and require a new preview and
  authorization before another attempt.

### Key Entities

- **Recovery Candidate**: An immutable, separately identified generation configuration with source
  rationale, expected media profile, source assets, and content identity.
- **Recovery Attempt**: The bounded execution record connecting authorizations, Creative AI output,
  the generation task, retained artifact, and technical status.
- **Human Review**: The append-only owner decision and notes linked to one retained artifact.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A non-technical owner can inspect the recovery preview and understand the intended
  changes without reading node graphs or model configuration.
- **SC-002**: Candidate preparation, validation, and preview produce exactly zero model or
  generation calls.
- **SC-003**: One approved recovery attempt produces no more than one Creative AI request and one
  generation submission, including timeout and reconciliation paths.
- **SC-004**: Every retained recovery video is playable and has verified duration, dimensions,
  frame rate, codec, and at least three representative review frames.
- **SC-005**: The prior failed workflow, artifact, and review remain unchanged and independently
  traceable after the recovery candidate is added.
- **SC-006**: The productization gate opens only if the owner explicitly records `PASS`; a `FAIL`
  leaves it closed and triggers no automatic execution.
- **SC-007**: The target outcome is an owner-approved shot without the severe color blocks,
  stretching, or structural collapse observed in the failed baseline.

## Assumptions

- The same character image, scene image, and low-motion creative intent remain selected.
- The existing local Creative AI provider and installed Wan2.2 model remain available.
- The owner prefers a slower, safer candidate over the fastest possible generation.
- One recovery attempt is prepared at a time; broader parameter sweeps and automatic A/B generation
  are outside scope.
- Human approval cannot be guaranteed in advance; the system improves the candidate, presents
  evidence, and stops honestly until the owner decides.
