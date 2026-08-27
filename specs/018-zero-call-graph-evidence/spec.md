# Feature Specification: Per-Graph Zero-Call Technical Evidence

**Feature Branch**: `codex/018-zero-call-graph-evidence`
**Created**: 2026-08-27
**Status**: Approved for implementation
**Input**: User description: "Implement the next step: dynamic Graph zero-call validation and Graph-instance Evidence after merging capability-generation mainline."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate a frozen graph without generation (Priority: P1)

An operator can preflight a planned shot's frozen graph against the connected ComfyUI runtime before any generation authorization, provider submission, or billing event occurs.

**Why this priority**: A registry entry or node-name check alone cannot prove that the exact graph is executable today.

**Independent Test**: A fixture graph and a fixture node catalog can be validated without calling `/prompt`; invalid node inputs, invalid edges, unavailable nodes, or an unreachable runtime each produce a failed result.

**Acceptance Scenarios**:

1. **Given** a frozen graph and a healthy compatible runtime, **When** the operator starts technical preflight, **Then** the system records a PASS tied to that exact graph digest and runtime facts, without submitting a generation.
2. **Given** a frozen graph that uses a missing node or incompatible input, **When** preflight runs, **Then** it records a readable FAIL and does not create an authorization, attempt, or provider task.
3. **Given** a runtime that cannot be reached, **When** preflight runs, **Then** it records a failed runtime result without attempting generation.

---

### User Story 2 - Prevent evidence from being reused for changed work (Priority: P1)

An operator can create a real-execution authorization only when the exact frozen graph has current successful technical evidence for its runtime contract.

**Why this priority**: A successful check of one graph must not silently authorize a changed graph or a different runtime contract.

**Independent Test**: An authorization request succeeds only with a matching PASS evidence record; changing the graph digest, contract digest, or using a FAIL record is rejected.

**Acceptance Scenarios**:

1. **Given** matching current PASS evidence, **When** a batch is created with separately authorized limits and prices, **Then** the batch may be created but generation is still not submitted by preflight.
2. **Given** no matching PASS evidence or a changed graph digest, **When** a batch is requested, **Then** it is rejected before an attempt or consumption exists.
3. **Given** a prior PASS whose captured runtime catalog no longer matches the runtime seen at submit time, **When** submission is requested, **Then** it fails closed before staging inputs or calling `/prompt`.

---

### User Story 3 - Inspect technical evidence (Priority: P2)

An operator can read the immutable technical result for a graph and see the graph identity, runtime and catalog fingerprints, validator identity, timestamp, and safe failure reasons.

**Why this priority**: The evidence must be auditable without exposing credentials, paths, endpoints, or raw secrets.

**Independent Test**: Stored evidence can be queried by graph snapshot; writes and deletes are rejected by database append-only protection.

**Acceptance Scenarios**:

1. **Given** a completed preflight, **When** the operator inspects its evidence, **Then** the result identifies the graph, contract, runtime facts, catalog fingerprint, validator, outcome, and safe diagnostics.
2. **Given** a caller attempts to alter prior evidence, **When** the write is attempted, **Then** the datastore rejects it.

### Edge Cases

- A catalog response lacks one or more required node definitions.
- A graph includes an undeclared node, a forbidden metadata key, an invalid literal, an invalid link, a cycle, an orphan node, or an output mismatch.
- A catalog changes after a PASS, including one that keeps the same node class names but changes schemas.
- Preflight transport or malformed runtime responses must create safe failure evidence and never fall through to `/prompt`.
- Repeated preflight checks are preserved as separate evidence; no historic PASS is overwritten.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST fetch only read-only runtime facts and node definitions during technical preflight; it MUST NOT call `/prompt`, stage inputs, consume authorization, or create a generation attempt.
- **FR-002**: The system MUST validate the exact persisted frozen graph digest, runtime-contract digest, declared node classes, node input schemas and values, graph links, graph reachability, and declared output against the current runtime catalog.
- **FR-003**: The system MUST append a Graph Validation Evidence record for every completed PASS or FAIL preflight, including safe runtime and node-catalog fingerprints, validator identity, graph digest, contract digest, timestamp, outcome, and diagnostics.
- **FR-004**: The system MUST make Graph Validation Evidence append-only and prevent browser supplied PASS evidence.
- **FR-005**: The system MUST reject real batch creation unless every target has a matching PASS Graph Validation Evidence record for its frozen graph and runtime-contract digest.
- **FR-006**: The system MUST recheck that the current runtime facts still match the evidence at submission time and fail closed before staging or submitting when they do not.
- **FR-007**: The system MUST provide a server-owned preflight operation and a read-only evidence lookup without returning credentials, filesystem paths, endpoint URLs, or raw secrets.
- **FR-008**: The system MUST retain separate action-time authorization and provider pricing gates; technical preflight alone MUST NOT authorize generation.

### Key Entities

- **Graph Validation Evidence**: Immutable outcome of validating one frozen graph against one observed runtime and node catalog.
- **Frozen Graph Snapshot**: The canonical per-generation-spec graph whose digest identifies the exact graph evaluated and submitted.
- **Runtime Contract**: The allowed node classes and identity the graph must satisfy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Automated tests demonstrate both passing and failing graph preflight paths with zero `/prompt` calls.
- **SC-002**: Automated tests demonstrate that no authorization, attempt, or consumption can be created for a graph without matching PASS evidence.
- **SC-003**: Automated tests demonstrate that a changed graph digest or runtime catalog prevents submission before any input staging or `/prompt` call.
- **SC-004**: Every persisted evidence row is traceable to one frozen graph digest and runtime-contract digest, and database mutation attempts are rejected.

## Assumptions

- A ComfyUI runtime exposes `/system_stats` and `/object_info` read-only endpoints.
- The existing capability registry remains the sole source of allowed RuntimeContract node classes.
- Runtime preflight can run while the generation worker is stopped; no real provider credentials or paid calls are needed for automated verification.

## Clarification Record

- The feature validates persisted, server-owned frozen graphs only; it does not accept browser, worker, or LLM raw graphs.
- "Current" evidence means an exact graph SHA and runtime-contract digest match, plus a submission-time catalog fingerprint recheck. No time-to-live is introduced because no expiry policy is currently published.
- Runtime transport failures are recorded as safe FAIL evidence where a graph identity is available; they do not permit a batch or submission.
