# Feature Specification: Dynamic Hailuo 03 Capability V3

**Feature Branch**: `codex/016-dynamic-hailuo-v3`

**Created**: 2026-08-26

**Status**: Approved for zero-call implementation and verification. No Hailuo, ComfyUI `/prompt`,
AI QA, or other paid/provider call is authorized. Delivery MUST stop at a new exact one-shot LIVE
preview and fresh action-time authorization gate.

**Input**: Complete Feature 016 as the Future Dynamic Implementation. The fixed
`minimax-h3-project-shot-4s-v1` five-image Graph is provider evidence and a known-good regression
fixture only. New Hailuo 03 V3 work is planned as semantic `ReferencePlan` roles and deterministically
compiled into a validated, frozen, executable ComfyUI API Graph for each Attempt.

## Clarifications

### Session 2026-08-26

- Q: Should creating a Storyboard immediately queue one CodexManager Local `gpt-5.6-terra` Director
  call with a visible US$5 ceiling, three-Shot maximum, and no retry? → A: Yes. The button is
  explicitly labeled “Create and call AI”; clicking it is the exact one-call authorization.
- Q: Is the fixed five-image, 4-second, 9:16 Graph the formal Hailuo 03 V3 implementation? → A: No.
  It remains immutable provider evidence and a known-good regression fixture. Formal V3 directly
  implements deterministic dynamic Graph compilation for the validated capability envelope.
- Q: May the Director or another LLM emit raw ComfyUI JSON? → A: No. AI may select capability,
  bounded parameters, and semantic reference roles only. Server-owned compiler code exclusively
  materializes node classes, node IDs, connections, filenames, and output mappings.

## User Scenarios & Testing

### User Story 0 - Create and Immediately Generate an AI Storyboard Proposal (Priority: P1)

As the owner, after entering a title and creative brief I can review the exact AI Provider, model,
maximum three-Shot scope, US$5 ceiling, and no-retry rule, then click one explicit button that creates
the Storyboard and queues one real AI Director proposal.

**Independent Test**: With a mocked CodexManager Local Provider, click “Create and call AI” once and
verify that one Storyboard, one immutable initial revision, one Director Run, one one-use
authorization, and no more than one Provider attempt are created; no retry or Provider substitution
occurs.

**Acceptance Scenarios**:

1. **Given** valid title and creative brief, **When** the create form is shown, **Then** it displays
   CodexManager Local, `gpt-5.6-terra`, maximum 3 Shots, maximum US$5, one call, and no retry/fallback.
2. **Given** the owner clicks “Create and call AI”, **When** current price, references, and LIVE facts
   remain valid, **Then** the product atomically creates the initial Storyboard scope and queues one
   bounded Director Run for the resident Worker.
3. **Given** creation or Director authorization fails, **When** the response is shown, **Then** no
   external call occurs and the owner receives a recoverable business-language error without an
   automatic retry.
4. **Given** the Worker completes the proposal, **When** the Storyboard opens, **Then** the owner can
   inspect the proposal separately from the current revision and explicitly adopt or reject it.

---

### User Story 1 - Prepare Only What Each Shot Needs (Priority: P1)

As the owner, I can create or edit a Storyboard without first completing Project Assets, Semantic
Assets, Character State, or a separate Storyboard Preparation gate. Each Shot is analyzed on its own
and asks only for inputs that materially improve or enable that Shot.

**Why this priority**: A product close-up, empty environment, or text-only establishing shot must not
be blocked by character requirements that do not apply.

**Independent Test**: Create a Storyboard containing a text-only environment Shot, a product-reference
Shot, and a recurring-character Shot, then verify that each receives a different, explainable input
requirement without any project-wide prerequisite approval.

**Acceptance Scenarios**:

1. **Given** a Shot with no person, **When** planning runs, **Then** it has no Character or Character
   State requirement.
2. **Given** a Shot with no reference media, **When** planning runs, **Then** it may use a compatible
   text-to-video implementation rather than being forced into a reference implementation.
3. **Given** a Shot that needs stable character identity or appearance across Shots, **When** planning
   runs, **Then** the exact character identity or state is requested for that Shot only.
4. **Given** optional Project or Semantic Assets, **When** the owner selects them, **Then** they enrich
   the Shot plan without turning the entire asset workspace into a gate.

---

### User Story 2 - Select an Implementation by Capability (Priority: P1)

