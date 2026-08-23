# Feature Specification: CodexManager Local Test Provider

**Feature Branch**: `002-codexmanager-local-provider`

**Created**: 2026-08-23

**Status**: Approved

**Input**: User description: "Implement CodexManager local as the default test provider."

## User Scenarios & Testing

### User Story 1 - Use the local gateway for safe tests (Priority: P1)

As the local project owner, I want Creative AI test requests to select my running CodexManager
gateway by default so that I can validate the Director path without first funding an official
OpenAI API account.

**Why this priority**: It removes the immediate testing blocker while preserving the existing
zero-call and explicit-authorization boundaries.

**Independent Test**: With the local gateway available, inspect a dry-run and confirm that it names
the local provider, loopback destination, requested model, selected inputs, and zero provider calls.

**Acceptance Scenarios**:

1. **Given** the application is in its default test configuration, **When** the owner prepares a
   Director dry-run, **Then** the selected provider is `codexmanager-local` and no network request is
   made.
2. **Given** a valid local gateway credential is available only to the server process, **When** the
   owner separately authorizes one LIVE Director attempt, **Then** the request is sent only to the
   registered loopback gateway and consumes at most one authorization.

---

### User Story 2 - Fail honestly when the gateway is unavailable (Priority: P2)

As the project owner, I want missing credentials, an unreachable gateway, or incompatible behavior
to be reported explicitly so that the application never silently changes providers or claims an
official OpenAI result.

**Why this priority**: A local compatible gateway is operationally distinct from OpenAI and must
not weaken provenance or execution safety.

**Independent Test**: Remove each prerequisite in turn and confirm readiness reports the exact
blocker while dry-run remains zero-call and no fallback occurs.

**Acceptance Scenarios**:

1. **Given** the local credential is absent, **When** readiness is checked, **Then** the provider is
   disabled with a missing-credential reason and no alternative provider is selected.
2. **Given** the gateway returns an invalid or unsupported response, **When** a separately
   authorized attempt completes, **Then** the run fails schema validation without repair, retry, or
   fallback.

### Edge Cases

- The configured gateway destination is not a loopback address.
- The gateway process is healthy but does not expose the required Responses-compatible behavior.
- The requested model is unavailable or remapped by the gateway.
- A response omits usage, response identity, or other optional provider metadata.
- The credential is accidentally placed in a request, log, committed file, or dry-run response.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST register `codexmanager-local` as a provider distinct from official
  OpenAI.
- **FR-002**: The default Creative AI provider for local test and dry-run flows MUST be
  `codexmanager-local`.
- **FR-003**: The provider destination MUST be a fixed, server-controlled loopback URL and MUST NOT
  be configurable by ordinary request input.
- **FR-004**: The provider credential MUST be read only from the server environment and MUST never
  be persisted, logged, committed, or returned to callers.
- **FR-005**: Dry-run MUST disclose the provider identity, destination classification, requested
  model, inputs, schema, and expected call count while making zero provider calls.
- **FR-006**: LIVE execution MUST retain the existing environment gate and persisted one-call
  authorization requirements.
- **FR-007**: The system MUST NOT automatically fall back, retry, repair invalid structured output,
  or relabel a local gateway response as official OpenAI.
- **FR-008**: The local provider MUST use the same validated Director request and output contract as
  the official OpenAI provider.
- **FR-009**: Readiness MUST report missing credentials and unreachable or incompatible gateway
  behavior without exposing secrets.
- **FR-010**: Provider provenance MUST record `codexmanager-local`, the requested model, the resolved
  model when reported, and gateway metadata whose presence is actually verified.

### Key Entities

- **Local Provider Registration**: The trusted provider identity, loopback destination,
  capabilities, enabled state, and environment configuration names.
- **AI Run Provenance**: The requested and resolved model identities, provider identity, response
  identity, status, usage, and bounded authorization consumed by an attempt.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every default Director dry-run identifies `codexmanager-local` and records exactly zero
  provider calls.
- **SC-002**: Automated contract tests demonstrate image input, structured-output validation,
  missing-credential handling, and no-fallback behavior without making a real provider call.
- **SC-003**: An unavailable local gateway produces a specific disabled or failed readiness result
  within the configured readiness timeout and causes no paid request.
- **SC-004**: Secret scanning and response snapshots contain no local gateway credential.
- **SC-005**: Official OpenAI remains separately selectable and is never used automatically when the
  local provider fails.

## Assumptions

- CodexManager is installed on the same machine and exposes a trusted OpenAI-compatible gateway on
  `http://127.0.0.1:48760/v1`.
- The default local test model is the gateway-supported `gpt-5.4` alias. It is not claimed as a
  pinned snapshot; any resolved identity reported by the gateway is retained as provenance.
- Official OpenAI continues to use the independently registered `gpt-5.4-2026-03-05` snapshot.
- This feature adds one controlled local provider and does not permit arbitrary compatible URLs.
- Real model execution remains outside automated tests and requires the existing explicit LIVE
  authorization.
