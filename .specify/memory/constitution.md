<!--
Sync Impact Report
- Version change: 2.0.0 -> 3.0.0
- Modified principles:
  - I. Prove the Video Path First -> I. One Dynamic Capability Mainline.
  - II. Separate Creative Intelligence from Generation: execution now freezes capability identities
    rather than depending on a GenerationProvider abstraction.
  - III. Provider-Neutral Contracts and Honest Capabilities: RuntimeContract is a first-class,
    evidence-scoped capability identity.
  - IV. Zero-Call Defaults and Bounded Live Execution: retained with independent video and AI-QA
    authorization, price, expiry, and consumption boundaries.
  - V. Durable Provenance and Verification: canonical append-only Generation lineage replaces all
    historical generation record families.
- Added sections: Canonical Data Reset and Recovery in MVP Technical Constraints.
- Removed sections: legacy GenerationProvider execution and dual-read compatibility.
- Deferred items: none
-->
# ComfyuiFlow Constitution

## Core Principles

### I. One Dynamic Capability Mainline
The product MUST expose exactly one production generation chain:
`GenerationSpec -> exact GenerationImplementation -> frozen MaterializedGraphSnapshot ->
AdapterRegistry -> Adapter -> Provider`. A capability is selected only during planning; execution
MUST consume frozen identity references and MUST NOT branch on provider nicknames, workflow IDs,
or implementation profiles. Historical execution services, records, routes, and compatibility
reads MUST be removed rather than retained as a fallback.

Rationale: a single explicit chain makes capability selection explainable, removes accidental
fallbacks, and prevents prior implementation semantics from surviving a destructive replacement.

### II. Separate Creative Intelligence from Generation
Creative tasks MUST follow `User Intent -> AI Director -> Storyboard -> Shot Planner ->
GenerationSpec`. Video execution MUST follow the canonical mainline in Principle I. Storyboard and
domain services MUST NOT depend on ComfyUI node names, workflow JSON, or provider-specific
parameters. Frontend routes MUST NOT send unstructured prompts or raw graphs directly to ComfyUI.

Rationale: the separation preserves continuity reasoning, testability, and future provider
replacement without turning the application into a thin ComfyUI UI.

### III. Provider-Neutral Contracts and Honest Capabilities
Asset understanding, AI Director, and AI QA MUST depend on a provider-neutral `AiModelProvider`
contract and validated structured schemas. OpenAI is implemented first for the vertical slice;
Qwen is added after the three-shot path unless multi-model comparison is explicitly promoted to
the active experiment. Provider capabilities, RuntimeContracts, compilers, validators, adapters,
models, and implementations MUST be registered and cross-validated. A RuntimeContract is owned by
a capability and defines allowed node and runtime facts. The system MUST NOT invent MCP tools,
silently fall back to another model, accept a browser/worker/LLM raw graph, or claim unsupported
audio, video, continuity, cancellation, or artifact behavior.

`READY` MUST mean that the exact implementation/compiler/validator/adapter/runtime identity has
at least one authorized real E2E success within its published capability envelope. It applies to
that implementation's published envelope, not to every parameter combination, and product surfaces
MUST disclose both the real validation baseline and that other combinations are not individually
tested. Real success appends server-read evidence only; an operator MUST explicitly promote the
implementation after a real AI-QA result and an Owner `PASS`.

Rationale: compatibility at the HTTP or SDK layer does not guarantee equivalent modality,
structured-output, error, or billing behavior.

### IV. Zero-Call Defaults and Bounded Live Execution
All external AI and video-generation operations MUST default to DRY_RUN with zero provider calls.
Every LIVE batch MUST require a server-side gate and a persisted user authorization that names the
provider, model or workflow, targets, and maximum call count. Authorization MUST be consumed before
the network attempt. Failures, timeouts, and ambiguous submissions MUST fail closed and MUST NOT
trigger automatic fallback, retry, replacement, or resubmission. A real Phase 0.5 spike is limited
to exactly one authorized ComfyUI generation submission.

Video submission and AI QA are separate authority and cost boundaries. Their independent limits,
prices, expiry, and consumption records MUST be disclosed before batch creation; both are consumed
before their first network byte. Missing LIVE enablement, credentials, healthy provider status, or
current price facts MUST block preview before a batch is created.

Rationale: paid or GPU-backed operations are irreversible cost and idempotency boundaries.

### V. Durable Provenance and Verification
Original assets MUST be preserved with SHA-256 metadata. Planning inputs, specs, reference plans,
materialized graphs, plans, authorizations, batches, targets, consumptions, attempts, artifacts,
AI-QA runs/results, Owner decisions, retry previews, and assemblies MUST be append-only; retries
and model changes create new records. Completion claims MUST be backed by automated tests and by
verification at the actual boundary: MCP request/response, persisted attempt state, playable
media, FFprobe facts, and explicit human review where required. Provider technical success MUST
NOT be reported as semantic or human quality approval.

Only a server-owned action that reads persisted Attempt, Artifact, consumption, price, FFprobe,
three-frame, AI-QA, and Owner-decision records may append authorized real-execution evidence. A
browser MUST NOT assert its own PASS evidence. AI QA remains advisory and MUST NOT infer an Owner
decision, trigger a retry, or trigger assembly.

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
- The Capability Registry is the sole production registration source. Its first released schema
  version is 1; product type and route names MUST NOT encode V1, V2, V3, provider codenames, or
  retired workflow variants.
- Database rollback is Git reversion plus a verified database and storage backup restore. A reset
  MUST stop relevant processes first, produce an inspectable PostgreSQL dump and storage SHA-256
  manifest, move source and generated material to timestamped offline backup, then create an empty
  product store. Backups MUST NOT be readable by product code.
- Fake providers are test-only dependency injections. They MUST NOT be registered, configured,
  rendered, or exposed in production UI or APIs.
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

**Version**: 3.0.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-27