As the owner, I see the Workflow Agent choose an executable implementation from honest capabilities
rather than routing every Shot through one fixed five-reference H3 workflow.

**Why this priority**: ComfyUI can host local models, Partner/API Nodes, and third-party custom nodes;
the runtime used to execute a graph is not the same thing as the party providing and billing the
inference service.

**Independent Test**: Plan Shots requiring text-only generation, ordered image/video references, and
previous-final-frame continuity, then verify that each selects a compatible implementation or is
blocked with a stable reason.

**Acceptance Scenarios**:

1. **Given** a text-only Shot, **When** a verified text-to-video implementation is available, **Then**
   that implementation is selected without fabricating a reference.
2. **Given** one or more image or video references, **When** a compatible reference implementation is
   available, **Then** the references are ordered and described in the prompt without fixed business
   meanings such as “Image 1 is always a face”.
3. **Given** a previous-final-frame dependency, **When** a compatible frame-controlled implementation
   is available, **Then** the exact upstream frame is selected as an input dependency.
4. **Given** audio with no image or video for an implementation that forbids audio-only use, **When**
   planning runs, **Then** another registered implementation is selected or only that Shot is blocked.

---

### User Story 3 - Discover Safely, Publish Deliberately (Priority: P1)

As the operator, I can discover candidate video capabilities from a runtime without hand-writing an
application integration for every model, while ensuring that discovered candidates cannot be used
for paid work until they are reviewed and proven.

**Why this priority**: Fully manual registration duplicates the same runtime integration, while fully
automatic trust could expose unsafe nodes, unknown billing, or unsupported behavior.

**Independent Test**: Discover several local and remote-backed runtime nodes, verify they appear as
non-selectable candidates, publish one reviewed implementation, and prove only the published and
technically evidenced version can become selectable.

**Acceptance Scenarios**:

1. **Given** a newly discovered runtime capability, **When** discovery completes, **Then** it is marked
   DISCOVERED and cannot authorize or submit work.
2. **Given** a reviewed candidate with known provider, model, constraints, price policy, and safe
   compiler profile, **When** it is published, **Then** it becomes eligible for zero-call planning.
3. **Given** a published but unproven real implementation, **When** it is selected, **Then** it is
   clearly labeled FIRST REAL TRIAL until an authorized technical result is recorded.
4. **Given** a local model with no external monetary charge, **When** it is planned, **Then** it uses a
   local-compute cost policy rather than failing because no USD price exists.

---

### User Story 4 - Confirm Paid Work Once (Priority: P1)

As the owner, I can move from the current immutable Storyboard version to one zero-call execution
preview and confirm one exact paid video Batch without separately approving a Manifest, continuity
profile, keyframe plan, or Shot Plan.

**Why this priority**: Intermediate derived records are validation evidence, not independent creative
or spending decisions.

**Independent Test**: Start from a saved Storyboard head, plan a mixed set of READY and blocked Shots,
confirm only the READY subset, and verify the exact versions, inputs, dependencies, calls, and costs
are frozen atomically.

**Acceptance Scenarios**:

1. **Given** a current Storyboard head, **When** the owner opens generation planning, **Then** derived
   requirements, input snapshots, and immutable Generation Specs are produced without intermediate
   approval gates.
2. **Given** a zero-call preview, **When** the owner confirms selected READY or explicit TRIAL Shots,
   **Then** one authorization covers the exact generation and included AI QA ceiling.
3. **Given** a stale Storyboard, input hash, capability, price, or readiness fact, **When** confirmation
   is attempted, **Then** nothing is submitted and no partial Batch is created.
4. **Given** completed technical results, **When** execution finishes, **Then** final Owner review remains
   explicit before assembly or promotion.

---

### User Story 5 - Remove Fake from the Product (Priority: P2)

As the owner, I no longer see “Generate three shots”, “New Fake proposal”, or Fake as a selectable
Director or generation provider. Historical Fake evidence and internal zero-call test fixtures remain
readable without being callable from the product.

**Why this priority**: Fake is useful for automated verification but should not be confused with the
real creative and generation workflow.

**Independent Test**: Inspect all owner-facing Storyboard and Workflow Agent paths, call the retired
Fake proposal endpoint, and verify no new proposal/version can be created while historical records
still render.

**Acceptance Scenarios**:

1. **Given** the owner UI, **When** Storyboards and generation planning are opened, **Then** no Fake
   proposal or Fake provider option is present.
