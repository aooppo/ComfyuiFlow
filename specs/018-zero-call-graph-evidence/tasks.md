# Tasks: Per-Graph Zero-Call Technical Evidence

**Input**: Design documents from `/specs/018-zero-call-graph-evidence/`

## Phase 1: Foundation

- [x] T001 Add failing graph validation and read-only client tests in `tests/unit/zero-call-graph-evidence.test.ts`.
- [x] T002 Add the `GraphValidationEvidence` Prisma model, outcome enum, append-only migration, and schema validation in `packages/project-core/prisma/schema.prisma` and `packages/project-core/prisma/migrations/202608270002_zero_call_graph_evidence/migration.sql`.
- [x] T003 Implement scoped static graph validation and safe runtime fingerprints in `packages/comfyui-bridge/src/zero-call-graph-validator.ts`, `packages/comfyui-bridge/src/graph-preflight.ts`, `packages/comfyui-bridge/src/comfyui-client.ts`, and `packages/comfyui-bridge/src/index.ts`.

## Phase 2: User Story 1 - Validate a frozen graph without generation (P1)

- [x] T004 [US1] Add a server-owned snapshot loader and append-only evidence writer in `packages/project-core/src/graph-validation-evidence-service.ts` and `packages/project-core/src/index.ts`.
- [x] T005 [US1] Add MCP preflight wiring that accepts only a persisted snapshot id in `apps/comfyui-mcp/src/server.ts` and `apps/comfyui-mcp/src/index.ts`.
- [x] T006 [US1] Add focused tests proving PASS/FAIL preflight behavior and zero `/prompt` calls in `tests/unit/zero-call-graph-evidence.test.ts`.

## Phase 3: User Story 2 - Prevent evidence reuse (P1)

- [x] T007 [US2] Add a matching PASS-evidence transaction guard before authorization/batch/attempt insertion in `packages/project-core/src/generation-lifecycle-service.ts`.
- [x] T008 [US2] Extend submission records and `packages/comfyui-bridge/src/execution-plan.ts` to load selected evidence and fail before staging or `/prompt` when a fresh catalog does not match it.
- [x] T009 [US2] Add missing-evidence and stale-evidence guard tests in `tests/unit/zero-call-graph-evidence.test.ts` and `tests/contract/generation-mainline-mcp-boundary.test.ts`.

## Phase 4: User Story 3 - Inspect technical evidence (P2)

- [x] T010 [US3] Add safe read-only evidence lookup and immutable-storage tests in `packages/project-core/src/graph-validation-evidence-service.ts`, `tests/contract/graph-validation-evidence-storage.test.ts`, and `specs/018-zero-call-graph-evidence/contracts/zero-call-graph-evidence.md`.

## Phase 5: Verification and Convergence

- [x] T011 Run focused tests, workspace type checks, Prisma validation, `git diff --check`, and the zero-call route assertion; record results in `specs/018-zero-call-graph-evidence/quickstart.md`.
- [x] T012 Re-run Spec Kit convergence against `spec.md`, `plan.md`, and `tasks.md`; no remaining work found.

## Dependencies & Execution Order

- T001-T003 establish schema and validator primitives.
- T004-T006 depend on T002-T003.
- T007-T009 depend on T002 and T004.
- T010 depends on T004.
- T011 follows all implementation and tests; T012 follows T011.

## Phase 6: Convergence

- [x] T013 Validate that the declared graph output is a runtime-declared output node, and cover rejection with a zero-call test per FR-002 / SC-001 (partial).

## Phase 7: Capability Pack 与动态 Graph 扩展

- [x] T014 为 Capability Pack v1 编写 canonical digest、严格 schema、禁止 raw graph/secret 与节点排序的零调用单元测试，文件：`tests/unit/capability-pack.test.ts`。
- [x] T015 在 `packages/project-core/src/capability-pack.ts` 实现纯本地 Capability Pack 解析与校验，并从 `packages/project-core/src/index.ts` 导出；不得访问数据库、ComfyUI、worker 或 provider。
- [x] T016 [P] 为受限 Graph Intent 和通用 Compiler Profile 编写单元测试，文件：`tests/unit/graph-intent.test.ts`。
- [x] T017 实现受限 Graph Intent schema 和确定性通用编译器入口，文件：`packages/project-core/src/graph-intent.ts`。
- [x] T018 设计并实现 Capability Pack 的不可变导入 receipt、`TRIAL` registry transaction 与本地运维 UI；需要数据库迁移、API/UI/权限测试，且不得提交生成。
- [x] T019 将每 Shot Graph Intent -> Compiler -> Test A 可持久化的 GenerationSpec/frozen graph 串联，并证明无需运维逐图审批；保留独立 Owner Trial-scope/按次授权边界。既有 Feature 018 preflight 在 graph 持久化后消费该身份。
