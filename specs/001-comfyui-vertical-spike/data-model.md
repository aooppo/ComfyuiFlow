# Data Model: ComfyUI Vertical Spike

The spike uses append-only JSONL records and immutable files. Every record includes `schemaVersion`,
`id`, and `createdAt`. Records are never updated in place; later events reference earlier IDs.

## InputAsset

- `id`: UUID
- `role`: `CHARACTER | SCENE`
- `originalPath`: absolute path accepted only at ingestion
- `storedPath`: immutable copied file under the run root
- `originalFilename`, `mimeType`, `byteSize`, `sha256`

Validation: exactly one asset of each role; supported image MIME; non-empty; hashes unique by role.

## ShotSpecification

- `id`, `promptTemplateVersion`, `schemaVersion`
- `creativeDescription`
- `startState`, `action`, `endState`
- `camera`, `composition`, `continuityRequirements[]`
- `durationSeconds`
- `directorRunId`

Validation: structured schema only; duration must also satisfy the selected workflow manifest.

## WorkflowRegistration

- `workflowId`, `version`, `displayName`, `enabled`
- `apiWorkflowPath`, `sha256`
- `requiredNodeClasses[]`, `requiredModels[]`
- `constraints`: duration/resolution/fps/output media
- `bindings`: role to allowlisted JSON Pointer and value type
- `output`: required node ID and media key
- `verificationStatus`: `UNVERIFIED | READY | BLOCKED`

The file hash is recomputed before dry-run and live execution. LIVE rejects hash drift.

## AuthorizationGrant

- `id`
- `operation`: `DIRECTOR_GENERATE | COMFYUI_SUBMIT`
- `scopeHash`: canonical hash of inputs, prompt/schema version, provider/model or workflow hash
- `maxCalls`: exactly `1`
- `expiresAt`
- `createdEventId`

## AuthorizationConsumption

- `id`, `grantId`, `runId`, `operation`
- `attemptNumber`: `1`
- `consumedAt`
- `requestHash`

There is no refund event. A second consumption for the same grant is invalid.

## SpikeRunEvent

- `id`, `runId`, `mode`: `DRY_RUN | LIVE`
- `eventType`: `CREATED | PREFLIGHTED | AUTH_CONSUMED | REQUEST_STARTED | TASK_BOUND |
STATUS_OBSERVED | ARTIFACT_RETAINED | FAILED | AMBIGUOUS | COMPLETED`
- `payload`: event-specific validated object
- `previousEventHash`, `eventHash`

Derived state is rebuilt from the event stream. Terminal states cannot transition back to active.

## ProviderTask

- `runId`, `provider`: `comfyui-local`
- `promptId`: client-generated canonical UUID
- `status`: `PENDING | IN_PROGRESS | COMPLETED | FAILED | CANCELLED | UNKNOWN`
- `lastObservedAt`
- `rawStatusHash`

## VideoArtifact

- `id`, `runId`, `promptId`
- `storedPath`, `sourceReference`
- `sha256`, `byteSize`, `mimeType`
- `durationSeconds`, `width`, `height`, `fps`, `codec`, `hasAudio`

Validation: bytes are non-empty, FFprobe succeeds, codec type is video, and all required media facts
are present.

## FeasibilityReview

- `id`, `runId`, `artifactId`
- `decision`: `PASS | FAIL | RISK_ACCEPTED`
- `notes`, `reviewedAt`

Review is a separate event and never inferred from technical completion.

## State transitions

```text
CREATED -> PREFLIGHTED -> AUTH_CONSUMED -> REQUEST_STARTED
        -> TASK_BOUND -> STATUS_OBSERVED* -> ARTIFACT_RETAINED -> COMPLETED
        -> FAILED
        -> AMBIGUOUS (query-only reconciliation if promptId exists)
```

Productization gate opens only for `COMPLETED + PASS` or an explicit `RISK_ACCEPTED` review.
