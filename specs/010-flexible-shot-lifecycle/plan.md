# Implementation Plan: Flexible Shot Lifecycle

## Summary

Extend the existing Storyboard and Shot Planner path from a fixed three-shot approval/planning boundary to an owner-edited 1–20-shot boundary. Keep the deterministic Fake Director contract at three shots, preserve immutable versions and hashes, and add safe Storyboard hard-delete/archive/restore lifecycle actions.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22
**Primary Dependencies**: Next.js 15, React, Zod, Prisma, PostgreSQL, Vitest
**Storage**: Existing PostgreSQL business database; no binary-storage changes
**Testing**: Vitest unit/contract/integration suites, isolated PostgreSQL, production build, browser QA
**Target Platform**: Local single-owner desktop browser
**Project Type**: TypeScript modular monolith
**Performance Goals**: Variable-shot save, archive, restore, and plan preflight remain interactive for 1–20 shots; preflight stays under two seconds in the MVP
**Constraints**: 1–20 saved/approved shots, immutable history, no hard delete with durable children, zero external calls, no Provider/workflow fields
**Scale/Scope**: Existing local projects; up to 20 shots and 50 versions per Storyboard in normal use

## Constitution Check

- **Creative/generation separation**: PASS. Storyboard editing remains provider-neutral and Generation Plan mapping consumes approved source facts only.
- **Provider-neutral contracts**: PASS. Only cardinality and lifecycle fields change; no Provider/model/workflow data enters Storyboard or GenerationSpec.
- **Zero-call defaults**: PASS. Fake Director remains zero-call and no execution boundary is added.
- **Durable provenance**: PASS. Versions, manifests, decisions, plans, and hashes remain append-only; hard delete is restricted to aggregates with no durable history.
- **Quality gates**: PASS. Tasks include contract, service, PostgreSQL, migration, build, browser, security, and convergence evidence.

## Architecture and Data Flow

### Variable shot editing

1. Fake Director continues to append a deterministic three-shot version.
2. The client holds an owner editing copy and may add, remove, or reorder shots.
3. New shots receive a client-generated UUID shot key; unaffected shot keys are preserved.
4. Save validates 1–20 unique shots with contiguous ordinals and appends a new immutable StoryboardVersion.
5. Adding/removing/reordering invalidates the current Storyboard approval projection as every owner save already does.

### Variable generation planning

1. Storyboard approval accepts a current 1–20-shot version with a matching frozen manifest.
2. The deterministic planner sorts all source shots and maps each to one GenerationSpec.
3. Generation Plan append/preflight/decision validation requires 1–20 specs, contiguous ordinals, and exact one-to-one source shot identities.
4. Aggregate hashes continue to hash the full ordered array and therefore remain deterministic for every supported cardinality.

### Storyboard lifecycle

1. Storyboard gains an additive ACTIVE/ARCHIVED state and optional archived timestamp.
2. Default list reads ACTIVE; an explicit archived filter shows archived records.
3. Archive/restore require `If-Match`, update only lifecycle projection fields, and preserve children.
4. DELETE requires `If-Match` and succeeds only when no version, run, decision, manifest, or Generation Plan dependency exists.
5. Every Storyboard write and every Generation Plan create/edit/preflight/decision path rejects an archived source Storyboard.

## Database and Migration

- Add `StoryboardStatus { ACTIVE, ARCHIVED }`, `Storyboard.status`, and `Storyboard.archivedAt` in one additive migration.
- Add an index supporting project/status/update ordering.
- Preserve every existing Storyboard as ACTIVE with null archivedAt.
- No existing version, shot, manifest, binding, decision, plan, spec, or hash row is rewritten.
- Database foreign keys continue to prevent destructive deletion of versioned aggregates.

## Interfaces

- Expand shared shot/spec ordinal bounds from 3 to 20 while the Fake proposal schema retains exactly three.
- Save Storyboard versions with 1–20 contiguous unique shots.
- `GET /api/projects/{projectId}/storyboards?status=ACTIVE|ARCHIVED`.
- `POST /api/storyboards/{id}/archive` and `/restore`, both requiring `If-Match`.
- `DELETE /api/storyboards/{id}`, requiring `If-Match`, empty-history eligibility, and explicit UI confirmation.
- Generation Plan create/append/preflight/approve accepts 1–20 exact source-aligned specs.

## Delivery Order

1. Update living 008/009 specifications and freeze cardinality/lifecycle contracts.
2. Add failing variable-shot, archive/delete, variable-plan, and compatibility tests.
3. Add the lifecycle migration and shared validators.
4. Implement Storyboard editor/service/routes/list actions.
5. Implement variable planner/service/UI behavior.
6. Run isolated PostgreSQL, migration preservation, browser, zero-call, and full quality gates.
7. Analyze before implementation and converge after implementation.

## Post-Design Constitution Check

PASS. The design expands local creative control without crossing into generation execution, weakening append-only provenance, or allowing a destructive delete of durable evidence.
