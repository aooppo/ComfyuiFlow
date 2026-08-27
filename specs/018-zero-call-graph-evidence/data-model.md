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

## CapabilityPublicationReceipt

| Field               | Type         | Rules                                                             |
| ------------------- | ------------ | ----------------------------------------------------------------- |
| id                  | UUID         | primary key                                                       |
| actorRef            | VARCHAR(160) | administrator-provided audit label; never a credential            |
| manifestJson        | JSONB        | canonical-validated Capability Pack, without secrets or raw graph |
| manifestSha256      | CHAR(64)     | unique canonical Pack identity                                    |
| capabilityProfileId | UUID         | FK to the derived append-only CapabilityProfile                   |
| implementationId    | UUID         | FK to the derived `TRIAL` GenerationImplementation                |
| receiptDigest       | CHAR(64)     | unique digest binding Pack and derived registry identities        |
| createdAt           | timestamptz  | append timestamp                                                  |

`CapabilityPublicationReceipt`, `CapabilityProfile`, `RuntimeContract` and
`GenerationImplementation` are written in one transaction. Update/delete is rejected by the
append-only trigger.

## Capability Pack and Graph Intent (in-memory contracts)

`CapabilityPack` is a JSON input, not a persistence model. Its model/runtime-target/binding data
is copied into `CapabilityProfile.payloadJson`; server-owned executable refs are written to the
implementation columns. `GraphIntent` is an in-memory bounded input that is digested into the
frozen GenerationSpec planning input. Its compiler output is persisted through the existing
`GenerationSpec -> MaterializedGraphSnapshot` lineage before Feature 018 preflight.
