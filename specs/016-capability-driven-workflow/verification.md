# Verification: Simplified Gates and Capability-Driven Workflow

## Baseline Audit - 2026-08-26

- Authoritative worktree: `/Users/tj/Documents/ChatGPT/ComfyuiFlow-phase14`.
- Feature branch: `codex/016-capability-driven-workflow` from committed Feature 015 baseline
  `71e9defa73a611be2c1128ee61190f35bbe093ed`.
- Feature 016 specification directory and `.specify/feature.json` were uncommitted at implementation
  start and are retained as the approved planning source.
- Preserved pre-existing business changes:
  - `apps/project-web/components/storyboards/storyboard-director-panel.tsx`: consumes
    `preview.canConfirm`, explains zero eligible references, and prevents queue confirmation.
  - `tests/unit/storyboard-director-v2.test.ts`: zero-call no-reference preview regression.
- Preserved generated development drift, excluded from audited intent unless intentionally resolved:
  - `apps/project-web/next-env.d.ts`: generated Next route reference changed from `.next-build` to
    `.next`.
- Existing Registry V1 SHA-256:
  `c48af7ca5b2f39c8aea92dcd824647ba3eeb7881730712e6a7b04986de5be651`.
- Existing exact legacy H3 registry fixture SHA-256:
  `8505d4c80a7d704d89cdeaaae132a84b0349c610a1780941d7495f67dedac7c9`.
- Feature 016 automated scope authorizes zero external Director, AI QA, ComfyUI Partner, ComfyUI
  `/prompt`, or video-provider calls. Runtime discovery tests use fixtures unless a separately
  approved read-only local inspection is recorded.

## Specification Analysis

- Requirements checklist: 16/16 complete.
- Task plan: 77 tasks; 31 marked parallel; US1-US5 contain 11/13/11/12/8 tasks.
- Traceability: FR-001 through FR-033 and SC-001 through SC-012 mapped to tasks.
- Constitution remediation: immutable, automatically derived `GenerationSpecV3` remains the
  Shot-Planner-to-generation handoff without a separate Owner approval.
- Fake retirement remediation: Fake preview/run/proposal/adopt/decision writes are covered while
  real Director writes and historical GET reads remain supported.
- Performance remediation: at least 95 of 100 zero-call 20-Shot previews must complete within two
  seconds.
- Pre-implementation analysis result: no CRITICAL or HIGH inconsistency remains.

## Phase 1 Baseline

- Focused zero-call regression command:
  `pnpm exec vitest run tests/unit/workflow-agent-registry.test.ts tests/unit/workflow-agent-service.test.ts tests/contract/workflow-agent-api.test.ts tests/contract/generation-execution-api.test.ts tests/unit/project-worker-loop.test.ts tests/unit/storyboard-director-v2.test.ts tests/contract/minimax-h3-workflow.test.ts tests/contract/generation-execution-boundaries.test.ts --no-file-parallelism --maxWorkers=1`.
- Result before Feature 016 business implementation: 8 files passed, 29 tests passed.
- Exact Registry V1, Workflow Registry, and fixed-slot H3 graph hashes are locked by the legacy
  fixture and regression test.
- Additive `capability-workflow.ts` public boundary is exported without changing existing V1/V2
  exports.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 2 Foundation

- Registry V2 strict contracts and loader tests: 2 files passed, 10 tests passed. Coverage includes
  independent exact versions, strict secret-free payloads, lifecycle filtering, monetary/local/test
  cost policy, stable rejected reasons, production Fixture exclusion, legacy V1 projection, immutable
  Generation Spec V3, and raw graph bypass rejection.
- Shared adapter/Worker regression: 2 files passed, 9 tests passed. Web and Worker resolve the same
  `comfyui-mcp-v2` identity; missing versions, missing MCP transport, and production test-only adapters
  fail before dispatch.
- PostgreSQL integration: 1 file passed, 4 tests passed against isolated `comfyuiflow_test`. Fourteen
  additive registry/planning tables exist; profile, publication, evidence, requirement, snapshot, and
  Generation Spec records are append-only; only explicit lifecycle/state facts may change.
- Registry V2 persistence is idempotent and rejects changed bytes under the same identity/version.
- Prisma schema format/generate/validate, root and Project Web TypeScript, Project Core build, and
  `git diff --check` passed.
