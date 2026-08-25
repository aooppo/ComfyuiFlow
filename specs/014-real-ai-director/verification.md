# Verification: Feature 014

## Automated gates

- Prisma format/validate/generate: PASS.
- Fresh database migration rehearsal: PASS, all 18 migrations applied; rehearsal database removed.
- Prettier, ESLint, TypeScript: PASS.
- Vitest: 49 files and 159 tests passed; 7 LIVE-gated files skipped by design.
- Serial isolated PostgreSQL: 6 files and 21 tests passed.
- Next `.next-build` production build: PASS; all seven Director routes discovered.
- Secret scan and `git diff --check`: PASS.

## Fake browser acceptance

In-app browser verified the Chinese Storyboard workflow on local test data:

1. Both Terra profile labels and Fake zero-call profile were visible.
2. Preview displayed one confirmed reference, 1-20 shot limit, zero calls, zero retries, cost and expiry.
3. Explicit checkbox enabled queueing; Worker produced a three-shot proposal and polling/readback worked.
4. Before adoption the existing approved version remained current; adoption created `v2 · AI_DIRECTOR`,
   displayed three editable shots, and cleared current approval.
5. A second proposal was rejected and the Storyboard remained at two versions.
6. Browser console had zero errors or warnings.

Persisted acceptance readback: two Fake runs, provider call sum 0, one ADOPTED decision, one REJECTED
decision, and exactly two Storyboard versions.

## External-call ledger and boundaries

- CodexManager: 0
- OpenAI: 0
- ComfyUI: 0
- Video generation: 0

No LIVE acceptance was run or authorized. Phase 13 T057, continuity v6 approval, and keyframe retry
remain unfinished and unchanged.
