# Verification: Workflow Agent and Cross-Shot Execution

## Baseline Audit - 2026-08-26

- Authoritative worktree: `/Users/tj/Documents/ChatGPT/ComfyuiFlow-phase14`.
- Branch: `codex/015-workflow-agent` from `0612d689f59a4fdad7ded87754d12278653d7dc6`.
- Preserved pre-existing business changes:
  - `apps/project-web/components/storyboards/storyboard-director-panel.tsx`
  - `packages/project-core/src/storyboard-director-service.ts`
  - `tests/unit/storyboard-director-v2.test.ts`
- Preserved generated development drift, excluded from audited staging unless intentionally resolved:
  - `apps/project-web/next-env.d.ts`
- Existing `workflows/registry.json` SHA-256:
  `3128cd0d67bbd5d55cbcb8d524a8007f285a08dc8241bac59a7fd97865e05cc1`.
- Existing `minimax-h3-project-shot-4s-v1.api.json` SHA-256:
  `6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a`.

## Phase 1 Baseline

- Command: `pnpm exec vitest run tests/contract/minimax-h3-workflow.test.ts tests/contract/generation-execution-boundaries.test.ts --no-file-parallelism --maxWorkers=1`
- Result: 2 files passed, 9 tests passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 2 Foundation

- Prisma schema: formatted, client generated, and validated successfully.
- Migration rehearsal: all 19 migrations, including `202608260019_workflow_agent`, applied from an empty PostgreSQL database.
- PostgreSQL integration: 1 file passed, 3 tests passed; covered V1 nullable compatibility, implementation identity guards, lifecycle updates, and append-only evidence.
- Foundation regression: 5 files passed, 20 tests passed; covered V2 contracts, registry, adapters, preserved H3 workflow bytes, and execution boundaries.
- TypeScript: root and Project Web typechecks passed.
- Diff hygiene: `git diff --check` passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 3 User Story 1 - Deterministic Planning

- Determinism: the same normalized planning fixture was replanned 100 times with one unique preview hash.
- Planning coverage: Requirement Analyzer, canonical requirement hashes, stable DAG topology, cycle/missing-Shot rejection, downstream closure, READY/BLOCKED/WAITING propagation, hard capability/input/constraint filters, AUTO/PREFERRED/LOCKED, 95% Wilson lower bound, 30/15/5 switch penalties, cost/latency/stable ties, READY reference, evidence-gated TRIAL, direct-request allowlists, and safe validation.
- Blocker coverage: missing capability, price, credential/readiness, adapter, catalog, pattern, and unsafe direct fields/endpoints fail before dispatch.
- API coverage: strict request schemas, `Cache-Control: no-store`, CAS, idempotency, safe error mapping, DRAFT-only writes, and no generation authorization.
- Automated result: 11 files passed, 36 tests passed; PostgreSQL 1 file passed, 4 tests passed.
- Migration rehearsal: all 19 migrations applied successfully from an empty `comfyuiflow_migrate_015` database after the nullable BLOCKED/WAITING plan correction.
- TypeScript, Prisma validation, and `git diff --check`: passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 4 User Story 2 - Atomic Mixed Batch

- V2 confirmation is a strict `WORKFLOW_AGENT_V1` request; legacy V1 requests remain accepted without an engine discriminator.
- One serializable transaction verifies current approved plan/CAS, exact target/template hashes, READY/TRIAL state, dependency closure, implementation/adapter identity, integer-micros cost and price expiry, Project cost ceiling, QA continuation policy, and preview hash before creating any row.
- The same transaction creates one Batch, heterogeneous targets/jobs, exact authorization/cost reservation facts, and freezes every selected plan; a stale target hash left zero Batch rows and both plans DRAFT.
- Worker dispatch resolves each frozen target's adapter/version and classifies pre-dispatch, provider rejection, and ambiguous submission separately; no retry/fallback path was added.
- Safe Batch detail omits provider task IDs and internal execution input snapshots while exposing safe implementation summaries.
- Automated result: 4 contract/unit files passed, 16 tests passed; PostgreSQL 1 file passed, 5 tests passed; TypeScript and diff checks passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 5 User Story 3 - Cross-Shot Dependency Execution

