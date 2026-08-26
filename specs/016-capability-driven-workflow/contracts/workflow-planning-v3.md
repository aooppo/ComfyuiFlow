# Contract: Workflow Planning V3

## Planning request

```ts
type PlanningRequestV3 = {
  projectId: string;
  shotIds: string[];
  storyboardRevisionRefs: VersionRef[];
  optionalOwnerConstraints?: OwnerConstraint[];
};
```

The request does not require prior Storyboard or Shot Plan approval. Planning is zero-call and may operate on any selected shot subset.

## Requirement analysis

For each shot, the Workflow Agent emits a `ShotRequirementSpecV3` whose requirements are purpose-based and marked `REQUIRED`, `OPTIONAL`, or `OMITTED`, with reasons. It must not require character input for a no-person shot or require project/semantic libraries when the selected implementation can validly generate without them.

The agent may propose candidates from project files, semantic asset versions, character state versions, and upstream final frames. Candidate selection is deterministic and explainable; file names and paths alone are not semantic identity.

## Plan preview

The preview contains:

- exact shot subset and revisions;
- exact implementation/compiler/provider/runtime versions;
- ordered, versioned input bindings and their purposes;
- omitted and unresolved requirements with reasons;
- non-secret compiled workflow/prompt preview and digest;
- call count, Cost Policy estimate, expiry expectations, and no-retry policy;
- per-shot validity so valid shots remain selectable when another shot is blocked.

Previewing does not authorize or submit generation.

## Generation Spec handoff

For every planned Shot, the Shot Planner creates one immutable `GenerationSpecV3` that references the
exact Storyboard revision, requirement spec, planning input snapshot, implementation composition, and
compiled-request digest. It is produced automatically and has no independent Owner approval state.

Generation execution accepts only a persisted exact Generation Spec reference. Frontend routes,
Storyboard services, and adapters cannot replace it with an unstructured prompt, arbitrary graph, or
caller-supplied runtime payload.

## Eligibility predicate

A selected shot is eligible when:

1. its required semantic inputs are resolved;
2. the implementation's input contract and invariants pass;
3. exact runtime/provider/adapter/compiler versions are available;
4. cost policy is resolved;
5. no production/test-fixture boundary is violated;
6. for `TRIAL`, one active exact approval item matches this Storyboard version, Shot,
   implementation version, and immutable composition digest.

Storyboard approval, Shot Plan approval, project-wide readiness, and optional unused preparation stages are not eligibility predicates.

`allowedTrialRefs` is derived inside the planning application separately for each Shot. It is never
accepted from the browser and never populated with all Registry `TRIAL` entries.

## Paid submission confirmation

Paid/external submission requires one action-time confirmation bound to:

- exact plan digest and shot set;
- exact Generation Spec version for every selected Shot;
- implementation, provider, runtime, and compiler versions;
- expected call count and hard call cap;
- monetary estimate/cap or explicit local-compute policy;
- expiry;
- no automatic retry and no fallback.

The server-side LIVE kill switch must also be enabled. Confirmation is single-scope authority, not a reusable project approval. Any material plan change invalidates it.

## Execution

Web and Worker resolve the same immutable implementation and shared adapter factory. The Worker must reject version/digest mismatch, expired authorization, exhausted caps, disabled LIVE state, invalid cost state, or repeated submit. A failed provider call consumes the authorized call count according to provider submission evidence and is never retried automatically.

## Completion and Owner QA

Automated checks may annotate output but cannot finalize it. Final output requires explicit Owner `PASS`, `FAIL`, or `RISK_ACCEPTED`. Continuation planning may use an upstream final frame only from an exact persisted artifact/version and must preserve that lineage.

## Fake retirement

- Production planning responses contain no Fake provider/proposal option.
- Test-only fixtures are excluded by environment and registry policy.
- Historical Fake plans remain readable with explicit historical labeling.