2. **Given** the retired Fake product endpoint, **When** it is called, **Then** it returns a stable
   removal response and creates no data.
3. **Given** automated tests or historical Fake records, **When** they are read, **Then** compatibility
   is preserved without exposing a product execution path.

---

### User Story 6 - Approve This First Real Trial Scope (Priority: P1)

As the owner, I can explicitly approve which Shots may use one exact `TRIAL` implementation for a
short-lived first real trial, without authorizing or submitting any video.

**Independent Test**: From a saved Storyboard whose three Shots resolve to the same `TRIAL`
implementation, approve only two Shots, replan, and verify only those two lose
`TRIAL_SCOPE_REQUIRED`; then expire or revoke the approval and verify the blocker returns while the
historical approval remains readable.

**Acceptance Scenarios**:

1. **Given** a zero-call plan containing `TRIAL_SCOPE_REQUIRED`, **When** the owner reviews and
   approves selected Shots, **Then** the record freezes the Storyboard/version, selected Shot IDs,
   exact implementation/provider/model/adapter/compiler/runtime versions, compiled request and cost
   digests, expiry, and idempotency key.
2. **Given** an active approval covering only part of the Storyboard, **When** planning runs again,
   **Then** only the approved Shot and exact implementation reference are passed into the resolver's
   trial allowlist; every unapproved Shot remains isolated and blocked.
3. **Given** an expired, revoked, composition-drifted, or different-version approval, **When**
   planning runs, **Then** it grants no trial scope and creates no replacement approval silently.
4. **Given** a repeated approval request with the same idempotency key and unchanged scope, **When**
   it is submitted again, **Then** the original record is returned and no extra approval or item is
   written; a changed scope under that key is rejected.
5. **Given** an approved trial scope, **When** the owner prepares a zero-call generation preview,
   **Then** the UI still requires a separate fresh action-time confirmation before any real Provider
   execution and the approval itself has made zero external calls.

---

### User Story 7 - Compile, Execute, Review, Retry, and Assemble Dynamic Hailuo 03 (Priority: P1)

As the owner, each Shot can use the Hailuo 03 capability envelope that its requirements need rather
than a fixed five-image Graph. I can see durable execution status, playable artifacts, technical
facts, review frames, AI QA advice when available, my final decision, retry history, and an
idempotently assembled downloadable result.

**Independent Test**: Using only fake transports and local media fixtures, compile and validate a
matrix covering image/video/audio reference counts, every duration boundary, every supported ratio,
and both resolutions; freeze one exact plan, execute one Attempt, persist artifact/FFprobe/three-frame
evidence, exercise unavailable AI QA, FAIL-to-retry preview with a new authorization and Attempt, and
assemble the owner-approved artifacts exactly once.

**Acceptance Scenarios**:

1. **Given** a Shot Spec and eligible semantic inputs, **When** planning runs, **Then** a deterministic
   `ReferencePlan` assigns exact assets to ordered scene, character, product, continuity-frame,
   reference-video, reference-audio, or other reviewed roles without guessing from filenames.
2. **Given** bounded capability parameters and a `ReferencePlan`, **When** the compiler runs, **Then**
   it emits an executable API-format Graph using only allowlisted loader, Hailuo 03, and saver nodes;
   identical input produces identical bytes and SHA-256.
3. **Given** a materialized Graph, **When** validation runs, **Then** node classes, edges, dynamic input
   cardinalities, duration, ratio, resolution, staged input names, output mapping, and forbidden fields
   are checked before an execution snapshot can be frozen.
4. **Given** a frozen execution snapshot and fresh exact authorization, **When** the Worker claims the
   target, **Then** it appends AuthorizationConsumption and Attempt before the single MCP submission,
   persists `materializedGraphSha256`, and never recompiles, retries, falls back, or substitutes a
   Provider after the authority boundary.
5. **Given** Provider completion, **When** the artifact pipeline runs, **Then** it stores the playable
   artifact, content hash, FFprobe facts, and first/middle/last review frames before technical success
   is displayed. `AI_QA_UNAVAILABLE` remains advisory and does not block Owner review.
6. **Given** Owner `FAIL`, **When** retry is requested, **Then** the first step is a zero-call retry
   preview. A new action-time authorization and a new Attempt are mandatory; the prior Attempt,
   consumption, artifact, QA, and decision remain append-only.