- Exact final-frame extraction enumerates decoded video frames, selects the last frame by decoded index, persists frame index, integer PTS, rational time base, timestamp, storage hash, and `dependency-final-frame-v1` independently from QA review frames.
- Worker claim SQL orders by Batch/Shot/job and leaves a downstream target unclaimable until its exact upstream plan has one technically valid artifact and dependency frame.
- Symbolic dependencies materialize once into an `ExecutionInputSnapshot`; the authorization consumption records the materialized execution SHA. Re-reading changed upstream hashes returns `MATERIALIZED_INPUT_SHA_MISMATCH` and invalidates only the affected downstream closure.
- A two-Shot real local-media fixture produced one upstream call, persisted its exact dependency frame, then released Shot 2 with the matching artifact/frame hashes. A typed upstream rejection left Shot 2 QUEUED with provider call count 0.
- Exact artifact reuse requires the same plan template/requirements, a materialized source target, technical validity, and a dependency frame; it creates no Job. Draft and Final Assembly select the frozen reuse artifact rather than a newer attempt.
- Automated result: final-frame/Draft/Assembly 3 files passed, 8 tests passed; PostgreSQL end-to-end 1 file passed, 5 tests passed; TypeScript passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0. Local FFmpeg/FFprobe only.

## Phase 6 User Story 4 - Blocked Shot Repair Loop

- Every BLOCKED Shot exposes the same stable five-action order with canonical proposal and impact hashes: implementation change, accepted relaxation, asset replacement navigation, rewrite, and split.
- Implementation change and relaxation append planning preferences and invalidate only the dependency closure. Asset replacement is a zero-call navigation result. None authorizes generation or Director work.
- Rewrite/split use a distinct `SHOT_REPAIR` Director preview, Storyboard CAS, price snapshot, one-call authorization, one immutable attempt, and the existing no-retry/no-fallback worker lifecycle. Fake fixtures record 0 real provider calls.
- Rewrite preserves the blocked Shot key. Split derives deterministic child keys from impact hash, output hash, and child ordinal. Strict output rejects the wrong replacement count.
- Adoption rejects stale proposal/impact hashes before any write, appends a reversible StoryboardVersion, preserves unaffected Shot keys, revalidates every copied or Director-selected file/hash, copies unaffected requirements/bindings, regenerates affected requirements/bindings, clears Storyboard approval, and invalidates only the blocked dependency closure.
- Automated result: unit 1 file passed, 2 tests passed; contract 1 file passed, 2 tests passed; PostgreSQL Director end-to-end 1 file passed, 3 tests passed; TypeScript passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 7 User Story 5 - Auto-Continuation and Unified Owner Review

- The immutable continuation policy advances PASS, WARN, and NOT_ASSESSABLE only when no configured hard criterion has a HIGH-confidence FAIL. Overall FAIL, hard FAIL, explicit pause-after-each-Shot, QA ambiguity/unavailability, technical failure, and cost exhaustion pause the Batch before downstream claim.
- Each AI QA result persists its continuation decision, policy version, and policy hash. AI QA consumes its own authorization operation with a transactionally checked cost reservation; Batch cost totals include optional per-Shot QA estimate/ceiling fields.
- The worker never creates HumanQaDecision rows. Auto-continuation only releases dependency-ready execution; every artifact remains `AWAITING_HUMAN_QA` until explicit Owner PASS/FAIL.
- Batch detail includes a safe `final-owner-review-v1` projection for executed and reused artifacts, with technical status, advisory AI QA, continuation decision, and missing Owner decisions.
- New Workflow Planning, dependency-aware Batch Progress, and Final Owner Review panels are separated from the legacy UI. The new panels expose AUTO/PREFERRED/LOCKED, repair options, business status, collapsed technical evidence, explicit Owner decisions, loading/empty/error states, and no Fake profile label.
- In-app browser acceptance on the isolated local PostgreSQL fixture verified: AUTO/PREFERRED/LOCKED controls; zero-call planning; two honest BLOCKED states; stable five-action repair list with 0/1 call disclosure; dependency Batch pause; retained historical results; Draft warnings; explicit missing Human decisions; and Assembly disabled until Owner PASS. No confirmation or external submission was clicked. The visual capture showed the repair list and collapsed blocker evidence at desktop width.
- Automated result: continuation unit 1 file passed, 4 tests passed; UI contract 1 file passed, 2 tests passed; related contract set 4 files passed, 10 tests passed; Workflow Agent PostgreSQL 1 file passed, 5 tests passed; TypeScript passed.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0. Browser actions used only localhost and the isolated test database.

