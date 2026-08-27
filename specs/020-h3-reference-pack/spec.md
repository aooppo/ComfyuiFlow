# Feature Specification: Remote H3 Reference Capability Pack

**Feature Branch**: `codex/018-zero-call-graph-evidence`  
**Created**: 2026-08-27  
**Status**: Approved for implementation

## User Scenarios & Testing

### User Story 1 - Publish an honest remote H3 capability (Priority: P1)

A local administrator can review and publish one `TRIAL` Capability Pack for the installed ComfyUI Partner Node's remote MiniMax H3 model without treating it as a local model or initiating a generation.

**Independent Test**: Canonical review and publication create exactly one immutable `TRIAL` receipt and make zero external generation calls.

**Acceptance Scenarios**:

1. **Given** the runtime exposes `MinimaxHailuo03ReferenceNode` with the `MiniMax H3` option, **When** the Pack is reviewed, **Then** its model, runtime target, node allowlist, and bounded envelope are shown with a server-calculated digest.
2. **Given** a Pack that claims H3 but changes the approved topology, fixed output settings, model key, or forbidden fields, **When** it is reviewed or published, **Then** it is rejected before any database or provider action.

### User Story 2 - Plan a frozen H3 reference graph (Priority: P1)

An authorized server planning path can turn bounded intent and already-frozen staged image names into an H3 graph that the zero-call validator can verify against the connected remote-node contract.

**Independent Test**: A five-reference H3 graph with 2K, 16:9, four seconds, seed, and no watermark validates from runtime facts using only read-only calls.

**Acceptance Scenarios**:

1. **Given** one to nine ordered frozen staging names, **When** H3 intent is compiled, **Then** the graph contains only fixed `LoadImage`, `MinimaxHailuo03ReferenceNode`, and `SaveVideo` topology and each image has a deterministic link position.
2. **Given** a missing, duplicate, unsafe, or count-mismatched staging name, **When** compilation is requested, **Then** it fails before a graph is produced.
3. **Given** H3's selected dynamic node option, **When** technical preflight runs, **Then** the nested dynamic input contract is checked and no `/prompt`, staging upload, authorization, or provider request occurs.

### Edge Cases

- The remote node is reachable but H3, 2K, four seconds, a required input, or the output node is no longer advertised: preflight fails closed.
- The Pack uses a generic compiler profile, another model, arbitrary output path, or arbitrary static graph data: review fails closed.
- A future execution path presents staged names different from the frozen graph: it must block before submission.

## Requirements

### Functional Requirements

- **FR-001**: The first Pack MUST identify H3 as a remote Partner Node capability, not a local model installation.
- **FR-002**: The H3 compiler topology, H3 model selector, watermark-off setting, MP4 output format, and output codec policy MUST be server-owned; a Pack MUST NOT contain raw graph data, output paths, or executable settings.
- **FR-003**: H3 planning MUST accept only ordered, server-frozen staged image names corresponding one-for-one to the bounded image asset identifiers.
- **FR-004**: H3 intent MUST constrain resolution, duration, ratio, and seed to the Pack envelope; Test A supports exactly 2K, 16:9, four seconds, seed `887034974`, and no watermark.
- **FR-005**: Runtime catalog normalization and zero-call validation MUST validate the active nested inputs selected by the remote H3 model option.
- **FR-006**: Publication, graph compilation, and preflight MUST remain zero-call for generation: no `/prompt`, upload/staging, authorization consumption, batch, attempt, worker, or AI-QA action.
- **FR-007**: The first Pack MUST publish as immutable `TRIAL`; it MUST NOT imply `READY`, paid authority, or Owner approval.

### Key Entities

- **Remote H3 Capability Pack**: An immutable reviewed declaration selecting the server-owned H3 recipe and bounded runtime envelope.
- **Frozen staging binding**: An ordered pair of asset identity and already-approved ComfyUI staging name used only by the server compiler.
- **Dynamic node contract**: The selected H3 model's nested runtime input definition derived from the read-only node catalog.

## Success Criteria

- **SC-001**: A reviewed H3 Pack can be canonicalized and published as one `TRIAL` receipt with zero provider, ComfyUI submission, or AI-QA calls.
- **SC-002**: Automated checks reject malformed Pack bindings and unsafe/mismatched staging names before any graph or external action.
- **SC-003**: A compiled five-image Test A graph passes the real remote node's read-only catalog validation with zero `/prompt` calls.
- **SC-004**: The exact Test A graph records 2K, 16:9, four seconds, seed `887034974`, no watermark, and MP4 output policy.

## Assumptions

- The installed Partner Node continues to expose `MinimaxHailuo03ReferenceNode` and `MiniMax H3`; every future use rechecks this at zero-call preflight.
- A later server-only planning route will obtain frozen staging names from persisted `ReferencePlan` inputs; browsers and AI never supply them as trusted data.
- This feature does not authorize, submit, or retain a Test A result.