- Empty-database migration rehearsal applied all 20 migrations through
  `202608260020_capability_driven_workflow`; temporary database `comfyuiflow_migrate_016` was removed
  after success.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 3 User Story 1 - Core Requirement and Snapshot Slice

- Requirement and snapshot tests were added first and failed because the V3 services did not exist.
- After implementation, 2 files passed, 5 tests passed.
- A no-person environment Shot produces `CHARACTER: OMITTED` with
  `NO_EXPLICIT_CHARACTER_NEED` and no required purpose.
- Exact product, character identity/appearance, previous-final-frame, motion, and audio semantics
  become required only on the affected Shot; selected unrelated evidence remains optional.
- Candidate gathering uses semantic identity, lifecycle approval/readiness, and verified hash, never
  filename/path guessing.
- Planning bindings are ordered deterministically by modality and exact source identity; 100 repeated
  requirement and snapshot runs each produced one unique hash.
- Strict V3 planning request tests failed first for the missing contract and routes, then passed: raw
  prompt, arbitrary graph, caller runtime payload, and caller adapter payload are rejected.
- The new Storyboard-version route accepts an exact saved current head and selected Shot subset. It
  does not read Storyboard approval, Shot Plan approval, asset-manifest approval, or any project-wide
  readiness decision; both POST and plan-detail GET use `no-store`.
- Every selected Shot automatically receives an immutable requirement record, planning snapshot, and
  Generation Spec V3. The response exposes only safe versions, reasons, bindings, digests, and the
  explicit facts `externalCalls: 0` and `generationAuthorized: false`.
- PostgreSQL independent-branch test: a bound product Shot remained `READY` while an unrelated
  unbound product Shot was `BLOCKED`; both persisted one Generation Spec. A changed optional STYLE
  constraint created a new snapshot while the prior snapshot payload remained byte-equivalent.
- The saved-Storyboard UI now allows selecting Shots before any approval flow and explains each
  purpose as `REQUIRED`, `OPTIONAL`, or `OMITTED`; it does not expose a raw prompt/runtime control or
  a generation confirmation.
- No-person/environment, product, and recurring-character requirement behavior is covered across the
  deterministic unit scenario; independent READY/BLOCKED persistence is covered in PostgreSQL.
- Focused US1 verification passed: 3 files, 7 tests; PostgreSQL verification passed: 1 file, 5 tests.
- Root and Project Web TypeScript, Project Core build, scoped Prettier check, and `git diff --check`
  passed.
- US1 checkpoint complete. Capability selection/compilation beyond the initial reviewed Registry V2
  identities continues in User Story 2.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 4 User Story 2 - Capability Selection and Bounded Compilation

- Capability resolution is driven by Registry V2 capability codes, compiler input contracts,
  lifecycle, exact versions, production Fixture exclusion, and Cost Policy. No model or H3 identity is
  branched on by the resolver or selector.
- Text-to-video, ordered-reference, first-frame, first/last-frame, and previous-final-frame capability
  scenarios select exact implementations or return stable rejection codes. TRIAL requires an exact
  scoped reference; READY wins deterministic selection.
- Monetary policy requires a current effective/expiry window. `LOCAL_COMPUTE` resolves without an
  invented currency; `TEST_ZERO_CALL` remains unavailable in production.
- The reference compiler accepts at most 9 images, 3 videos, and 3 audio inputs; empty and audio-only
  sets fail. Bindings are required-first, optional-last within deterministic modality order and emit
  provider-native `Image N`, `Video N`, and `Audio N` labels.
- First/last-frame compilation requires an exact first frame and makes the last frame optional.
  Previous-final-frame binding records exact upstream plan, artifact, frame index, version digest, and
  content hash; downstream planning remains blocked before materialization.
- Compiler input is strict and rejects caller graph, node, endpoint, credential, path, and command
  fields. Output is a bounded non-executable preview plus canonical digest.
- Web and Worker parity test resolved identical implementation, runtime, provider, model, adapter, and
  compiler versions through the shared factories. The owner UI no longer exposes fixed H3 model
  choices and displays server-provided lifecycle/blocker/cost facts.
