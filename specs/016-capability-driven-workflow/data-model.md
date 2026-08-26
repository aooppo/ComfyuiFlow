# Data Model: Simplified Gates and Capability-Driven Workflow

## Registry entities

### RuntimeProfile

- `id`, `version`, `name`
- `kind`: `COMFYUI_MCP | DIRECT_API`
- endpoint/reference and health-check policy
- credential reference only; never raw secret material
- lifecycle and timestamps

### ProviderProfile

- `id`, `version`, `name`
- `kind`: `LOCAL_COMPUTE | COMFYUI_PARTNER | DIRECT_PROVIDER | THIRD_PARTY_NODE`
- billing/authority identity and credential scope
- regions, terms, and availability metadata
- lifecycle and timestamps

### ModelProfile

- `id`, `version`, `family`, `displayName`
- model/version identifiers and media modality
- declared model capabilities

### AdapterProfile

- `id`, `version`, `protocol`
- implementation/factory key, for example `comfyui-mcp-v2`
- supported transport operations

### CompilerProfile

- `id`, `version`, `compilerKey`
- graph/node template reference or bounded compiler implementation
- `InputContract`
- validation rules, prompt-reference rules, output mapping
- provenance to discovery snapshot and reviewed publication
- `validatorRef` and deterministic compiler implementation version
- validated capability-envelope digest and runtime-contract digest

### GenerationImplementation

- immutable `id` and `version`
- references to exact Runtime, Provider, Model, Adapter, and Compiler versions
- `CostPolicy`
- lifecycle: `DISCOVERED | TRIAL | READY | DEPRECATED | DISABLED`
- evidence requirements and rollout metadata

An implementation version is selectable only in `TRIAL` for explicitly scoped validation or `READY`
for a capability-envelope slice carrying exact compiler, validator, runtime-readiness, and authorized
runtime/E2E PASS evidence. Provider-advertised support alone never creates READY. Historical plans
retain exact version references after deprecation.

## Discovery and publication entities

### DiscoveryCandidate

- runtime profile/version
- discovery timestamp and source digest
- normalized node identifier and schema
- dynamic input groups and cardinalities
- raw source snapshot reference
- status: `DISCOVERED | REVIEW_REJECTED | PUBLISHED`

Candidates are never normal generation choices.

### RegistryPublication

- exact candidate/source digest
- reviewed provider/model/adapter/compiler/cost identities
- reviewer and review timestamp
- validation notes and unresolved restrictions
- resulting immutable implementation version

### ImplementationEvidence

- exact implementation and compiler versions
- evidence kind: fixture, contract, runtime readiness, or authorized real execution
- outcome, artifact/provenance references, reviewer
- call count and cost record where applicable

Evidence from one version cannot promote another version.

## InputContract

- accepted modalities: image, video, audio, text
- min/max counts per modality
- dynamic-group rules
- required named inputs, if any
- cross-field invariants
- ordering and prompt-reference convention
- duration, resolution, ratio, and other bounded options
- output artifact contract

Example reference-node invariant: `imageCount + videoCount >= 1`; audio does not satisfy this invariant.

## CostPolicy

Tagged union:

- `MONETARY`: currency, deterministic estimate rule, maximum authorized amount, pricing version/source.
- `LOCAL_COMPUTE`: device/runtime class and optional resource estimate; no fabricated currency amount.
- `TEST_ZERO_CALL`: fixture-only, external call count must remain zero, forbidden in production resolution.

Unknown monetary cost blocks paid authorization. `LOCAL_COMPUTE` is not unknown monetary cost.

## Planning entities

### ShotRequirementSpecV3

- `shotId`, `version`, source Storyboard revision
- semantic intent and temporal/continuity requirements
- requirements grouped by purpose: character, product, environment, style, continuity, motion, audio, other
- each requirement has `necessity`: `REQUIRED | OPTIONAL | OMITTED`
- each requirement records reason and constraints
- unresolved requirements include a user-readable blocking reason

A no-person shot records character as omitted; it does not create an empty required character slot.

### PlanningInputBinding

- immutable binding id and purpose
- source union:
  - `PROJECT_FILE`
  - `SEMANTIC_ASSET_VERSION`
  - `CHARACTER_STATE_VERSION`
  - `UPSTREAM_FINAL_FRAME`
- exact source/version/hash reference
- modality and order within modality
- role label used by compiler/prompt
- required/optional provenance

### PlanningInputSnapshot