## Phase 8 User Story 6 - Readiness, Startup, and Rollback

- The ComfyUI node catalog scopes `/object_info` to registered node classes, normalizes only input/output contracts, removes secret/path/default metadata, and records separate full-source and scoped deterministic hashes. Missing exact First/Last catalog evidence remains a blocker.
- Static graph validation rejects unregistered classes/fields, missing required inputs, unsafe literal types/ranges/options, invalid edges/output indexes, cycles, missing output nodes, empty prompts, oversized graphs, traversal, and symlink files. It derives a server-owned output prefix and never calls `/prompt`.
- The new Workflow Agent MCP submit surface accepts only frozen plan/job/authorization IDs plus plan/materialized hashes. The bridge reloads PostgreSQL state, verifies FROZEN lifecycle, exact authorization consumption and materialized SHA, resolves immutable paths internally, rechecks readiness, stages, and submits once. Legacy path-bearing tools remain for historical compatibility only.
- Worker dispatch now uses the frozen-plan adapter. Workflow Agent provider idempotency is the GenerationJob UUID, which is directly compatible with the existing ComfyUI/JobStatus UUID contract.
- `REAL_GENERATION_ENABLED=false` fails before any input staging or `/prompt`; status, retention, supported cancel, and original-task reconciliation remain available for already-submitted work.
- Project readiness aggregates database, Worker, runtime, bridge, credential, quota, current-price, implementation lifecycle, and real technical evidence into safe business blockers. It returns no secret value, endpoint, raw graph, task ID, local path, or machine configuration.
- The development supervisor checks/starts loopback PostgreSQL, deploys migrations, checks loopback ComfyUI, optionally starts only an existing configured install, and owns only the ComfyUI/Web/Worker processes it created. It rejects install commands and redacts credentials/database passwords.
- Rollback is additive: disable real generation, select `legacy-v1`, preserve every plan/evidence/artifact/QA/Owner decision, and use no destructive down migration.
- Automated result: 8 files passed, 31 tests passed, including the Workflow Agent PostgreSQL suite; targeted TypeScript passed separately. Test transport `/prompt` calls occurred only in the pre-existing fake live-bridge contract, never against a real runtime.
- Real external calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0.

## Phase 9 Full Regression and Handoff

- Security/LIVE coverage rejects secret, endpoint, raw graph, local path, arbitrary output-prefix, and
  disabled-real-submission leakage before staging. Query-only reconciliation remains available for an
  already submitted task and no retry/fallback branch was introduced.
- All eight PostgreSQL suites enforce an isolated `*_test` database before mutation. Every affected
  TRUNCATE list explicitly includes `GenerationImplementationEvidence`, `ShotExecutionPlan`, and
  `GenerationImplementation`.
- Existing H3 reference workflow bytes remain unchanged at SHA-256
  `6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a`; output-prefix
  materialization clones the graph and leaves the source bytes/hash unchanged.