- Focused US2 verification passed: 8 files, 24 tests. PostgreSQL V3 lineage regression remained green:
  1 file, 5 tests. Root and Project Web TypeScript, full ESLint, scoped Prettier, Project Core build,
  and `git diff --check` passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Interactive Browser Acceptance - 2026-08-26 (Partial T076)

- Started the local PostgreSQL, Project Web, and Worker stack. The Web application remained available
  at `http://localhost:3210`; the existing loopback ComfyUI runtime was only health-checked and was not
  submitted to.
- Applied additive migration `202608260020_capability_driven_workflow` to the local development
  database before browser acceptance.
- Opened project `015 Workflow Agent 零调用测试`, Storyboard `红色陶瓷杯三镜头演示`, saved head V4,
  and exercised the owner-visible V3 planning panel in the in-app browser.
- Planning all three selected Shots returned three independent blocked results because their required
  environment binding was unresolved. Planning only Shot 1 returned exactly one result, proving that
  selected subsets are independent.
- The three-Shot run persisted 2 `GenerationPlanV3Record`, 3 `GenerationSpecV3Record`, and 3
  `PlanningInputSnapshotV3Record` rows at the first business readback boundary. Repeated deterministic
  planning supersedes by exact content identity rather than changing prior immutable payloads.
- The initial acceptance exposed raw `ENVIRONMENT_IDENTITY_REQUIRED`,
  `INPUT_CONTRACT_UNSATISFIED`, `INPUT_INVARIANT_FAILED`, and `UNRESOLVED_ENVIRONMENT` codes in the
  owner body. Convergence task T078 added bilingual owner-readable reasons and exact next actions.
  Re-acceptance confirmed Chinese and English copy in the owner body and stable raw codes only inside
  the collapsed Technical record.
- Browser console warnings/errors after re-acceptance: 0. Planning response facts remained
  `externalCalls: 0` and `generationAuthorized: false`; no confirmation or provider submission was
  offered by the V3 panel.
- Remaining visible Feature 016 gaps are already represented by T063-T070 and T076: the page still
  exposes `New Fake proposal`, a `Fake` provider option, legacy Storyboard approval language, and
  historical/production boundary acceptance is not complete. T076 remains open until publication,
  batch confirmation, Fake retirement, historical reads, and final Owner QA are all accepted.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 5 User Story 3 - Controlled Discovery and Publication

- ComfyUI node discovery now canonicalizes only allowlisted node facts, strips secret/endpoint/path
  metadata, preserves a stable raw-schema reference and source digest, and derives deterministic
  image/video/audio dynamic groups. A schema change creates a new candidate version and supersedes an
  older still-unreviewed candidate without creating or selecting an implementation.
- Reviewed publication validates the exact candidate digest plus Provider, model, adapter, compiler,
  input semantics, and Cost Policy composition. Stable domain codes reject incomplete or mismatched
  review facts; an existing selectable version cannot be republished or mutated.
- Publication changes only an exact pre-registered `DISCOVERED` composition to `TRIAL`. Exact-version
  evidence is append-only; failed evidence remains recorded and does not count as PASS. Explicit READY
  promotion requires PASS contract and runtime-readiness evidence and, when configured, a PASS result
  from a separately authorized real execution of the exact implementation/compiler versions.
- `LOCAL_COMPUTE` promotion does not invent or require a USD amount. Monetary real-execution evidence
  requires a cost digest.
- Discovery/publication APIs are `no-store`, same-origin for mutations, and default closed behind
  `PROJECT_CAPABILITY_REGISTRY_OPERATOR_ENABLED=false`. Discovery calls only ComfyUI `/object_info`;
  neither route contains or reaches `/prompt` or an adapter submit path.
- The in-app `/generation-registry` acceptance showed the six separated identities, `FIRST REAL
TRIAL` boundary, read-only discovery, deliberate TRIAL publication, and the expected visible message
  that operator access is disabled by default. Browser warnings/errors: 0.
- Focused US3 verification: 4 files, 13 tests passed. PostgreSQL exact transition/evidence isolation:
  1 file, 6 tests passed. Root and Project Web TypeScript, scoped ESLint, Prisma format/generate/
  validate, both development and test database migrations, and `git diff --check` passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Convergence T079 - Automatic Exact Semantic Binding

