# Phase 13 Verification

## Outcome

Phase 13 implements the beginner-facing whole-film continuity step, shared N+1 boundaries,
bounded keyframe contact sheets, continuity-aware video previews, and warning-labeled local drafts.
No LIVE image, video, or AI QA request was made during implementation or verification.

## Requirements convergence

- FR-001–FR-009: dedicated UI, extensible registry, immutable profile versions, shared boundaries,
  deterministic zero-call preflight, business actions, idempotency, and optimistic concurrency are
  implemented.
- FR-010–FR-018: provider-neutral keyframe plans, zero-call price/capability preview, expiring bounded
  authorization, sequential single attempts, verified external storage, and explicit owner decisions
  are implemented. LIVE remains disabled unless every gateway, snapshot, capability, price, and expiry
  fact is explicit and current.
- FR-019–FR-023: video control tiers are explicit; H3 is ORDINARY_REFERENCE; an approved start
  keyframe replaces only the Scene slot; the end keyframe is a soft QA target; stale bindings are
  checked before submission; the existing technical-stop/advisory-continue policy remains intact.
- FR-024–FR-028: warning drafts are local, immutable, and separate from Human-PASS formal assembly;
  historical nullable execution records remain compatible; default UI hides technical details; all
  automated acceptance remained zero-LIVE.
- SC-002–SC-010 have automated or database evidence. SC-001 is implemented and the archived-project
  blocker was browser-verified, but the existing owner three-shot Storyboard is archived, so its full
  browser Fake contact-sheet walkthrough was intentionally not forced or mutated.

## Verification evidence

- Prisma: schema format/validation passed; migrations 014 and 015 applied to the Phase 12 development
  database and from zero to a fresh `*_test` database.
- PostgreSQL: the five inherited suites passed serially on fresh isolated databases (23 tests total).
  The Phase 13 continuity suite passed 2 tests, including exactly four Fake keyframes for three shots,
  zero provider calls, 768x1344 normalization, four explicit approvals, missing-reference blocking,
  and direct-SQL immutability guards.
- Vitest default suite: 46 files passed, 6 environment-gated files skipped; 146 tests passed and 25
  skipped. The gated PostgreSQL suites were run separately as described above.
- Quality gates: Prettier, ESLint, TypeScript, secret scan, `git diff --check`, and the full workspace
  production build passed.
- Browser: the local continuity route rendered the five-step beginner flow, business-language
  explanation, and correct approved-Storyboard blocker without console errors. Existing user archive
  state was preserved.

## Further paid acceptance boundary

Any further GPT Image 2/Codex Manager or H3 acceptance requires a new owner confirmation that
displays the exact current model snapshot, image and video call ceilings, current price facts and
expiry, and the no-retry policy. The rejected batch authorization and this verification do not
authorize another call.

## LIVE contact-sheet rejection and corrective convergence

The owner-authorized four-image GPT Image 2 contact sheet was retained and explicitly rejected after
visual review. The observed failures were: missing books/lamp, a wine glass incorrectly disappearing,
next-shot final action leaking into a shared boundary, and coffee-table/table-leg geometry changing
between frames. No automatic retry or replacement was made.

Corrective registry v3 now persists approved scene inventory by default, locks product/prop
silhouette and geometry attributes, separates physical presence from visibility/emphasis, compiles
only the shared boundary instant, and orders multi-reference editing as scene base, fixed product or
prop, character, then dynamic prop. Registry-v1 profiles fail closed and require a new owner-reviewed
version; old keyframe plans and authorizations cannot be reused.

The active three-shot project now has zero-call, unapproved continuity version 6 on registry v3;
intermediate corrective suggestions remain immutable history. Readback confirmed four boundaries, a
hard coffee-table geometry lock, the wine glass as physically `PRESENT` at the Shot 2 to Shot 3
boundary, scene-first reference order, and no shot camera movement in the still-frame prompt. Browser
QA confirmed the UI returns to step 2 and hides GPT Image 2 generation until the owner approves the
new version.

Corrective verification passed 151 default tests, 25 expected environment skips, a fresh PostgreSQL
migration plus the two continuity integration tests, TypeScript, ESLint, Prettier, secret scan,
`git diff --check`, and the production build. All corrective verification made zero external calls.
