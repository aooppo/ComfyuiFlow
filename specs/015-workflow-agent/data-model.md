# Data Model: Workflow Agent and Cross-Shot Execution

All changes are project-scoped and non-destructive. Frozen plans, evidence, attempts, proposals,
materialized inputs, artifacts, QA, and decisions are append-only or protected by identity guards.

## New Enums

- `GenerationExecutorType`: `COMFYUI_GRAPH`, `DIRECT_PROVIDER_API`.
- `GenerationImplementationStatus`: `DISCOVERED`, `TRIAL`, `READY`, `BLOCKED`, `RETIRED`.
- `GenerationEvidenceSourceType`: `REAL_GENERATION_JOB`, `LEGACY_REAL_ARTIFACT`,
  `STATIC_VALIDATION`, `READINESS`.
- `GenerationTechnicalResult`: `TECHNICALLY_VALID`, `TECHNICAL_FAILED`, `AMBIGUOUS`.
- `ShotExecutionPlanLifecycle`: `DRAFT`, `FROZEN`, `INVALIDATED`, `SUPERSEDED`.
- `ShotPlanningOutcome`: `READY`, `TRIAL`, `BLOCKED`, `WAITING_FOR_UPSTREAM_REPAIR`.
- `GenerationExecutionDisposition`: `EXECUTE`, `REUSE_ARTIFACT`.
- `GenerationEngineVersion`: `LEGACY_V1`, `WORKFLOW_AGENT_V1`.
- `QaContinuationMode`: `AUTO_CONTINUE_AFTER_QA_PASS`, `PAUSE_AFTER_EACH_SHOT`.
- `StoryboardDirectorRunKind` / `StoryboardDirectorProposalKind`: `STORYBOARD`, `SHOT_REPAIR`.
- `RepairAction`: `CHANGE_IMPLEMENTATION`, `RELAX_REQUIREMENT`, `REWRITE_SHOT`, `SPLIT_SHOT`,
  `REPLACE_ASSET`.

## New Entity: GenerationImplementation

One persisted identity for a versioned capability/provider/model/executor combination.

- Identity: `id`, `implementationKey`, `version`.
- Registry identity: `providerProfileId`, `modelProfileId`, `executorType`, `adapterId`,
  `adapterVersion`, `registrySha256`.
- Immutable definitions: capability, constraint, pattern, runtime, and compiler snapshot hashes.
- Lifecycle: `status`, `statusReasonCode`, `statusUpdatedAt`, `createdAt`, `retiredAt`.
- Uniqueness: `(implementationKey, version)`.
- Relations: evidence and Shot execution plans.

Definition fields are immutable. Only validated lifecycle transitions are allowed; registry removal
retires rather than deletes the row.

## New Entity: GenerationImplementationEvidence

One append-only technical fact for an exact Implementation version.

- Identity/source: `id`, `implementationId`, `sourceType`, `sourceId`.
- Optional lineage: `jobId`, `artifactId`, `planTemplateSha256`.
- Runtime identity: `runtimeSnapshotHash`, `catalogSnapshotHash`.
- Outcome: `technicalResult`, `providerCallCount`, `recordedAt`.
- Uniqueness: `(implementationId, sourceType, sourceId)`.

Only submitted real same-version attempts count toward success statistics/promotion. Static and
readiness evidence remains auditable but cannot promote READY.

## New Entity: ShotExecutionPlan

One immutable plan template for one GenerationSpec under exact planning inputs.

- Scope: `id`, `projectId`, `generationPlanVersionId`, `generationSpecId`, `implementationId`.
- Planning identity: `planningInputHash`, `requirementsHash`, `capabilitySnapshotHash`.
- State: `lifecycleStatus`, `planningOutcome`, `blockerCode`.
- Executor: `executorType`, `adapterId`, `adapterVersion`, discriminated `payloadJson`.
- Hash: project-scoped indexed `planTemplateSha256`.
- Budget: `estimatedCostMicros`, `maximumCostMicros`, `currency`, generation/QA call estimates.
- Lifecycle: `frozenAt`, `invalidatedAt`, `invalidationCode`, `supersededById`.
- Uniqueness: `(generationPlanVersionId, generationSpecId, planningInputHash)`.
- Exact relation: composite foreign key from `(generationPlanVersionId, generationSpecId)` to a
  same-version GenerationSpec uniqueness pair.

Payload, planning hashes, executor, implementation, cost, and template hash never change after
freeze. Materialized execution hashes are Batch-specific and do not live here.

## GenerationSpec Extensions

- `contractVersion` defaults to `generation-spec-v1` for old/current writers.
- `requirementSpecJson` and `requirementHash` are populated for V2.
- V1 `positivePrompt` and `capabilityRequirements` become nullable for V2 rows.
- Add uniqueness `(generationPlanVersionId, id)` for exact plan linkage.