- requirement-spec version
- selected implementation/compiler versions
- ordered bindings
- omitted and unresolved requirements
- source and capability digests
- creation actor/time

Snapshots are immutable and are superseded, not edited.

### ReferencePlanV3

- exact Shot, Storyboard version, requirement spec, and planning snapshot refs
- compiler-neutral parameters: `durationSeconds`, `aspectRatio`, `resolution`, `seed`, `watermark`
- ordered bindings grouped by `IMAGE | VIDEO | AUDIO`
- each binding stores semantic `role`, exact source/version/hash, staged media kind, necessity,
  deterministic selection reason, and optional upstream artifact/frame lineage
- canonical `referencePlanDigest`

Planner/LLM output cannot contain Graph nodes, node IDs, endpoints, credentials, paths, output
prefixes, upload targets, or commands. `ReferencePlanV3` is immutable and superseded rather than
edited.

### MaterializedGraphSnapshotV3

- exact `ReferencePlanV3`, Generation Spec, implementation, compiler, validator, adapter, and runtime refs
- capability-envelope and runtime-contract digests
- canonical API-format Graph bytes/reference and `materializedGraphSha256`
- allowlisted required node classes and validated output node/media key
- staged-input manifest with logical safe names and content hashes
- validation result/code and creation time

The Graph is frozen before authorization. Submission must use these exact bytes; recompilation after
authorization is a contract violation.

### GenerationSpecV3

- exact Shot and source Storyboard revision
- exact `ShotRequirementSpecV3` and `PlanningInputSnapshot` versions
- exact implementation, runtime, provider, model, adapter, and compiler versions
- provider-neutral generation intent and expected output contract
- bounded non-secret compiled request preview and digest
- immutable input, dependency, and output hashes

`GenerationSpecV3` is the Shot Planner's mandatory handoff to execution. It is created automatically
during planning, has no Owner approval state, and cannot be bypassed by a raw prompt, graph, or adapter
payload from a Web route or Storyboard service.

### GenerationPlanV3

- exact shot set and Storyboard revisions
- exact immutable Generation Spec per selected Shot
- exact planning snapshot per shot
- exact implementation/compiler/runtime/provider versions
- compiled workflow/prompt digest and non-secret preview
- expected calls and `CostPolicy` estimate
- status: `DRAFT | VALID | BLOCKED | AUTHORIZED | SUBMITTED | COMPLETED | FAILED | CANCELLED`

### GenerationAuthorizationV3

- exact plan digest and shot set
- implementation/provider/cost-policy versions
- call cap and monetary cap when applicable
- expiry and actor
- explicit no-retry/no-fallback acknowledgement
- consumed call count and terminal state

Any material plan change invalidates the authorization.

### AuthorizationConsumptionV3

- exact authorization, target, Attempt id, operation, sequence, and consumed call/cost facts
- immutable creation timestamp before the associated network attempt
- unique idempotency scope preventing a second consumption for the same Attempt operation

### GenerationAttemptV3

- exact target, Generation Spec, ReferencePlan, materialized Graph snapshot, and authorization consumption
- `materializedGraphSha256`, compiler/validator/envelope/runtime-contract digests
- attempt number and idempotency key
- state: `CLAIMED | SUBMITTING | SUBMITTED | RECONCILING | SUCCEEDED | FAILED | AMBIGUOUS | CANCELLED`
- Provider/MCP task ID where known; submit/status/reconcile safe result codes and timestamps
- `providerCallCount` constrained to 0 or 1; no automatic retry/fallback target

Every retry creates a new authorization consumption and Attempt. Existing Attempts are never reset.

### ArtifactV3 / ArtifactTechnicalCheckV3 / ArtifactReviewFrameV3

- exact Attempt and Provider task lineage
- managed storage key, media type, bytes, and SHA-256
- FFprobe facts: duration, width, height, fps, codec, container, probe version, status/code
- exactly three deterministic `FIRST | MIDDLE | LAST` review frames with timestamp, storage key, and hash
- append-only processing events for download/probe/frame failures

Provider success without artifact, successful FFprobe, and three review frames is not technical completion.

### AiQaRunV3 / OwnerDecisionV3

- AI QA has its own authorization/call cap and Attempt/Artifact input digest
- advisory state includes `PASS | WARN | FAIL | AI_QA_UNAVAILABLE`
- Owner decision is exactly `PASS | FAIL | RISK_ACCEPTED`, bound to one Artifact hash and actor/time
- AI QA cannot create, replace, or infer Owner decision

