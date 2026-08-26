# Contract: Discovery and Publication

## Discovery

Discovery is zero-call and read-only with respect to generation. It may inspect runtime/node metadata and persist a normalized candidate snapshot.

Output:

```ts
type DiscoveryCandidate = {
  runtimeRef: VersionRef;
  discoveredAt: string;
  sourceDigest: string;
  nodeIdentifier: string;
  normalizedInputs: NormalizedInput[];
  normalizedOutputs: NormalizedOutput[];
  dynamicGroups: DynamicInputGroup[];
  status: "DISCOVERED";
};
```

Discovery must preserve raw schema provenance and dynamic-group cardinalities. It must not infer trusted provider identity, price, prompt semantics, or production readiness from a node name alone.

## Review and publication

An operator publication must explicitly choose and review:

- Runtime and Provider identities;
- Model identity and capability claims;
- shared Adapter identity;
- bounded Compiler Profile and output mapping;
- input purposes, ordering, and cross-field invariants;
- Cost Policy and credential scope;
- safety constraints, rollout scope, and evidence requirements.

Publication creates immutable registry versions and changes the candidate to `PUBLISHED`. It never mutates an already published implementation version.

## Validation and promotion

1. Schema and compiler contract tests run with zero external calls.
2. The published implementation enters `TRIAL` only after review passes.
3. Runtime readiness may be checked without submitting generation.
4. If real calls are possible, `READY` promotion requires evidence produced by the exact implementation/compiler versions under a fresh, scoped authorization.
5. Failed validation is recorded. There is no blind retry or automatic fallback.

Evidence must capture exact versions, call count, cost policy/result, artifacts or failure provenance, and reviewer decision.

## Update behavior

- Node schema/source digest changed: create a new candidate.
- Compiler logic or prompt mapping changed: create a new compiler and implementation version.
- Provider/pricing changed materially: create a new provider/cost/implementation version.
- Runtime endpoint health changed: update operational state without rewriting identity history.
- Older versions remain available only for historical reads, reconciliation, and explicit rollback scope.

## Failure responses

Discovery/publication APIs return structured reasons such as:

- `PROVIDER_IDENTITY_UNRESOLVED`
- `INPUT_SEMANTICS_UNREVIEWED`
- `COST_POLICY_UNRESOLVED`
- `COMPILER_VALIDATION_FAILED`
- `RUNTIME_UNAVAILABLE`
- `EVIDENCE_VERSION_MISMATCH`

None of these conditions triggers automatic provider or model substitution.
