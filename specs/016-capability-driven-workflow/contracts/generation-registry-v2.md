# Contract: Generation Registry V2

## Purpose

Define one provider-neutral, versioned source of truth for generation selection and execution. The Registry must not equate ComfyUI runtime, ComfyUI Partner provider, a video model, or an adapter.

## Shape

```ts
type GenerationRegistryV2 = {
  schemaVersion: 2;
  runtimes: RuntimeProfile[];
  providers: ProviderProfile[];
  models: ModelProfile[];
  adapters: AdapterProfile[];
  compilers: CompilerProfile[];
  implementations: GenerationImplementation[];
};
```

Every entry has an immutable `(id, version)` identity. A `GenerationImplementation` references exact versions from the other five sections and contains a tagged `CostPolicy`.

## Identity boundaries

- **Runtime** answers “where/how is work executed?”
- **Provider** answers “whose inference/billing/credential authority is used?”
- **Model** answers “which model capability is requested?”
- **Adapter** answers “which transport protocol submits and observes the work?”
- **Compiler** answers “how are shot semantics compiled into this reviewed model/node contract?”
- **Implementation** answers “which exact combination is selectable?”

`comfyui-mcp-v2` is an Adapter identity. `COMFYUI_PARTNER` is a Provider kind. They are not aliases.

## Resolution contract

Given a project/shot context, the resolver may return only implementations that:

1. are `READY`, or `TRIAL` under explicit trial scope;
2. have an enabled runtime and provider;
3. satisfy the shot's semantic requirements and input cardinality/invariants;
4. have a recognized cost policy;
5. do not reference fixture/test-only identities in production;
6. have an available shared adapter factory and reviewed compiler.

Resolution returns reasons for rejected candidates. It must not silently fall back to a different provider/model/implementation.

## Compiler input contract

A compiler profile declares accepted modalities, cardinalities, named/dynamic inputs, cross-input invariants, ordering rules, prompt labels, output mapping, and bounded generation options. The Workflow Agent can bind only values admitted by this contract.

For Hailuo 03 reference-to-video:

- image count: 0–9;
- video count: 0–3;
- audio count: 0–3;
- invariant: `imageCount + videoCount >= 1`;
- ordered labels: `Image 1..n`, `Video 1..n`, `Audio 1..n` as supported by the compiler;
- audio alone is invalid.

## Cost contract

```ts
type CostPolicy =
  | { kind: "MONETARY"; currency: string; pricingVersion: string; estimate: CostEstimateRule }
  | { kind: "LOCAL_COMPUTE"; resourceClass?: string; estimate?: ResourceEstimateRule }
  | { kind: "TEST_ZERO_CALL" };
```

`MONETARY` requires a deterministic current estimate before authorization. `LOCAL_COMPUTE` displays local resource semantics and does not invent currency. `TEST_ZERO_CALL` is forbidden in production resolution.

## Lifecycle contract

```text
DISCOVERED -> TRIAL -> READY -> DEPRECATED
TRIAL|READY -> DISABLED
```

- `DISCOVERED` is not selectable.
- `TRIAL` is restricted to approved validation scope.
- `READY` is selectable for normal planning.
- `DEPRECATED` and `DISABLED` remain readable for historical plans.
- Any catalog, compiler, pricing, or material capability change creates a new version.

## Adapter factory contract

Web and Worker import the same adapter factory/resolver. No route or Worker branch may register an implementation-specific adapter name. The adapter exposes readiness, submit, status, cancel, reconcile, and artifact retrieval; it receives an already validated compiled request and does not choose node/model/provider semantics.