- Browser acceptance exposed that V3 requirement analysis recognized the exact scene requirement but
  the application only consumed legacy `ShotAssetBinding` rows. The eligible semantic candidate path
  from T021 was not connected, while the legacy manifest/Storyboard approval controls were deliberately
  unavailable under Feature 016.
- The V3 application now runs the deterministic asset-candidate policy for an exact structured
  requirement and automatically binds one eligible reference per required usage only when the semantic
  version and file are `ACTIVE`, the binding is Owner `ACCEPTED`, the project file is `READY`, and its
  stored SHA-256 is verified. Explicit historical bindings still take precedence.
- The isolated worktree was also missing the content-addressed scene file referenced by the shared
  development database. The exact file was copied from the main worktree to the same storage key after
  source and destination SHA-256 both verified as
  `8edca81a57d2b1deaf2a79581557c8314baccf64c663485d627390272d5280a1`; the content endpoint changed
  from HTTP 500 to HTTP 200.
- Replanning Storyboard `红色陶瓷杯三镜头演示` changed all three results from `BLOCKED` to `READY`.
  PostgreSQL readback showed a latest `VALID` plan with three expected calls and three immutable
  snapshots, each containing one exact `ENVIRONMENT` binding to the verified SHA. This planning action
  still made zero external calls and granted no generation authority.
- Regression: workflow V3/candidate/requirement tests passed (3 files, 9 tests); serial PostgreSQL
  integration passed (1 file, 6 tests); full ESLint, root and Project Web TypeScript, browser console,
  and `git diff --check` passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## User Story 4/5 Acceptance and Resident Worker - 2026-08-26

- The supervised `pnpm project:dev` process remains resident with Project Web on port 3210 and the
  Project Worker continuously polling until an explicit process signal stops the supervisor. The
  Worker no longer constructs Fake generation or Fake video-QA providers, and Fake Director polling
  is absent unless its separate LIVE flag is explicitly enabled.
- The current local environment already has the generation LIVE switch and MiniMax H3 profile
  configured. Browser acceptance therefore stopped at the unselected exact confirmation checkbox;
  no Batch was created and no Provider or ComfyUI submission was made.
- In-app browser acceptance on Storyboard `红色陶瓷杯三镜头演示` confirmed `READY: 3`, `TRIAL: 0`,
  `BLOCKED: 0`, an exact three-Shot zero-call preview, video-call cap 3, AI-QA ceiling 3, maximum cost
  840000 USD micros, and a disabled confirmation button until the Owner checks the exact-scope box.
- Current owner UI contains no Fake proposal/generation button, no Fake provider option, no legacy
  manifest/Storyboard approval control, and no new legacy Shot Plan control. Existing legacy plans
  remain linked only under an explicit read-only historical section.
- V3 execution contracts now freeze exact Generation Spec, implementation, runtime, Provider, model,
  adapter and compiler references plus plan/target/cost digests. One selected subset is persisted with
  an all-or-none authorization and Batch transaction; stale preview input leaves zero partial rows.
- Owner QA supports `PASS`, `FAIL`, and noted `RISK_ACCEPTED`; assembly still requires an explicit
  Owner terminal decision and never fabricates a Human decision from technical or AI-QA state.
- Focused contract/source regression: 5 files, 15 tests passed. Serial affected PostgreSQL suites:
  4 files, 20 tests passed. Full zero-call Vitest: 84 files, 285 tests passed, 9 files/39 tests skipped
  by their explicit environment gates. ESLint, root/Web TypeScript, Prisma validation, secret scan,
  production Project Web build, and `git diff --check` passed.
- Real external calls in this acceptance: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

### Remaining implementation gaps

- T052 still needs PostgreSQL-level expired-price rejection coverage in addition to the existing
  resolver test; blocked-branch isolation, local-compute facts, stale preview, idempotency and
  zero-partial-row behavior are already covered.
- T053, T058 and T059 remain open: V3 Batch targets are not yet consumed by the formal Worker artifact
  pipeline. The existing V1/V2 Worker already consumes permission before submission and never
  auto-retries an ambiguous attempt, but that behavior must not be claimed for V3 until V3 attempts,
  retained artifacts and reconciliation are append-only and fully connected.
- T062 and T070 remain open until the V3 Worker boundary above is closed and the historical read/write
  compatibility matrix has a dedicated PostgreSQL regression.
