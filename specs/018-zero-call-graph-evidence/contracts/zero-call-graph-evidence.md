# Contract: Zero-Call Graph Preflight and Evidence

## Server-owned preflight input

```ts
type PreflightMainlineGraphInput = {
  graphSnapshotId: string;
};
```

The API/MCP boundary accepts only the persisted graph snapshot identity. It never accepts a graph body, runtime contract body, catalog body, PASS/FAIL assertion, credential, endpoint, or filesystem path.

## Safe evidence result

```ts
type GraphValidationEvidenceView = {
  id: string;
  graphSnapshotId: string;
  graphSha256: string;
  runtimeContractDigest: string;
  runtimeFingerprintSha256: string | null;
  nodeCatalogSha256: string | null;
  validator: { ref: string; version: string };
  outcome: "PASS" | "FAIL";
  diagnostics: Array<{ code: string; message: string; path?: string }>;
  createdAt: string;
};
```

## Behavior

1. `preflight_mainline_graph` retrieves the persisted snapshot, linked RuntimeContract, and allowed node classes.
2. It requests `GET /system_stats` and `GET /object_info` only.
3. It runs validation locally and appends one evidence row for PASS or FAIL.
4. The response exposes the safe evidence view.
5. It must never call `POST /prompt`, `/upload/image`, a provider SDK, or a batch/authorization mutation.

## Batch guard

`createAuthorizedBatch` returns `GRAPH_TECHNICAL_EVIDENCE_REQUIRED` when any target's frozen graph lacks matching PASS evidence. It returns `GRAPH_TECHNICAL_EVIDENCE_INVALID` when available evidence is not tied to the target graph or contract.

## Submission guard

Before staging a frozen input or posting `/prompt`, the bridge reloads the selected evidence and captures the scoped node catalog. A different catalog hash or non-PASS result returns `MAINLINE_GRAPH_EVIDENCE_STALE_OR_MISSING`.
