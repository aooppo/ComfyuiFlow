# Research: Per-Graph Zero-Call Technical Evidence

## Decisions

### Use persisted graph SHA as the graph identity

- **Decision**: `MaterializedGraphSnapshot.graphSha256` remains the exact canonical graph identity.
- **Rationale**: It is already frozen, recorded on the attempt, and checked by the execution bridge. A validator-specific digest would make the gate ambiguous.
- **Alternatives considered**: Store only a catalog-specific validator hash (rejected: it cannot prove which persisted graph was assessed).

### Capture a scoped node catalog and a safe runtime fingerprint

- **Decision**: Fetch `/system_stats` and `/object_info`, normalize only the RuntimeContract's allowed node classes, and hash safe selected system facts.
- **Rationale**: This proves the catalog consulted while avoiding secrets, paths, endpoints, or raw environment data in persistent evidence.
- **Alternatives considered**: Persist raw endpoint response (rejected: can leak sensitive runtime metadata); check only node names (rejected: cannot detect input-schema drift).

### Append evidence for both PASS and FAIL

- **Decision**: Every complete graph-specific preflight produces immutable PASS or FAIL evidence.
- **Rationale**: Failures are operational provenance, and retaining them ensures a later PASS does not erase an earlier incompatibility.
- **Alternatives considered**: Persist PASS only (rejected: weak auditability).

### Enforce evidence before authorization/batch creation and recheck at submission

- **Decision**: Batch creation requires matching PASS for every target. The bridge re-fetches the scoped catalog and requires its hash to equal the evidence before staging/uploading/submitting.
- **Rationale**: The first gate prevents accidental paid preparation; the second protects against runtime drift between preflight and submit.
- **Alternatives considered**: submission-time check only (rejected: expensive lifecycle work can be created for invalid graphs).

### Do not invent a technical-evidence TTL

- **Decision**: Match graph and contract exactly, then compare catalog at submit; leave elapsed-time expiry out of scope.
- **Rationale**: Existing published configuration has no evidence expiry policy, and runtime drift is directly detected by recapture.
- **Alternatives considered**: arbitrary short expiry (rejected: unapproved product policy).