### RetryPreviewV3

- zero-call preview bound to the failed Owner decision, prior Attempt/Artifact, current Shot inputs,
  proposed new ReferencePlan/Graph SHA, calls/cost/expiry/no-retry facts, and stale digest
- creates no Attempt and consumes no authorization

### AssemblyV3 / AssemblySourceV3

- exact ordered Owner-approved Artifact refs/hashes and source digest
- immutable output storage key/hash and FFprobe facts
- state and stable failure code
- idempotency key unique by project, Storyboard version, and ordered source digest

Repeated requests with an identical source digest return the existing assembly. Changed sources create
a new assembly and never overwrite historical outputs.

### TrialScopeApproval

- immutable approval ID and owner actor reference
- exact project, Storyboard, and Storyboard version/content-hash reference
- source V3 plan ID/digest used for the reviewed proposal
- scope digest, stable idempotency key, creation time, and expiry
- zero-call facts: `externalCalls = 0`, `generationAuthorized = false`, `executionAuthorized = false`
- one or more immutable `TrialScopeApprovalItem` rows

### TrialScopeApprovalItem

- exact Shot ID and Generation Spec ID/version
- exact implementation, runtime, provider, model, adapter, and compiler ID/version references
- compiled request digest, cost policy digest, and per-item composition digest
- unique within one approval by Shot ID

The item is eligible only for its exact Shot in the approval's exact Storyboard version while the
approval is unexpired and has no revocation event. A Registry entry with the same implementation ID
but a different version or composition digest does not match.

### TrialScopeRevocation

- immutable revocation ID and approval ID
- actor reference, reason code, idempotency key, and creation time
- one approval may have at most one effective revocation event; repeated readback returns it

Expiry and revocation never delete or update approval/item bytes. Re-approval creates a new approval
with a new idempotency key and retains all prior history.

## State transitions

```text
DiscoveryCandidate: DISCOVERED -> REVIEW_REJECTED
DiscoveryCandidate: DISCOVERED -> PUBLISHED

GenerationImplementation: DISCOVERED -> TRIAL -> READY -> DEPRECATED
GenerationImplementation: TRIAL|READY -> DISABLED

GenerationPlanV3: DRAFT -> VALID -> AUTHORIZED -> SUBMITTED -> COMPLETED
GenerationPlanV3: DRAFT|VALID -> BLOCKED
GenerationPlanV3: AUTHORIZED|SUBMITTED -> FAILED|CANCELLED

GenerationAttemptV3: CLAIMED -> SUBMITTING -> SUBMITTED -> SUCCEEDED
GenerationAttemptV3: SUBMITTING|SUBMITTED|RECONCILING -> FAILED|AMBIGUOUS|CANCELLED

ArtifactV3: DISCOVERED -> DOWNLOADED -> TECHNICALLY_VERIFIED -> OWNER_REVIEW_REQUIRED
ArtifactV3: DISCOVERED|DOWNLOADED -> TECHNICAL_FAILED

AssemblyV3: PLANNED -> RENDERING -> COMPLETED
AssemblyV3: PLANNED|RENDERING -> FAILED

TrialScopeApproval: ACTIVE -> EXPIRED (derived from time)
TrialScopeApproval: ACTIVE|EXPIRED -> REVOKED (derived from append-only revocation)
```

There is no Storyboard-approved or Shot-Plan-approved state in the new generation eligibility predicate.

## Migration rules

1. Preserve legacy rows and fixed-slot payload bytes for historical reads.
2. Seed explicit legacy identities and mark the fixed H3 implementation deprecated for new plans.
3. Create V3 records only for new/replanned work; never silently reinterpret an authorized or executed legacy plan.
4. Historical Fake records remain readable and labeled; no production-selectable V3 implementation may reference a test fixture adapter/provider.
5. Rollback changes routing flags only and does not delete V3 lineage.
6. Trial approval rollback stops new approval writes and ignores no historical row; history remains
   readable and no approval ever upgrades a Generation Implementation lifecycle.
7. Add V3 ReferencePlan, Graph snapshot, Attempt, consumption, artifact/probe/frame, QA/decision,
   retry preview, and assembly tables without modifying or deleting V1/V2 execution tables.
8. Preserve `minimax-h3-project-shot-4s-v1` bytes and SHA as a fixture/evidence reference; dynamic
   implementations and Attempts never use that single SHA as their implementation identity.
