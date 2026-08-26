# Quickstart: Feature 016 Acceptance

## Safety baseline

- Keep external generation disabled for all automated verification.
- Preserve the existing dirty files unrelated to Feature 016.
- Use fixtures for compilation/execution contract tests; do not publish them to the production registry.
- A real validation call, if later approved, needs a fresh exact scope, cost/call cap, expiry, and no-retry confirmation.

## Local setup and zero-call checks

Prerequisites are the repository's pinned `pnpm@10.30.0`, its existing local database/test setup, and no LIVE provider authorization. After implementation, run:

```bash
pnpm install --frozen-lockfile
pnpm project:db:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm project:build
```

Expected outcome: all commands pass without an external Director, AI QA, ComfyUI Partner, or video-provider submission. Focused test paths created by the implementation tasks may be run first, but the full zero-call suite remains the handoff gate.

## 1. Verify identity separation

Create registry fixtures representing:

1. local ComfyUI + local model + `LOCAL_COMPUTE`;
2. the same ComfyUI runtime + ComfyUI Partner node + `MONETARY`;
3. a future direct provider runtime.

Confirm all ComfyUI-backed entries resolve through `comfyui-mcp-v2`, while provider, model, compiler, credential scope, and cost policy remain distinct. Confirm Web and Worker resolve the same adapter factory and implementation version.

## 2. Verify controlled discovery

Discover a node with dynamic image/video/audio groups. Confirm it appears only as `DISCOVERED`, cannot be selected by planning, and preserves the raw source digest. Review and publish its provider/model/compiler/cost semantics, then confirm it becomes `TRIAL`. Change the compiler and confirm a new version is created rather than editing the previous one.

## 3. Verify conditional preparation

Plan these shots independently:

- pure environment with no person;
- product close-up;
- character performance;
- continuation from an upstream final frame;
- motion-reference shot;
- prompt-only shot supported by text-to-video.

Confirm each plan requests only necessary inputs, explains optional/omitted inputs, and never creates an empty required character slot for the no-person shot. Leave one shot unresolved and confirm the valid subset remains generatable.

## 4. Verify Hailuo 03 capability profiles

- Text-to-video accepts zero media references.
- Reference-to-video accepts ordered images 0–9, videos 0–3, and audio 0–3 only when at least one image or video exists.
- Audio-only reference-to-video is rejected before submission.
- First/last-frame requires the first frame and allows the last frame to be absent.
- Prompt labels match binding order (`Image 1`, `Image 2`, `Video 1`, and so on).
- No new H3 plan uses the deprecated fixed five-slot workflow instance.

## 5. Verify simplified gates

Confirm planning and zero-call preview work without project-wide READY, Storyboard approval, Shot Plan approval, or duplicate pre-generation approval. Confirm generation blocks only for an unresolved required input/capability, unavailable implementation/runtime, disabled server LIVE state, missing or invalid action-time authorization, exhausted cap, or final Owner QA.

Confirm one authorization is bound to the exact shot subset and plan digest. Change an input, shot set, compiler version, or implementation version and confirm the authorization becomes invalid.

Confirm each planned Shot has one immutable Generation Spec produced automatically by the Shot
Planner. Verify there is no separate Generation Spec approval control, and verify a raw prompt or
runtime payload cannot be submitted without the persisted exact Generation Spec.

For the zero-call 20-Shot fixture, run planning 100 times and confirm at least 95 complete previews
finish within 2 seconds.

### 5.1 Verify first-real-trial scope

Plan three Shots that resolve to one `TRIAL` exact implementation and confirm all initially show
`TRIAL_SCOPE_REQUIRED`. Approve only Shots 1 and 3 for 30 minutes, then replan: only Shots 1 and 3 may
show `TRIAL`, while Shot 2 remains blocked. Verify the approval view shows exact implementation,
provider/model/adapter/compiler versions, cost and compiled-request digests, expiry, and zero-call/
unauthorized facts.

Repeat the same create request with the same idempotency key and confirm database counts do not
change. Revoke the approval and confirm all affected Shots regain the blocker. Re-approve with a new
key and preserve both historical records. Also verify expired approval, changed Storyboard version,
changed implementation version, and changed composition/cost digest never enter the per-Shot trial
allowlist.

Stop browser acceptance after the zero-call execution preview. Do not check or click the real video
Batch confirmation control.

## 6. Verify Fake retirement and compatibility

Confirm owner UI and production APIs expose no Fake Director/provider/proposal path. Confirm test fixtures still support deterministic zero-call tests but cannot resolve in production. Open historical Fake and fixed-slot H3 records and confirm they remain readable, clearly labeled, and unchanged.

## 7. Verify continuation and final review

Generate fixture artifacts for two consecutive shots. Confirm the second shot can bind the exact final frame/version from the first and that the lineage is visible. Confirm automated checks cannot mark a final output accepted; only explicit Owner `PASS`, `FAIL`, or `RISK_ACCEPTED` closes final review.

## Automated gates

Run the repository's focused unit, contract, integration, type, lint, and browser tests for registry resolution, compiler behavior, planning, authorization, Web/Worker parity, Fake retirement, and historical reads. No test may make an external generation call.

## Real validation boundary

Only after zero-call verification passes may an operator propose an exact `TRIAL` execution. Before any real call, show the selected shot(s), implementation/provider/compiler versions, expected price or local-compute policy, call cap, expiry, and no-retry rule, then obtain a fresh action-time confirmation. Record the result as exact-version evidence; do not auto-promote without the required reviewer decision.
