# Research: Dynamic Capability Generation Mainline

## Decision: Replace rather than adapt the V3 execution family

**Rationale**: The schema has legacy Generation models and parallel V3 records, while the Worker composes two paths. Retaining reads or fallback semantics would violate the unique-mainline requirement.

**Alternatives considered**:

- Keep a read-only projection of old records: rejected because it preserves product reads.
- Migrate local history: rejected because the objective intentionally discards the local records.

## Decision: Make RuntimeContract a registered first-class record

**Rationale**: Node allowlists and runtime facts must be frozen then compared with current `/object_info`. The contract must be owned by a capability and referenced by compiler, implementation, spec, and attempt.

**Alternatives considered**:

- Keep a global runtime contract: rejected because it permits cross-implementation leakage.
- Trust a supplied graph at submission: rejected because it can be altered after planning.

## Decision: Use one generic ComfyUI MCP adapter

**Rationale**: `submit`, `status`, `reconcile`, `retain`, and `cancel` are transport operations. Exact AdapterRegistry resolution with `adapterRef + runtimeRef` keeps graph semantics out of the Worker. A Direct API later becomes another adapter registration.

**Alternatives considered**:

- Provider-profile switch in Worker: rejected because it recreates retired fixed branches.
- Legacy adapter fallback: rejected because failures must fail closed.

## Decision: Reset via offline evidence and one clean migration

**Rationale**: The required local data is disposable but reset must be recoverable. A readable dump plus storage SHA manifest establishes proof; one baseline migration prevents retired-table archaeology.

**Alternatives considered**:

- Drop only generation tables: rejected because parallel capability records remain.
- Append a destructive migration: rejected because an empty database replays legacy history.

## Decision: Gate LIVE after commit, not after preview alone

**Rationale**: Preview is zero-call evidence, not paid authority. It can display identities, prices, expiry, source hash, and caps; the Owner must then give an exact confirmation before the Worker starts.

**Alternatives considered**:

- Treat this broad request as consent: rejected by the objective.
- Enable retry or three-Shot continuation: rejected because the first artifact and AI-QA result must stop for an Owner decision.