- Two read-only localhost `GET /object_info` catalog reads captured the exact redacted
  `MinimaxHailuo03FirstLastFrameNode` fixture at SHA-256
  `3ebf75d3d26042b78ddf7930d06fa4894631d8d32bceea71842c3dfcaa1c7b3e`. It proves the current
  first/optional-last frame fields and VIDEO output, but does not prove a trusted static graph,
  preprocessing, current price, readiness, quota, or one real technical result. The implementation
  therefore remains non-selectable with `FIRST_LAST_FRAME_IMPLEMENTATION_NOT_AVAILABLE` as required
  by FR-034.
- The Project Web planning route registers only the exact H3 reference adapter identity for
  deterministic planning. It does not expose a submit-capable adapter. Worker submission still
  resolves the exact frozen adapter implementation/version.
- Requirement binding roles are normalized at the private execution-plan store boundary, so
  provider-neutral `scene`, `product`, and character roles become only the bridge allowlist values;
  unknown roles are ignored and cannot become a path, endpoint, or arbitrary graph field.
- A real-attempt technical pass now appends `REAL_GENERATION_JOB` evidence and promotes only TRIAL to
  READY. Provider rejection, technical failure, or ambiguous submission appends technical evidence
  and blocks the implementation; zero-call/preflight/fake paths cannot promote it.
- New Workflow Agent UI hides Fake execution, invalidates a preview when preferences change, shows
  exact generation/QA call and integer-micros cost ceilings, requires an explicit checkbox, and sends
  one CAS/idempotency-bound `WORKFLOW_AGENT_V1` Batch confirmation. Legacy history and legacy-only
  controls remain available when the project engine is `legacy-v1`.
- Targeted cross-story regression: 19 files passed, 68 tests passed.
- Complete zero-call suite: 68 files passed, 229 tests passed; 8 PostgreSQL files/33 tests were skipped
  by default and then passed separately in one serial isolated-database run.
- Prisma schema validation, Prettier, ESLint, root/Project Web TypeScript, production workspace build,
  secret scan, and `git diff --check` passed.
- Empty-database migration rehearsal applied all 19 migrations including
  `202608260019_workflow_agent`; the test-only `comfyuiflow_migrate_015` database was dropped after
  verification.
- External generation/AI calls: Director 0, AI QA 0, ComfyUI `/prompt` 0, video Provider 0. Local
  runtime discovery: two read-only localhost `/object_info` reads, no submission, staging, or cost.

## Final Requirement Traceability Audit

