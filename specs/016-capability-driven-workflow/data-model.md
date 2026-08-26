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

### GenerationImplementation

- immutable `id` and `version`
- references to exact Runtime, Provider, Model, Adapter, and Compiler versions
- `CostPolicy`
- lifecycle: `DISCOVERED | TRIAL | READY | DEPRECATED | DISABLED`
- evidence requirements and rollout metadata

An implementation version is selectable only in `TRIAL` for explicitly scoped validation or `READY` for normal planning. Historical plans retain exact version references after deprecation.

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