Exactly one payload family is valid: complete V1 fields or complete V2 requirement fields. Existing
rows are not rewritten, and readers branch on contract version.

## GenerationPlanVersion Extensions

- `planningPreferencesJson` and `planningPreferencesHash` capture Project/Storyboard/Shot defaults,
  AUTO/PREFERRED/LOCKED choices, prompt overrides, skip flags, and accepted relaxations.
- Existing DB immutability means preferences are present on INSERT of a new version, never patched.

## Project and Storyboard Extensions

- Project: `generationDefaultsJson`, `generationPolicyJson`, `continuationMode` defaulting to
  `AUTO_CONTINUE_AFTER_QA_PASS`, and optional maximum cost micros/currency.
- Storyboard: `generationDefaultsJson` below per-Shot choice and above Project default.

## Director Extensions

- Run: `runKind`, `sourceStoryboardVersionId`, `blockedShotKey`, `repairAction`, `impactHash`.
- Proposal: `proposalKind`, affected Shot keys, normalized repair payload, `impactHash`.
- Existing Authorization, Attempt, ProposalDecision, head CAS, and stale-reference checks are reused.
- Add append-only/identity guards for repair evidence fields and proposal/decision/attempt identity.

## GenerationBatch Extensions

- `engineVersion`, `estimatedCostMicros`, `maximumCostMicros`, `currency`.
- `pricingSnapshotHash`, `continuationPolicyHash`, nullable `supersedesBatchId`.
- Legacy `providerProfileId`, `modelId`, `workflowId`, `workflowVersion`, and `workflowSha256` become
  nullable only for Workflow Agent Batches and remain populated for V1.
- Cost micros are persisted as integer/BigInt and converted to decimal strings before canonical hash.

## GenerationBatchTarget Extensions

- `shotExecutionPlanId` binds the exact frozen plan.
- `executionDisposition`: `EXECUTE` or `REUSE_ARTIFACT`.
- `sourceArtifactId` is required for reuse and forbidden for execute.
- `executionInputSnapshotJson`, `materializedInputHash`, and `materializedExecutionSha256` are written
  exactly once after dependency materialization.
- Existing compiled prompt and slot manifest fields become nullable legacy projections.

Draft/Assembly readers must accept both `target.job.artifacts` and exact `target.sourceArtifact` so a
reused Shot is not reported missing and is never replaced by a globally newer artifact.

## Authorization and Job Extensions

- `ExecutionAuthorization`: `maximumCostMicros`, `currency`, `pricingSnapshotHash`; scope hash includes
  exact target plans/dependency policy/call ceilings.
- `AuthorizationConsumption`: `reservedCostMicros`, `materializedPlanSha256`.
- `GenerationJob`: optional `providerIdempotencyKey` distinct from provider-returned task ID for
  direct-provider compatibility.

Reservation and consumption commit before the network attempt and are not refunded after failure or
ambiguity.

## Artifact and QA Extensions

- `ArtifactReviewFrame`: nullable `frameIndex BigInt`, `pts BigInt`, `timeBaseNumerator`, and
  `timeBaseDenominator`; dependency extraction uses `dependency-final-frame-v1`, separate from QA.
- `AiQaResult`: `continuationDecision`, `continuationPolicyVersion`, and policy hash.
- Result/frame/evidence identity is protected from later semantic mutation.
- AI QA remains advisory evidence; continuation decision is not Human QA.

## Dependency Model

The symbolic DAG lives in the V2 requirement and execution-plan snapshots. Each edge contains source
and target Shot keys, dependency type, hardness, and input slot. Confirmation maps symbolic sources
to exact same-Batch targets or an exact reusable artifact. Materialization adds source plan, target,
artifact, extractor, frame index/PTS, and hashes to the target input snapshot.

Validation rejects cycles, self-links, missing Shots, and cross-project links. Invalidation walks the
transitive outgoing closure; unrelated parallel branches remain valid.

## State Transitions

### Implementation

```text
DISCOVERED -> TRIAL -> READY
                    -> BLOCKED
DISCOVERED/TRIAL/READY/BLOCKED -> RETIRED
```

### ShotExecutionPlan

```text
DRAFT -> FROZEN -> INVALIDATED
  |          \
  +-> SUPERSEDED
```

Planning outcome is independent of lifecycle. A BLOCKED DRAFT may be superseded locally; only a
READY or explicitly allowed TRIAL DRAFT may freeze for execution.

### Batch Target

WAITING targets become runnable only when all upstream targets are technically valid/reused and
dependency hashes materialize. Technical failure, ambiguity, budget stop, or hard QA stop pauses the
Batch and leaves downstream targets waiting.

## Retention and Rollback

Project archive retains all plans, evidence, materializations, frames, jobs, artifacts, QA, and
decisions. Rollback disables submissions and selects legacy execution but does not drop tables,
rewrite rows, or release consumed authority.