7. **Given** one Owner-approved artifact per required Shot, **When** assembly is requested repeatedly
   with the same source digest, **Then** one identical assembly is returned, while a changed source
   selection creates a new immutable assembly and never overwrites history.
8. **Given** a Storyboard page refresh or Worker restart, **When** the owner returns, **Then** persisted
   planning, Attempt, authorization, artifact, QA, retry, assembly, player, history, and download state
   are restored by polling rather than browser-only memory.

### Edge Cases

- A Shot mentions a person in prose but has no explicit identity requirement or selected character.
- A character is present in one Shot but absent from the preceding and following Shots.
- A reference implementation exposes zero UI slots but rejects execution when both image and video
  references are empty.
- Audio is present without an image or video, or the combined media count/duration exceeds the
  selected implementation's capability.
- A runtime exposes the same model through local execution, Partner billing, and a direct API.
- A discovered node changes its input schema after a candidate was reviewed.
- A provider price expires or a local runtime becomes unavailable after preview but before Batch
  confirmation.
- Web planning recognizes an implementation but the Worker does not have a matching runtime adapter.
- A generic runtime adapter is available but the selected compiler profile is missing or unsafe.
- One Shot is blocked while an unrelated branch of the Storyboard is READY.
- A trial approval covers two of three Shots that resolve to the same implementation.
- The exact implementation version, compiler composition, or cost digest changes after approval.
- A repeated approval arrives after an ambiguous browser response, or an approval is revoked after
  it has already expired.
- Historical V1/V2 plans still point to fixed H3 workflow and provider fields.
- The same semantic role is satisfied by several eligible assets; deterministic policy must explain
  the winner and preserve Owner overrides without filename guessing.
- Two Requests contain the same references in different arrival orders; canonical role/modality order
  must materialize identical Graph bytes.
- A video or audio reference is individually valid but pushes the total duration over 15 seconds.
- A Graph compiles but runtime `/object_info` no longer matches the frozen adapter/runtime contract.
- Authorization is consumed and MCP response is lost before a Provider task ID is persisted.
- Provider completes but artifact download, FFprobe, one review-frame extraction, or AI QA fails.
- Owner requests retry after the previous authorization expired or after Shot inputs changed.
- Assembly is requested twice concurrently or after one selected artifact is superseded.

## Requirements

### Functional Requirements

- **FR-001**: Project Assets, Semantic Assets, Character State, and Storyboard Preparation MUST be
  optional sources of evidence, not project-wide generation gates.
- **FR-002**: The system MUST derive requirements per Shot and MUST NOT require Character or Character
  State inputs when that Shot has no explicit character identity or appearance-continuity need.
- **FR-003**: Missing optional evidence MUST produce an explainable recommendation; only a selected
  implementation's true hard input requirement MAY block a Shot.
- **FR-004**: A saved current Storyboard version MUST be eligible for zero-call planning without a
  separate Storyboard approval, Manifest freeze, continuity approval, keyframe approval, or Shot Plan
  approval. The Shot Planner MUST still derive an immutable Generation Spec for every planned Shot;
  that record is an execution contract and MUST NOT become another owner approval gate.
- **FR-005**: Runtime, Provider, Model, Adapter, Compiler Profile, and Generation Implementation MUST
  be represented as separate identities with independent versions and lifecycle facts.
- **FR-006**: Provider MUST identify the inference authority, authentication/billing channel, and
  service responsibility; a Runtime that hosts execution MUST NOT automatically be treated as the
  Provider.
- **FR-007**: One Runtime MAY expose local models, remote Partner/API Nodes, and third-party custom
  nodes whose Provider and cost policies differ.
- **FR-008**: Adapter MUST describe how the application communicates with a Runtime or direct service;
  multiple compatible models on the same Runtime MUST be able to share one Adapter.
- **FR-009**: Compiler Profile MUST describe how provider-neutral Shot requirements become safe,
  model-specific inputs; it MUST NOT contain credentials or authorize execution.
- **FR-010**: Generation Implementation MUST bind exact Runtime, Provider, Model, Adapter, Compiler
  Profile, capabilities, constraints, cost policy, and technical evidence version.
- **FR-011**: Runtime discovery MUST create non-selectable DISCOVERED candidates and MUST NOT publish,
  authorize, or submit them automatically.
- **FR-012**: Publishing a candidate MUST require a reviewed Provider identity, Model identity,
  capability/constraint contract, cost policy, safe compiler profile, and readiness policy.