- T064 and T065 need expanded no-write and historical-read integration matrices beyond the current
  stable 410, production-fixture exclusion, and source/browser coverage.
- T071 and T073-T077 remain final hardening/documentation/performance/browser-convergence work. Paid
  confirmation and real TRIAL execution require a fresh action-time Owner confirmation and are not
  authorized by this zero-call acceptance.

## Create Storyboard and Call AI - 2026-08-26

- Requirement A is implemented as one explicit action-time boundary. After title and creative brief
  are entered, a debounced preview performs no external call and discloses the server-owned
  `CodexManager Local` / `gpt-5.6-terra` profile, maximum three Shots, US$5.00 ceiling, one-call cap,
  price expiry, exact reference count, and the no-retry/no-fallback policy. The enabled action is
  labelled `创建并调用 AI`; the browser acceptance did not click it.
- Confirmation atomically persists one Storyboard, an immutable empty initial revision, one queued
  Director Run, the exact verified reference snapshot, and a single-use authorization. Repeated
  delivery of the same idempotency key reads back the same records; stale previews and missing exact
  image references leave no partial rows. The Provider, model, cost ceiling, call count, and endpoint
  cannot be overridden by the browser payload.
- The current real Director panel polls queued/running status, shows the completed proposal, and keeps
  proposal adoption or rejection explicit. Historical Fake records remain collapsed read-only and no
  Fake Provider or rerun control is exposed.
- Browser readback after the unsubmitted acceptance form found zero Storyboards titled
  `AI 创建验收（不提交）`. The resident supervisor, Project Web, and Worker processes remained alive.
- Final automated acceptance after isolating the Worker Provider used only the Fake test double:
  Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0. Full Vitest passed 85 files / 288 tests
  with 9 files / 40 tests skipped by explicit environment gates. Affected PostgreSQL suites passed
  4 files / 21 tests. ESLint, root/Web TypeScript, Prisma validation, secret scan, production build,
  and `git diff --check` passed.
- During the first PostgreSQL test attempt, a queued fixture was mistakenly visible to the resident
  default Director Worker. It claimed the fixture and attempted the configured local CodexManager
  gateway before the test timed out. No successful proposal or retained fixture evidence was found,
  but one real request may have reached the gateway. The fixture is now terminally cancelled before
  Worker coverage and every test Worker explicitly injects the Fake Provider, preventing recurrence.

### Post-commit response repair

- The Owner's real create action did complete successfully: Storyboard
  `35791cfe-2aa8-5a21-81bf-ef30e8ffccb4`, Run
  `6d5b3b47-05ae-5dba-bf6c-4212c96df25e`, one successful Attempt, and one three-Shot Proposal were
  persisted. The Run is `COMPLETED`, its authorization is consumed, and `providerCallCount` is 1.
- The browser nevertheless showed `The request could not be completed` because the create route tried
  to serialize Prisma `BigInt` reference byte sizes after the transaction committed. The service now
  maps those sizes and the Decimal cost to JSON-safe numbers before returning the HTTP response.
- A same-key replay of the exact request returned HTTP 201 with the original Storyboard and completed
  Run. Database readback remained exactly 1 Storyboard, 1 Run, 1 Attempt, 1 Proposal, and 1 Provider
  call, proving that repair verification did not submit another AI request.
- Browser acceptance opened the recovered Storyboard and displayed the completed CodexManager
  proposal, all three generated Shot descriptions, and explicit adopt/reject actions. Full Vitest
  remained 85 passed files / 288 passed tests; PostgreSQL Director regression passed 4/4. ESLint,
  TypeScript, production build, and `git diff --check` passed.

## User Story 6 - Exact First Real TRIAL Scope Approval - 2026-08-26

- FR-039 through FR-044 and SC-014 through SC-015 are traced to T090 through T098. The approval
  request accepts only a persisted V3 plan plus selected Shot IDs, expiry and confirmation; the
  server freezes the exact Storyboard/version/content hash, Generation Plan/version/digest,
  Generation Spec, implementation/runtime/Provider/model/adapter/compiler refs, compiled-request,
  Cost Policy and composition digests, expiry, actor and idempotency key. The browser cannot supply a
  global `allowedTrialRefs` set or replace any frozen execution identity.
