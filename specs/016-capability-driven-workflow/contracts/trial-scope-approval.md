# Contract: First Real Trial Scope Approval

## Purpose

Allow an owner to acknowledge a narrowly bounded first real `TRIAL` implementation scope before
zero-call planning can treat that implementation as selectable. This approval is not generation
authorization and cannot submit or pay for work.

## Create approval

`POST /api/storyboard-versions/{versionId}/trial-scope-approvals`

- Requires an `Idempotency-Key` header.
- Body names one persisted V3 `planId`, a unique selected Shot subset, a bounded expiry, and explicit
  confirmation.
- The server resolves all implementation and composition facts; the browser cannot supply or widen
  `allowedTrialRefs`.
- Response freezes Storyboard/version, source plan digest, exact per-Shot Generation Spec,
  implementation/runtime/provider/model/adapter/compiler references, compiled-request digest, cost
  policy digest, scope digest, actor, and expiry.
- Response always states `externalCalls: 0`, `generationAuthorized: false`, and
  `executionAuthorized: false`.
- Same key and same scope returns the original row and items. Same key with different scope returns
  `TRIAL_SCOPE_IDEMPOTENCY_CONFLICT` and writes nothing.

## Read history

`GET /api/storyboard-versions/{versionId}/trial-scope-approvals`

Returns all approval records newest first, including derived `ACTIVE | EXPIRED | REVOKED` status,
exact items, expiry, and optional revocation. History is never pruned by expiry or re-approval.

## Revoke

`POST /api/trial-scope-approvals/{approvalId}/revoke`

Creates one append-only revocation event. It does not edit or delete the approval or its items and
does not change implementation lifecycle. Repeated identical revocation returns the original event
without extra writes.

## Planning effect

For each Shot independently, planning may pass an exact `implementationId@version` to
`allowedTrialRefs` only when an approval item matches the current Storyboard version, Shot,
implementation composition digest, has not expired, and has no revocation. Unapproved or stale
items keep `TRIAL_SCOPE_REQUIRED`.

## Execution boundary

After approved planning, zero-call generation preview may display exact Shot/version/cost/call facts.
Real execution still requires a fresh action-time confirmation and a separate Generation
Authorization V3. No create/read/revoke approval endpoint can reach an adapter, Worker, AI QA,
ComfyUI `/prompt`, or video Provider.