- **FR-013**: A published implementation without qualifying real technical evidence MUST remain an
  explicit TRIAL; promotion to READY MUST use append-only evidence from the exact version.
- **FR-014**: Local execution MUST support a LOCAL_COMPUTE cost policy with resource estimates and
  MUST NOT be rejected only because it has no external currency price.
- **FR-015**: External providers MUST use current bounded monetary price facts; missing or expired
  price facts MUST fail closed before confirmation.
- **FR-016**: Capability selection MUST distinguish text-to-video, ordered image/video reference,
  first-frame, first-plus-last-frame, previous-final-frame, and audio-reference behavior.
- **FR-017**: A reference implementation that requires at least one image or video MUST reject an
  empty image-and-video set even when its dynamic input UI permits zero entries per individual group.
- **FR-018**: Audio-only input MUST be rejected for implementations that require a supporting image
  or video; the system MAY choose another compatible registered implementation but MUST NOT silently
  alter the request.
- **FR-019**: Reference media MUST use deterministic connection order and provider-native labels such
  as Image 1 or Video 1; business semantics MUST be expressed through the compiled prompt and frozen
  input snapshot rather than universal fixed slot meanings.
- **FR-020**: Previous-final-frame dependencies MUST preserve the exact upstream plan, artifact,
  extracted frame, and hashes before a downstream Shot becomes runnable.
- **FR-021**: Planning MUST select implementations from registered capabilities without special-casing
  one fixed H3 workflow instance.
- **FR-022**: Model-generated arbitrary executable graphs, node classes, endpoints, credentials,
  paths, downloads, and commands MUST remain forbidden.
- **FR-023**: A generic Runtime Adapter MUST be registered once per protocol/version and shared by
  compatible local and remote-backed implementations; node/model differences belong to compiler
  profiles and implementation records.
- **FR-024**: Web planning and Worker execution MUST resolve Adapter and implementation identities
  from the same versioned server-owned composition and MUST fail before submission on any mismatch.
- **FR-025**: The owner MUST be able to confirm a selected READY/TRIAL Shot subset while blocked Shots
  and their dependent closure remain unsubmitted.
- **FR-026**: One paid Batch confirmation MUST freeze exact Storyboard/plan/input versions,
  implementation choices, dependencies, prices/resources, calls, maximum cost, and included AI QA.
- **FR-027**: Paid AI Director work MUST retain its own exact action-time confirmation; a Director
  preview or proposal MUST NOT authorize video generation.
- **FR-028**: Final Owner PASS, FAIL, or RISK_ACCEPTED MUST remain explicit and independent of technical
  readiness and AI QA.
- **FR-029**: The product MUST expose no Fake proposal button, Fake Director option, or Fake generation
  option; retired product endpoints MUST create no new Fake records.
- **FR-030**: Internal Fake fixtures and historical Fake records MAY remain for zero-call verification
  and backward-compatible reads only.
- **FR-031**: Existing fixed workflows, hashes, Generation Specs, Batches, artifacts, QA, decisions,
  and authorizations MUST remain readable and MUST NOT be rewritten destructively.
- **FR-032**: All automated implementation and acceptance MUST make zero external Director, AI QA,
  ComfyUI Partner, or video-provider calls.
- **FR-033**: Video execution MUST consume an exact immutable Generation Spec produced by the Shot
  Planner from the current Storyboard revision, requirement spec, planning input snapshot, and selected
  implementation. Frontend routes and Storyboard services MUST NOT submit unstructured prompts or
  compiler/runtime payloads directly to a generation adapter.
- **FR-034**: The create form MUST disclose the server-owned CodexManager Local `gpt-5.6-terra`
  profile, maximum three-Shot output, one-call maximum, US$5 ceiling, price expiry, and
  no-retry/no-fallback rule before the owner can submit.
- **FR-035**: Clicking “Create and call AI” MUST be the exact action-time Director authorization and
  MUST atomically persist the Storyboard scope, initial immutable revision, Director Run, exact
  references, and one-use authorization before the Worker can claim work.
- **FR-036**: The create request MUST use a stable idempotency key and MUST NOT create a second
  Storyboard, Run, authorization, or attempt when the browser repeats the same request.
- **FR-037**: The Worker MUST consume the one-use authorization and append the Attempt before the
  single CodexManager network request; failures and ambiguous outcomes MUST remain terminal unless
  the owner starts a new separately authorized Run.
