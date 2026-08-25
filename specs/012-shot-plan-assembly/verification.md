# Verification: Approved Shot Plan Assembly

**Date**: 2026-08-25
**Result**: Implementation converged; actual-plan assembly remains correctly gated by Shot 3 Owner PASS

## Spec Kit Consistency Analysis

- Every FR-001 through FR-015 maps to at least one implementation task and verification item.
- Every user story has an independent test path; no unresolved clarification marker or template
  placeholder remains.
- Data model, API contract, plan, tasks, and implementation agree on latest owner-PASS selection,
  ordered source hashing, append-only history, local silent 768x1344 H.264 output, and zero external
  calls.
- The 17:42 Shot 3 artifact remains immutable FAIL evidence. Its retry-baseline UI carries only the
  corrected non-contradictory requirements; it does not reuse the earlier sentence that allowed the
  glass to leave the main view.
- No constitution violation or material ambiguity remains.

## Automated Verification

| Check                                                                     | Result                       |
| ------------------------------------------------------------------------- | ---------------------------- |
| Prisma schema validation and client generation                            | PASS                         |
| Additive migration `202608250013_plan_assembly` on local project database | PASS                         |
| TypeScript root and Project Web type checks                               | PASS                         |
| Scoped ESLint on all changed 012 implementation/tests                     | PASS                         |
| Full Vitest suite                                                         | PASS: 137 passed, 23 skipped |
| Local FFmpeg two-source portrait concat + FFprobe contract                | PASS                         |
| Next.js/workspace production build                                        | PASS                         |
| Secret scan                                                               | PASS                         |
| Whitespace/diff check                                                     | PASS                         |

The repository-wide `pnpm lint` still reports seven pre-existing `no-undef` errors in the untracked
`scripts/project-dev.mjs`; the changed 012 files pass ESLint. This unrelated script was preserved.

## Live Local Readback

- `GET /api/generation-plans/70fee3cc-7c90-438a-bd1d-b59b1fda7a32/assemblies` returns:
  `eligible=false`, `missingOrdinals=[3]`, and accepted source ordinals `[1,2]`.
- An explicit POST while ineligible returns safe `409 ASSEMBLY_NOT_READY` and creates no assembly,
  generation call, or AI QA call.
- In-app browser shows “还差 分镜 3 的负责人通过” and a disabled “生成合成预览” button.
- In-app browser shows the 2026-08-25 17:42 historical Shot 3 and its “以此历史视频为重试基线” action.
- Clicking that action only enters zero-call retry preparation and pre-fills: preserve the historical
  room composition, sofa side, coffee-table position/scale, natural character proportions and final
  seated pose; start with empty hands; keep the same glass stationary on the table; preserve Shot 2
  red-wine color/fill; never move the sofa left or remove the table/glass/wine.
- The current latest Shot 3 still awaits Human QA, so retry preview and assembly remain blocked. This
  is the intended owner gate, not an implementation failure.

## Immutable Evidence Check

- Historical batch time: 2026-08-25 17:42 Asia/Shanghai.
- Job: `8d1ed278-6dac-411f-8374-02fbb4d5e0cc` remains `QA_FAIL`.
- Artifact: `b67b1425-35af-421f-8baf-c7f1be940f02` remains Owner `FAIL`.
- No paid retry, H3 submission, ComfyUI call, CodexManager call, AI QA call, or automatic Human QA
  decision was made by this feature implementation.

## Deferred Action-Time Acceptance

After the owner records a decision on the current Shot 3, a future paid retry still requires:

1. selecting the 17:42 historical video as baseline;
2. reviewing the exact zero-call retry prompt and five references;
3. confirming current H3 cost, one-call cap, no-retry policy, and action-time authorization;
4. reviewing the new artifact and explicitly recording Owner PASS;
5. clicking the separate local “生成合成预览” action.

The application will then assemble the latest Owner-PASS artifacts for shots 1, 2, and 3 in ordinal
order and retain the result plus all source hashes on the approved Shot Plan.
