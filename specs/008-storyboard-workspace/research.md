# Phase 0 Research: Three-Shot Storyboard Workspace

## R-001: Preserve the one-shot Provider contract additively

**Decision**: Add versioned Storyboard request/result contracts and an optional
`generateStoryboard` capability. Leave `ShotSpecificationSchema`, `AiTaskRequestSchema`, and
`generateStructured` unchanged.

**Rationale**: The spike and its tests depend on the one-shot semantic contract. An optional
capability lets Fake support three shots without claiming support from OpenAI or CodexManager.

**Alternatives considered**: Replacing the current generic request/result union was rejected because
it would silently change a validated spike boundary.

## R-002: Append immutable versions instead of updating drafts

**Decision**: Every save appends StoryboardVersion, Shot, and Requirement rows and advances a small
Storyboard head projection using `If-Match` optimistic concurrency.

**Rationale**: The constitution requires storyboard revisions to be append-only, and immutable
versions make comparison, restart readback, provenance, and conflict handling explicit.

**Alternatives considered**: Mutable drafts plus snapshots on approval were rejected because failed
or abandoned edits would be invisible and concurrent writes could overwrite evidence.

## R-003: Use recursive canonical JSON everywhere

**Decision**: Implement one recursive key-sorted canonical JSON helper and use it for all Phase 2/3
input and result hashes.

**Rationale**: The current candidate helper passes a top-level replacer array to `JSON.stringify`,
which can omit nested keys, while the service uses a different serialization. One algorithm prevents
false hash equality and UI/service drift.

**Alternatives considered**: Keeping both hashes or hashing database IDs only was rejected because
neither proves the actual frozen request/result content.

## R-004: Database constraints backstop service isolation

**Decision**: Add project/aggregate composite keys and foreign keys plus update/delete rejection
triggers for immutable version content, requirements, bindings, manifests, and decisions.

**Rationale**: Several Phase 2 tables currently carry `projectId` but use only single-column foreign
keys. Direct SQL must not be able to assemble a cross-project storyboard or rewrite provenance.

**Alternatives considered**: Service-only checks were rejected as insufficient evidence for the
required PostgreSQL boundary.

## R-005: Gate formal selection on server evidence

**Decision**: `PHASE2_STORYBOARD_BINDINGS_ENABLED` is server-only, defaults false, and is injectable in
tests. Candidate preview remains available; binding, manifest, approval, and revocation fail closed
until the gate is true.

**Rationale**: A running application cannot independently prove that repository tests and Human QA
passed. An explicit deployment/config boundary keeps unfinished Phase 2 work from being promoted.

**Alternatives considered**: Client toggle, automatic schema detection, and “tests passed once”
database flags were rejected because they are bypassable or stale.

## R-006: Revalidate selected candidates at confirmation

**Decision**: Formal resolution re-runs the deterministic candidate policy inside the resolution
transaction and accepts only currently eligible AssetVersionFile IDs. The manifest freezes the full
candidate snapshot and canonical hashes.

**Rationale**: READY, ACTIVE, accepted, and current-version facts can change between preview and
confirmation; a cached preview is not authority.

**Alternatives considered**: Trusting the preview hash alone was rejected because it cannot prevent a
time-of-check/time-of-use change.

## R-007: Use an isolated PostgreSQL test database

**Decision**: PostgreSQL tests must refuse the default `comfyuiflow` database and use a separately
migrated `comfyuiflow_test` database and isolated asset root.

**Rationale**: Existing integration cleanup performs broad project-owned deletes. Isolation prevents
test teardown from erasing local business data.

**Alternatives considered**: Reusing the default database was rejected as destructive and unsafe.

## R-008: Human QA remains a human boundary

**Decision**: Browser automation may collect screenshots and technical observations, but the Human QA
ledger records the owner/reviewer decision separately and cannot be auto-promoted by tests.

**Rationale**: Usability and semantic clarity require direct human review, especially the distinction
between storyboard approval and generation authorization.

**Alternatives considered**: Treating E2E success as Human PASS was rejected by the constitution.
