# Data Model: Flexible Shot Lifecycle

## Storyboard

- Existing stable project-scoped identity.
- New lifecycle projection:
  - `status`: ACTIVE or ARCHIVED, default ACTIVE.
  - `archivedAt`: null while active; timestamp while archived.
- Archive/restore increments `rowVersion` and preserves all child rows and current projections.
- Permanent deletion is allowed only when every durable child relation count is zero.

## StoryboardVersion

- Immutable snapshot containing 1–20 shots.
- A current version can be approved only when shot ordinals are contiguous from 1 to N and a matching manifest exists.
- Later structural edits append a new version and clear the Storyboard approval projection.

## StoryboardShot

- Stable `shotKey` persists for an unaffected creative shot across versions.
- `ordinal` is version-local and ranges from 1 to 20.
- A newly added shot receives a new UUID key.
- A removed shot remains present in historical versions only.

## GenerationPlanVersion and GenerationSpec

- Each version contains 1–20 GenerationSpecs.
- Exactly one spec maps to each approved source StoryboardShot.
- Spec ordinals are contiguous from 1 to N and source shot keys/IDs are unique.
- Aggregate input/reference/output hashes cover the full ordered collection.

## Lifecycle transitions

```text
ACTIVE --archive(current rowVersion)--> ARCHIVED
ARCHIVED --restore(current rowVersion)--> ACTIVE
ACTIVE empty --delete(current rowVersion)--> permanently removed
```

- ARCHIVED is readable but rejects Storyboard writes, asset resolution, Storyboard decisions, plan creation, plan edits, preflight, and plan decisions.
- Restore changes only status, archivedAt, updatedAt, and rowVersion.
