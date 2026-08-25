# Data Model: Three-Shot Storyboard Workspace

## Storyboard

- `id`, `projectId`, `title`, `creativeBrief`
- `headVersionId` and `approvedVersionId` are projections only; history is authoritative.
- `rowVersion` starts at 0 and increments only when the head advances.
- Unique `(projectId, id)`; archived projects are read-only.

## StoryboardDirectorRun

- Immutable `id`, `projectId`, `storyboardId`, Provider/model/contract identity, normalized request
  hash, status, safe result code, zero-call count, timestamps.
- A successful run points to the generated StoryboardVersion; failures remain visible and do not
  retry or fall back.

## StoryboardVersion

- Immutable `id`, `projectId`, `storyboardId`, `versionNumber`, `parentVersionId`, source
  (`OWNER` or `FAKE_DIRECTOR`), creative brief, contract version, content hash, optional run ID, and
  creation time.
- Unique `(storyboardId, versionNumber)`, `(storyboardId, id)`, and `(projectId, id)`.
- State is derived: current head from Storyboard; approved/revoked from the latest valid Decision.

## StoryboardShot

- Immutable row identity plus stable `shotKey` preserved across edited versions.
- `ordinal`, title, creative description, start/action/end, camera, composition, continuity array,
  and duration.
- Unique `(storyboardVersionId, ordinal)` and `(storyboardVersionId, shotKey)`.
- Draft versions may contain 0–20 shots; approval requires exactly ordinals 1, 2, and 3.

## ShotAssetRequirement

- Immutable `id`, project/version/shot identity, stable `requirementKey`, contract version,
  recursively canonicalized `inputJson`, and `inputHash`.
- The input is a complete `asset-candidate-v1` request and cannot use a free-text asset name as
  identity.

## ShotAssetBinding

- Immutable selection of `productionAssetVersionId`, optional `characterStateVersionId`,
  `assetVersionFileId`, and `projectAssetId` for one requirement.
- Belongs to exactly one AssetResolutionManifest; all referenced rows share the same project.
- Created only after current eligibility is re-evaluated under the open gate.

## AssetResolutionManifest

- One immutable manifest per StoryboardVersion.
- Freezes `policyVersion`, requirements hash, canonical candidate snapshot/result hash, final bindings
  hash, creator/source, and creation time.
- A new creative or asset decision creates a new StoryboardVersion and manifest; old manifests are
  never updated.

## StoryboardDecision

- Immutable `APPROVED` or `REVOKED` event with project/storyboard/version/manifest identity,
  idempotency key, optional notes, and timestamp.
- Approval requires the current head, exactly three valid shots, complete requirements, and a frozen
  manifest. Revocation appends a new event and clears only the Storyboard approval projection.

## State Transitions

```text
Storyboard created (head null)
  -> Fake proposal or owner save appends Version and advances head
  -> candidate preview (read-only, any gate state)
  -> gate-open asset resolution appends Manifest + Bindings
  -> APPROVED decision sets approved projection
  -> later edit appends a new head but preserves prior approval history
  -> REVOKED decision clears current approval projection when it targets that approved version
```

No transition creates a GenerationSpec, Provider grant, generation job, video artifact, or QA result.