| Requirement | Result | Primary implementation and verification evidence                                                  |
| ----------- | ------ | ------------------------------------------------------------------------------------------------- |
| FR-001      | PASS   | V2 requirement schema/compiler and canonical requirement-hash tests.                              |
| FR-002      | PASS   | Deterministic analyzer, planning service, and 100-run hash test.                                  |
| FR-003      | PASS   | Versioned provider/model/executor/implementation registry and immutable DB identity.              |
| FR-004      | PASS   | AUTO/PREFERRED/LOCKED contracts, CAS preferences, selector tests, and owner UI.                   |
| FR-005      | PASS   | Capability/input/runtime/evidence/cost hard filters and blocker tests.                            |
| FR-006      | PASS   | Stable DAG plus whole-Storyboard dynamic-programming selection tests.                             |
| FR-007      | PASS   | Persisted capability/selection snapshots, blockers, hashes, and collapsed technical evidence.     |
| FR-008      | PASS   | Exactly one frozen executor/adapter identity per ShotExecutionPlan.                               |
| FR-009      | PASS   | Server-owned workflow/pattern/block compilation and graph-policy tests.                           |
| FR-010      | PASS   | Class/field/type/edge/DAG/output/orphan/path/prefix graph validation.                             |
| FR-011      | PASS   | Registered direct-adapter boundary; unknown endpoint/cost/adapter fails closed.                   |
| FR-012      | PASS   | Serializable all-or-nothing mixed-implementation Batch integration test.                          |
| FR-013      | PASS   | Stale/hash/blocked/cost/expiry/budget/CAS confirmation rejection tests.                           |
| FR-014      | PASS   | Per-target frozen adapter dispatch with typed no-retry/no-fallback failures.                      |
| FR-015      | PASS   | Stable dependency-ready worker claim and release integration tests.                               |
| FR-016      | PASS   | Exact authorized upstream target/plan/artifact dependency binding.                                |
| FR-017      | PASS   | Last decoded frame index/PTS/time-base/hash extraction tests.                                     |
| FR-018      | PASS   | Write-once materialized input snapshot/SHA and drift invalidation tests.                          |
| FR-019      | PASS   | Exact artifact-reuse eligibility and no-Job/no-consumption tests.                                 |
| FR-020      | PASS   | Stable five-action repair proposals with hashes, calls, and impact closure.                       |
| FR-021      | PASS   | Zero-call implementation/relax/asset actions and affected-only invalidation.                      |
| FR-022      | PASS   | Separate bounded SHOT_REPAIR Director authorization; rewrite/split strict output.                 |
| FR-023      | PASS   | Append-only repair adoption, stable/split keys, binding revalidation, reversible version.         |
| FR-024      | PASS   | Immutable continuation policy; hard/ambiguous/technical/cost stops pause dependents.              |
| FR-025      | PASS   | Generation plus QA calls/costs in one frozen integer-micros Batch snapshot.                       |
| FR-026      | PASS   | Real-call-only TRIAL evidence promotion and failure/ambiguity blocking integration test.          |
| FR-027      | PASS   | Business-state planning/progress/final-review UI with technical details collapsed.                |
| FR-028      | PASS   | Storyboard approval gate, one exact Batch confirmation, and explicit final Owner review.          |
| FR-029      | PASS   | Fake absent from new flow and retained only behind legacy/test paths.                             |
| FR-030      | PASS   | Additive migration, V1 nullable readers/writers, append-only evidence, no down migration.         |
| FR-031      | PASS   | Allowlisted catalog/info/validate/readiness and frozen-plan execution MCP tools.                  |
| FR-032      | PASS   | Safe project readiness aggregation without secrets/machine paths/raw graph/task IDs.              |
| FR-033      | PASS   | Real-disable and legacy-mode rollback with submitted-work query/reconcile only.                   |
| FR-034      | PASS   | Reference workflow bytes locked; First Frame remains TRIAL-gated and First/Last unavailable.      |
| FR-035      | PASS   | Complete implementation/acceptance used zero Director/AI QA/ComfyUI prompt/provider calls.        |
| SC-001      | PASS   | 100 identical plans produced one preview hash and stable order/explanation/cost/DAG.              |
| SC-002      | PASS   | Mixed confirmation produced all rows or zero rows under injected stale failure.                   |
| SC-003      | PASS   | Downstream provider-call count stayed zero until exact upstream technical readiness.              |
| SC-004      | PASS   | Changed Shot invalidated exactly its transitive dependency closure.                               |
| SC-005      | PASS   | Rejection, ambiguity, hard QA, technical, and cost stops produced no extra submission.            |
| SC-006      | PASS   | Two-Shot fixture bound the true final decoded frame and matching materialized SHA.                |
| SC-007      | PASS   | Approved all-ready scope maps to one explicit checkbox/CAS/idempotent Batch confirmation.         |
| SC-008      | PASS   | UI/security contracts expose no raw graph, node ID, secret, endpoint, path, or task ID.           |
| SC-009      | PASS   | Legacy contracts/tests/history remain compatible and engine-selected UI preserves history.        |
| SC-010      | PASS   | Full tests, serial DB, migrations, format, lint, types, build, secret scan, and diff checks pass. |

No implementation requirement remains open. Real provider acceptance is intentionally not claimed:
it requires a new action-time scope, current price/quota/credential facts, exact call/cost limits, and
fresh Owner confirmation.