- **FR-038**: AI proposal completion MUST NOT silently replace the current Storyboard revision; the
  owner MUST explicitly adopt or reject the immutable proposal.
- **FR-039**: The owner MUST have a user-visible, non-technical entry to approve a selected subset of
  Shots for one first real `TRIAL` scope; creating that scope MUST make zero external calls, MUST NOT
  promote an implementation to `READY`, and MUST NOT authorize or submit video.
- **FR-040**: A trial scope approval MUST freeze the exact Project, Storyboard and Storyboard version,
  selected Shot IDs, implementation/runtime/provider/model/adapter/compiler version references,
  compiled request digests, cost policy digest, expiry, actor, and stable idempotency key.
- **FR-041**: Planning MUST derive `allowedTrialRefs` separately for each Shot from only active,
  unrevoked, unexpired approvals whose exact composition digest still matches; it MUST NOT globally
  allow all `TRIAL` implementations or extend approval to another Shot or Storyboard version.
- **FR-042**: Trial approval creation and revocation MUST retain append-only audit history. Repeating
  an unchanged request with the same idempotency key MUST return the original record with no extra
  writes; changing scope under that key MUST fail closed.
- **FR-043**: Expired, revoked, version-drifted, or composition-drifted scopes MUST cease to affect
  planning. The owner MAY create a new explicitly reviewed approval while all prior records remain
  readable.
- **FR-044**: After a valid trial scope permits zero-call planning, the product MUST still present a
  separate real-execution preview naming exact Shots and versions, monetary cost or local-compute
  policy, call cap, expiry, and no-retry/no-fallback rule, followed by a fresh action-time execution
  confirmation.
- **FR-045**: Formal Hailuo 03 V3 MUST support the provider capability envelope of 0–9 ordered image
  references, 0–3 ordered video references, 0–3 ordered audio references, integer duration 4–15
  seconds, ratios `adaptive`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, and resolutions `768P`
  and `2K`, subject to `imageCount + videoCount >= 1` and audio-not-alone invariants for the Reference
  node. Per-reference media validation remains part of readiness.
- **FR-046**: A capability tuple MAY be marked `READY` only when the exact compiler/version,
  validator/version, adapter/runtime contract, and capability-envelope slice have passing compiler,
  validator, runtime-readiness, and authorized runtime/E2E evidence. Provider-advertised capability
  alone MUST remain `TRIAL` or `BLOCKED`.
- **FR-047**: Implementation identity MUST be the immutable compiler/version plus validated capability
  envelope digest and adapter/runtime contract digest. A single fixed Workflow SHA MUST NOT identify
  the dynamic implementation.
- **FR-048**: Every execution Attempt MUST persist the exact frozen materialized Graph or immutable
  reference, `materializedGraphSha256`, compiler/validator versions, capability-envelope digest,
  runtime-contract digest, ReferencePlan digest, Generation Spec, authorization, and staged-input
  manifest. Recompilation after authorization is forbidden.
- **FR-049**: `ReferencePlan` MUST be a first-class immutable provider-neutral record with ordered
  image/video/audio bindings, semantic roles, exact source/version/hash, selection reason, necessity,
  and upstream artifact/frame lineage when applicable.
- **FR-050**: The deterministic compiler MUST own all executable Graph structure and use allowlisted
  node classes only. LLM/Planner output is limited to capability choice, bounded parameters, and
  semantic reference roles and MUST be rejected if it contains raw Graph, node, endpoint, credential,
  path, upload target, output prefix, or command fields.
- **FR-051**: Graph validation MUST fail closed on unsupported cardinality, duration, ratio,
  resolution, loader type, connection, staged input, output mapping, node class, runtime-contract
  drift, or secret/path leakage. `>9` images, `>3` videos, `>3` audios, duration outside 4–15, and
  unsupported resolution are stable `BLOCKED` cases.
- **FR-052**: V3 Worker execution MUST append one AuthorizationConsumption and one Attempt before a
  network attempt, enforce call/cost/expiry/idempotency caps, submit the frozen Graph through the MCP
  V3 boundary, and treat timeout or ambiguous submission as terminal without automatic retry.
- **FR-053**: A completed Attempt MUST persist one or more immutable Artifacts with SHA-256, FFprobe
  duration/dimensions/fps/codec/container facts, and exactly three deterministic first/middle/last
  review frames or a stable technical failure. Provider success without this evidence is not technical
  completion.
