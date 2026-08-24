# Data Model: Project and Asset Workspace

## Project

Represents one owner-recognizable creative workspace.

| Field             | Type                | Rules                                                           |
| ----------------- | ------------------- | --------------------------------------------------------------- |
| id                | UUID                | Stable primary identity; never shown in ordinary page copy      |
| name              | text                | Trimmed, 1–120 characters                                       |
| brief             | text, optional      | Maximum 4,000 characters; untrusted text                        |
| targetAspectRatio | enum                | `PORTRAIT_9_16`, `LANDSCAPE_16_9`, `SQUARE_1_1`, `PORTRAIT_4_5` |
| status            | enum                | `ACTIVE` or `ARCHIVED`                                          |
| archivedAt        | timestamp, optional | Present exactly when archived                                   |
| createdAt         | timestamp           | Immutable                                                       |
| updatedAt         | timestamp           | Changes on owner-visible project or asset activity              |

Relationships: one Project has many Assets, AssetImportAttempts, and ProjectActivities.

Indexes: `(status, updatedAt desc)` for the project library.

Transitions: `ACTIVE → ARCHIVED` after confirmation; `ARCHIVED → ACTIVE` on explicit restore.
Repeated archive/restore requests are idempotent.

## StoredObject

Represents immutable original bytes in the configured storage provider.

| Field              | Type             | Rules                                                              |
| ------------------ | ---------------- | ------------------------------------------------------------------ |
| id                 | UUID             | Internal primary identity                                          |
| sha256             | lowercase hex    | Exactly 64 characters; globally unique                             |
| byteSize           | positive integer | Must match stored bytes                                            |
| detectedMimeType   | text             | Allowlisted detected media type                                    |
| storageKey         | text             | Provider-owned relative key; globally unique; never returned to UI |
| verificationStatus | enum             | `VERIFIED` only for Phase 1 READY assets                           |
| createdAt          | timestamp        | Immutable                                                          |
| verifiedAt         | timestamp        | Required when VERIFIED                                             |

Relationships: one StoredObject may back Assets in multiple projects. It is never hard-deleted by
Phase 1 behavior.

## Asset

Represents one project's organized view of a preserved source.

| Field             | Type                          | Rules                                                                                                        |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| id                | UUID                          | Stable identity                                                                                              |
| projectId         | UUID                          | Required parent Project                                                                                      |
| storedObjectId    | UUID                          | Required VERIFIED StoredObject                                                                               |
| originalFilename  | text                          | Sanitized display basename, 1–255 characters                                                                 |
| displayName       | text                          | Trimmed, 1–120 characters; defaults from filename                                                            |
| mediaType         | enum                          | `IMAGE`, `VIDEO`, or `AUDIO`                                                                                 |
| role              | enum                          | `SCENE`, `PRODUCT`, `CHARACTER_FULL_BODY`, `CHARACTER_FACE`, `CHARACTER_REAR_SIDE`, `PROP`, `AUDIO`, `OTHER` |
| notes             | text, optional                | Maximum 2,000 characters; untrusted text                                                                     |
| status            | enum                          | `READY` or `REMOVED`                                                                                         |
| width             | positive integer, optional    | Available for image/video                                                                                    |
| height            | positive integer, optional    | Available for image/video                                                                                    |
| durationMs        | nonnegative integer, optional | Available for audio/video                                                                                    |
| inspectionWarning | text, optional                | Stable safe code/message; never contains a path or process output                                            |
| removedAt         | timestamp, optional           | Present exactly when REMOVED                                                                                 |
| createdAt         | timestamp                     | Original import time                                                                                         |
| updatedAt         | timestamp                     | Metadata/status change time                                                                                  |

Constraints: unique `(projectId, storedObjectId)`. An Asset can be READY only when its StoredObject
is VERIFIED. Metadata edits cannot change project, stored object, original filename, media type,
or extracted immutable import facts.

Indexes: `(projectId, status, createdAt desc)`, `(projectId, status, mediaType)`, and
`(projectId, status, role)`.

Transition: `READY → REMOVED` after confirmation and a future-reference check. Phase 1 does not
restore or hard-delete assets; duplicate import returns the removed record without changing it.

## AssetImportAttempt

Append-only evidence for each selected batch item, including rejected items that never became an
Asset.

| Field             | Type                    | Rules                                            |
| ----------------- | ----------------------- | ------------------------------------------------ |
| id                | UUID                    | Primary identity                                 |
| projectId         | UUID                    | Required parent Project                          |
| submittedFilename | text                    | Sanitized display filename                       |
| submittedByteSize | integer, optional       | Present when known                               |
| detectedMimeType  | text, optional          | Present after detection                          |
| sha256            | lowercase hex, optional | Present after complete hashing                   |
| requestedRole     | AssetRole               | Owner-selected role                              |
| outcome           | enum                    | `IMPORTED`, `DUPLICATE`, `REJECTED`, or `FAILED` |
| resultCode        | text                    | Stable non-secret code                           |
| assetId           | UUID, optional          | Required for IMPORTED/DUPLICATE                  |
| createdAt         | timestamp               | Immutable                                        |

No update/delete operation is exposed.

## ProjectActivity

Append-only concise audit readback.

| Field     | Type           | Rules                                                                                                                            |
| --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| id        | UUID           | Primary identity                                                                                                                 |
| projectId | UUID           | Required parent Project                                                                                                          |
| assetId   | UUID, optional | Present for asset actions                                                                                                        |
| type      | enum           | `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_ARCHIVED`, `PROJECT_RESTORED`, `ASSET_IMPORTED`, `ASSET_UPDATED`, `ASSET_REMOVED` |
| summary   | text           | Stable owner-safe description, no source text or paths                                                                           |
| createdAt | timestamp      | Immutable                                                                                                                        |

## Cross-entity invariants

1. A READY Asset always points to a VERIFIED StoredObject whose bytes hash to `sha256`.
2. Project and Asset lifecycle changes never remove StoredObject, ImportAttempt, or Activity rows.
3. Same-project identical content resolves to one Asset; cross-project content may share one
   StoredObject.
4. A failed/rejected attempt cannot point to a READY Asset created by that attempt.
5. An archived Project is read-only except for restore; its assets and previews remain retained.
6. Phase 0/0.5 file records are outside this schema and remain unchanged.
