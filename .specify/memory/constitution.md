<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles:
  - I. Prove the Video Path First
  - II. Separate Creative Intelligence from Generation
  - III. Provider-Neutral Contracts and Honest Capabilities
  - IV. Zero-Call Defaults and Bounded Live Execution
  - V. Durable Provenance and Verification
- Added sections:
  - MVP Technical Constraints
  - Delivery Workflow and Quality Gates
- Removed sections: none
- Deferred items: none
-->
# ComfyuiFlow Constitution

## Core Principles

### I. Prove the Video Path First
The project MUST validate the smallest real path from prompt and reference images to one playable
video shot before investing in broad product features. Phase 0A MUST discover an existing ComfyUI
MCP; if none is usable, Phase 0B MUST build the smallest application-owned MCP bridge over
confirmed ComfyUI HTTP/WebSocket contracts. Phase 0.5 MUST stop at an explicitly authorized,
single-shot vertical spike. Project UI, multi-shot orchestration, QA, and assembly MUST NOT be
treated as validated until this path succeeds.

Rationale: the dominant feasibility risk is reference-conditioned video quality and provider
integration, not CRUD or UI implementation.

### II. Separate Creative Intelligence from Generation
Creative tasks MUST follow `User Intent -> AI Director -> Storyboard -> Shot Planner ->
GenerationSpec`. Video execution MUST follow `GenerationSpec -> GenerationProvider -> ComfyUI
MCP`. Storyboard and domain services MUST NOT depend on ComfyUI node names, workflow JSON, or
provider-specific parameters. Frontend routes MUST NOT send unstructured prompts directly to
ComfyUI.

Rationale: the separation preserves continuity reasoning, testability, and future provider
replacement without turning the application into a thin ComfyUI UI.

### III. Provider-Neutral Contracts and Honest Capabilities
Asset understanding, AI Director, and AI QA MUST depend on a provider-neutral `AiModelProvider`
contract and validated structured schemas. OpenAI is implemented first for the vertical slice;
Qwen is added after the three-shot path unless multi-model comparison is explicitly promoted to
the active experiment. Provider capabilities MUST be registered and verified. The system MUST NOT
invent MCP tools, silently fall back to another model, or claim unsupported audio, video,
continuity, cancellation, or artifact behavior.

Rationale: compatibility at the HTTP or SDK layer does not guarantee equivalent modality,
structured-output, error, or billing behavior.

### IV. Zero-Call Defaults and Bounded Live Execution
All external AI and video-generation operations MUST default to DRY_RUN with zero provider calls.
Every LIVE batch MUST require a server-side gate and a persisted user authorization that names the
provider, model or workflow, targets, and maximum call count. Authorization MUST be consumed before
the network attempt. Failures, timeouts, and ambiguous submissions MUST fail closed and MUST NOT
trigger automatic fallback, retry, replacement, or resubmission. A real Phase 0.5 spike is limited
to exactly one authorized ComfyUI generation submission.

Rationale: paid or GPU-backed operations are irreversible cost and idempotency boundaries.

### V. Durable Provenance and Verification
Original assets MUST be preserved with SHA-256 metadata. `AiRun`, storyboard revisions,
`GenerationJob`, provider task identifiers, `Artifact`, and `QAResult` MUST be append-only; retries
and model changes create new records. Completion claims MUST be backed by automated tests and by
verification at the actual boundary: MCP request/response, persisted job state, playable media,
FFprobe facts, and explicit human review where required. Provider technical success MUST NOT be
reported as semantic or human quality approval.

Rationale: reproducibility and failure recovery require immutable lineage, not overwritten state.

## MVP Technical Constraints

- The product is a local, single-user TypeScript modular monolith: Next.js Web/API, a standalone
  single-concurrency worker, PostgreSQL/Prisma, Zod contracts, and local file storage.
- PostgreSQL is the business database. Binary assets MUST remain outside the database behind a
  `StorageProvider` abstraction.
- The application MUST use an MCP boundary for ComfyUI. An application-owned minimal bridge MAY
  translate the confirmed ComfyUI HTTP/WebSocket API into MCP tools when no external MCP exists.
- Phase 0B bridge scope is limited to workflow discovery/registration, submission, status/history,
  artifact retrieval, queue inspection, and cancellation only where the confirmed API supports it.
- OpenAI and Qwen credentials and endpoints MUST be environment-only and MUST NOT be stored,
  logged, committed, or returned through APIs.
- Redis, Kafka, Temporal, Kubernetes, multi-tenancy, billing, arbitrary compatible endpoints,
  automatic LoRA training, lip sync, music generation, and professional timeline editing are out
  of scope for the MVP.

## Delivery Workflow and Quality Gates

Large changes MUST follow Spec Kit in this order: Constitution -> Specify -> Clarify -> Plan ->
Tasks -> Analyze -> Implement -> Converge. Requirements MUST remain traceable to tasks and tests.

Delivery order is mandatory:

1. Phase 0A: discover and document existing MCP and local ComfyUI facts with zero generation calls.
2. Phase 0B: implement and contract-test the minimal MCP bridge if discovery finds no usable MCP.
3. Phase 0.5: run one bounded vertical spike only after exact LIVE authorization and a valid
   reference-conditioned workflow/model are available.
4. Phase 1+: begin Project/Asset UI and the remaining product phases only after the vertical spike
   has produced a validated playable MP4 or the user explicitly accepts the feasibility risk.

Each phase MUST pass formatting/linting, type checking, automated tests, production build where
applicable, database validation where applicable, and `git diff --check`. Each handoff MUST list
mock versus real boundaries, provider-call counts, commands run, human verification steps, and
remaining gaps. Unrelated or historical work MUST be preserved.

## Governance

This constitution is the highest-priority project governance artifact. Feature specs, plans,
tasks, code reviews, and phase completion reports MUST include a constitution compliance check.
Amendments require documented rationale, an updated Sync Impact Report, and user approval when the
change alters provider authority, scope boundaries, or phase gates.

Constitution versions follow semantic versioning: MAJOR for incompatible principle or authority
changes, MINOR for new principles or materially expanded policy, and PATCH for non-semantic
clarification. Compliance MUST be reviewed before implementation begins and again during
convergence.

**Version**: 1.0.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-23