- **FR-054**: AI QA is advisory. `AI_QA_UNAVAILABLE` MUST remain non-blocking for explicit Owner
  `PASS`, `FAIL`, or `RISK_ACCEPTED`, and no system action may fabricate or infer the Owner decision.
- **FR-055**: Owner `FAIL` MUST expose a zero-call retry preview. Retry requires a new authorization,
  creates a new Attempt, consumes no prior grant, and preserves all previous lineage; no blind retry
  or automatic resubmission is allowed.
- **FR-056**: Assembly MUST be idempotent by exact ordered approved-artifact/source digest, require an
  explicit terminal Owner decision for every source, persist immutable output/probe/hash lineage, and
  expose playable and downloadable results without overwriting prior assemblies.
- **FR-057**: Storyboard execution UI MUST restore persistent state after reload, poll boundedly while
  work is active, stop polling in terminal states, and expose player, technical facts, review frames,
  AI QA state, Owner decision, retry preview/history, Attempt history, assembly history, and download.
- **FR-058**: The immutable fixed-five `minimax-h3-project-shot-4s-v1` Graph and SHA MUST remain
  byte-for-byte preserved as known-good regression/provider evidence and MUST NOT be selectable as the
  formal dynamic Hailuo 03 V3 implementation.

### Key Entities

- **Runtime Profile**: Versioned execution environment and protocol boundary, such as a local graph
  runtime or direct service runtime.
- **Provider Profile**: Inference authority, authentication channel, billing responsibility, region,
  and readiness identity.
- **Model Profile**: Provider-owned model family, version, and advertised modality identity.
- **Adapter Profile**: Versioned communication behavior shared by compatible implementations on a
  runtime or direct protocol.
- **Compiler Profile**: Trusted mapping from provider-neutral requirements and ordered inputs to one
  model/node input contract.
- **Generation Implementation**: Executable combination of Runtime, Provider, Model, Adapter,
  Compiler Profile, capabilities, constraints, cost policy, and evidence.
- **Implementation Discovery Candidate**: Non-selectable runtime observation awaiting review,
  publication, and evidence.
- **Shot Requirement Specification**: Immutable provider-neutral creative, input, timing, and
  dependency requirements for one Shot.
- **Planning Input Snapshot**: Exact optional raw/semantic inputs, ordering, roles, versions, hashes,
  and dependency references used for planning and confirmation.
- **Generation Spec V3**: Immutable provider-neutral Shot Planner output that binds one Shot revision,
  requirement specification, planning input snapshot, selected implementation, bounded compiled
  request digest, and expected output without becoming an independent approval decision.
- **Reference Plan V3**: Immutable ordered semantic-to-media plan that binds exact image, video,
  audio, continuity-frame, character, scene, product, and other reviewed roles to source hashes.
- **Materialized Graph Snapshot V3**: Canonical executable ComfyUI API Graph, safe staged-input
  manifest, compiler/validator/runtime contract identities, and SHA-256 frozen before authorization.
- **Generation Attempt V3**: Append-only single MCP submission boundary for one frozen Graph and one
  AuthorizationConsumption, with provider task/reconcile facts and terminal result.
- **Artifact/Review Evidence V3**: Append-only playable output, FFprobe facts, content hash, and three
  review frames belonging to one Attempt.
- **Owner Decision V3**: Explicit PASS, FAIL, or RISK_ACCEPTED for one exact Artifact; it never mutates
  AI QA or technical evidence.
- **Assembly V3**: Idempotent immutable output derived from an ordered set of Owner-approved artifacts.
- **Trial Scope Approval**: Append-only owner decision allowing selected Shots in one exact
  Storyboard version to use specific immutable `TRIAL` implementation compositions until expiry.
- **Trial Scope Revocation**: Append-only audit event that stops one approval from affecting future
  planning without deleting or rewriting the approval.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In 100% of no-person Shot tests, planning creates zero Character and Character State
  blockers.
- **SC-002**: Planning identical normalized inputs 100 times produces identical requirements,
  implementation choices, input order, dependency order, costs/resources, reasons, and hashes.
- **SC-003**: Text-only, reference-media, and previous-final-frame scenarios each select a compatible
  implementation or return one stable, explainable blocker with zero external calls.