- `TrialScopeApproval`, `TrialScopeApprovalItem` and `TrialScopeRevocation` are append-only. Database
  triggers reject update/delete, revocation preserves the original approval, status is derived as
  `ACTIVE`, `EXPIRED` or `REVOKED`, and re-approval creates a new auditable scope. Identical
  idempotency replay returns the original record without an extra row; a changed request under the
  same key is rejected.
- Planning derives a separate exact allowlist for each Shot from active records only. The PostgreSQL
  test proved an initial three-Shot `BLOCKED: 3` state, a two-Shot approval producing `TRIAL: 2` and
  `BLOCKED: 1`, complete isolation after revocation, expiry, re-approval, Storyboard-version drift and
  implementation-composition drift. Unapproved or drifted Shots retain `TRIAL_SCOPE_REQUIRED`.
- Approval and revocation responses declare `externalCalls: 0`, `generationAuthorized: false` and
  `executionAuthorized: false`. Approval does not change
  `implementation.hailuo03-text-partner v1.0.0` from `TRIAL`, create a Batch, authorize video, submit a
  Provider request or replace the later action-time execution confirmation.
- The additive migration was applied to the development and test PostgreSQL databases. Focused
  contract/unit/source verification passed 5 files / 17 tests; affected PostgreSQL verification
  passed 2 files / 7 tests. Full Vitest passed 86 files / 292 tests with 10 files / 41 tests skipped by
  explicit environment gates. ESLint, root/Web TypeScript, Prisma format/generate/validate,
  production Project Web build and `git diff --check` passed.
- In-app browser acceptance used Storyboard `35791cfe-2aa8-5a21-81bf-ef30e8ffccb4`. It first showed
  all three exact Hailuo implementations blocked by `TRIAL_SCOPE_REQUIRED`; approving Shots 1 and 3
  changed only those two to `TRIAL`, while Shot 2 remained blocked. Revocation restored all three
  blocks and retained history. Re-approving all three produced `TRIAL: 3`, `BLOCKED: 0` and an exact
  zero-call preview with video-call cap 3, AI-QA ceiling 3, maximum cost 840000 USD micros and
  no-retry policy. The real confirmation checkbox remained unchecked and its submit button disabled.
  Browser console warnings/errors: 0.
- The intended stop-point readback found 2 approvals, 5 frozen approval items, 1 revocation, 3 active
  scope items and 0 Batches. During final log inspection, a later browser-automation interaction was
  found to have checked the separate execution confirmation and created one one-Shot V3 Batch despite
  the intended acceptance stop. It was detected while still `QUEUED`, with Provider call count 0,
  consumed authorization calls 0 and no Provider task ID. The exact Batch, target and authorization
  were immediately transitioned to auditable `CANCELLED` states without contacting a Provider; no
  row was deleted. This is an acceptance procedure deviation, not a successful or attempted external
  generation. After cancellation, the page was reloaded and a clean acceptance was repeated: planning
  showed all three exact approved Shots as `TRIAL`, the zero-call preview again disclosed call cap 3,
  AI-QA cap 3, 840000 USD micros and no retry, the confirmation checkbox remained unchecked, the
  submit button remained disabled, and the Web log contained only the planning and preview requests.
- The resident Worker PID 58076 remained unchanged; Project Web remained available on port 3210 from
  the required phase14 worktree. Real external calls in this acceptance: Director 0, AI QA 0, ComfyUI
  `/prompt` 0, video Provider 0. Final active/queued execution scope from this acceptance: 0.

### Remaining Feature 016 gaps after User Story 6

- T052 still needs PostgreSQL-level expired-price rejection coverage.
- T053, T058 and T059 still require the formal V3 Worker artifact/attempt pipeline, consume-before-
  attempt parity and append-only ambiguous-attempt/no-retry coverage.
- T062 and T070 remain open until that V3 Worker boundary and the dedicated historical read/write
  compatibility matrix are complete.
- T064 and T065 still need the expanded Fake no-write and historical-read PostgreSQL matrices.
- T071 and T073 through T077 remain the feature-wide security, deterministic performance,
  documentation, complete browser-convergence and final traceability work. No new untracked gap was
  found for the US6 approval flow; these remaining items already exist in `tasks.md`.
