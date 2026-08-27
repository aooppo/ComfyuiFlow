# Data Model: Per-Graph Zero-Call Technical Evidence

## GraphValidationEvidence

| Field                    | Type               | Rules                                                                                          |
| ------------------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| id                       | UUID               | primary key                                                                                    |
| graphSnapshotId          | UUID               | required FK to `MaterializedGraphSnapshot`; restrict delete                                    |
| graphSha256              | CHAR(64)           | must equal the referenced snapshot identity when appended                                      |
| runtimeContractDigest    | CHAR(64)           | must equal the snapshot's declared contract digest                                             |
| runtimeFingerprintSha256 | CHAR(64), nullable | hash of safe normalized runtime facts; null only if runtime facts cannot be obtained           |
| nodeCatalogSha256        | CHAR(64), nullable | hash of scoped normalized catalog; null only if catalog cannot be obtained                     |
| validatorRef             | VARCHAR(160)       | server-owned validator identity                                                                |
| validatorVersion         | VARCHAR(80)        | validator version                                                                              |
| outcome                  | enum               | `PASS` or `FAIL`                                                                               |
| diagnosticsJson          | JSONB              | bounded safe issue code/message/path only; no raw runtime payload, credentials, paths, or URLs |
| createdAt                | timestamptz        | append timestamp                                                                               |

## Relationships

```text
ShotGenerationRequirement -> PlanningInputSnapshot -> GenerationSpec
  -> MaterializedGraphSnapshot -> GraphValidationEvidence[]
```

The one-to-many evidence relationship intentionally permits repeated checks. A PASS is current for batch creation only when `graphSha256` and `runtimeContractDigest` match the target snapshot. Submission additionally compares a freshly captured catalog fingerprint to the selected evidence.

## Integrity

- Update and delete operations on `GraphValidationEvidence` are blocked by the existing append-only trigger function.
- `GenerationLifecycleService` reads matching PASS evidence inside the same database transaction before inserting authorization/batch/targets/attempts.
- Browser input cannot supply evidence fields or raw graph content.