- **SC-004**: Every newly discovered capability remains non-selectable until all publication facts are
  reviewed; zero discovered-only candidates can be confirmed for paid work.
- **SC-005**: Adding a compatible model to an existing runtime requires zero duplicated owner-facing
  workflow and zero model-specific submission registration in separate Web and Worker paths.
- **SC-006**: An all-ready normal path contains no mandatory approval between saving the Storyboard
  version and one paid Batch confirmation.
- **SC-007**: Confirming a READY subset creates either all exact Batch records for that subset or none;
  blocked and unselected Shots receive zero submissions.
- **SC-008**: Product UI and callable product APIs create zero new Fake proposals or Fake generation
  records, while 100% of retained historical records remain readable.
- **SC-009**: Every automated validation run records zero external AI and video-provider calls.
- **SC-010**: Every real artifact still requires one explicit final Owner decision before final
  assembly or promotion.
- **SC-011**: In 100% of new V3 execution tests, every submitted target references one exact immutable
  Generation Spec and no owner-facing route can bypass that record with a raw prompt or runtime payload.
- **SC-012**: For a Storyboard of up to 20 Shots in a zero-call planning fixture, the owner receives a
  complete planning preview within 2 seconds in at least 95 of 100 measured runs.
- **SC-013**: In 100% of mocked create-and-call tests, one click creates exactly one Storyboard and
  at most one Director attempt, while stale price/reference/LIVE facts create zero Provider calls and
  repeated requests create no duplicate rows.
- **SC-014**: In all partial-scope tests, approved Shots alone lose `TRIAL_SCOPE_REQUIRED`; unapproved,
  expired, revoked, version-drifted, and composition-drifted Shots remain blocked with zero external
  calls.
- **SC-015**: Repeating an identical trial approval at least 10 times with one idempotency key leaves
  exactly one approval and the original item count, while all historical approvals and revocations
  remain readable.
- **SC-016**: The zero-call compiler matrix produces valid deterministic Graphs for image counts 1,
  5, and 9; video/audio combinations up to 3 each; durations 4, 5, 10, and 15; every supported ratio;
  and both resolutions. Repeating each case 100 times yields one Graph SHA per case.
- **SC-017**: Every `>9` image, `>3` video, `>3` audio, sub-4/over-15 duration, unsupported ratio,
  unsupported resolution, empty visual, and audio-only reference case is `BLOCKED` before authorization
  with zero external calls and a stable reason.
- **SC-018**: In 100% of fake-transport Worker tests, exactly one consumption and one Attempt precede
  one submission; ambiguous/timeout failures make zero retries and preserve the frozen Graph SHA.
- **SC-019**: In 100% of completed fake-transport runs, the persisted artifact SHA, FFprobe facts,
  three review frames, QA status, Owner decision, and UI readback refer to the same Attempt.
- **SC-020**: FAIL-to-retry creates zero Provider calls during preview, rejects reuse of the old
  authorization, and creates exactly one new Attempt only after a new authorization.
- **SC-021**: Ten identical concurrent/repeated assembly requests for one source digest return one
  assembly record and identical download bytes; changed source digest preserves the first and creates
  a new record.
- **SC-022**: No capability-envelope slice is reported READY unless evidence storage contains PASS
  compiler, validator, runtime-readiness, and runtime/E2E records for that exact identity.

## Assumptions

- The first formal implementation family is dynamic Hailuo 03 Reference-to-Video. The architecture
  remains provider-neutral and H3 receives no privileged Web/Worker bypass.
- ComfyUI is treated as a Runtime; ComfyUI Partner is one Provider/billing channel among local compute
  and future direct providers.
- Discovery observes capabilities but cannot independently establish price, trust, or real technical
  success.
- Direct-provider protocols may require separate Adapter profiles; compatible ComfyUI nodes share one
  generic ComfyUI Adapter and use distinct Compiler Profiles.
- Existing 015 Workflow Agent behavior remains available only for historical compatibility and
  controlled rollback while 016 becomes the new default flow.
- Current local `/object_info` and source inspection may be used as zero-call runtime-contract evidence;
  it is not runtime/E2E generation evidence and cannot promote the full envelope to READY.
- No real discovery publication, TRIAL, Provider submission, AI QA, or paid validation is authorized
  by this implementation turn.
- A trial scope approval defaults to 30 minutes, may be re-approved with a new idempotency key after
  expiry or revocation, and never substitutes for the later real-execution confirmation.
