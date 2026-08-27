# Feature Specification: Per-Graph Zero-Call Technical Evidence

**Feature Branch**: `codex/018-zero-call-graph-evidence`
**Created**: 2026-08-27
**Status**: Approved for implementation
**Input**: User description: "Implement the next step: dynamic Graph zero-call validation and Graph-instance Evidence after merging capability-generation mainline."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate a frozen graph without generation (Priority: P1)

An operator can preflight a planned shot's frozen graph against the connected ComfyUI runtime before any generation authorization, provider submission, or billing event occurs.

**Why this priority**: A registry entry or node-name check alone cannot prove that the exact graph is executable today.

**Independent Test**: A fixture graph and a fixture node catalog can be validated without calling `/prompt`; invalid node inputs, invalid edges, unavailable nodes, or an unreachable runtime each produce a failed result.

**Acceptance Scenarios**:

1. **Given** a frozen graph and a healthy compatible runtime, **When** the operator starts technical preflight, **Then** the system records a PASS tied to that exact graph digest and runtime facts, without submitting a generation.
2. **Given** a frozen graph that uses a missing node or incompatible input, **When** preflight runs, **Then** it records a readable FAIL and does not create an authorization, attempt, or provider task.
3. **Given** a runtime that cannot be reached, **When** preflight runs, **Then** it records a failed runtime result without attempting generation.

---

### User Story 2 - Prevent evidence from being reused for changed work (Priority: P1)

An operator can create a real-execution authorization only when the exact frozen graph has current successful technical evidence for its runtime contract.

**Why this priority**: A successful check of one graph must not silently authorize a changed graph or a different runtime contract.

**Independent Test**: An authorization request succeeds only with a matching PASS evidence record; changing the graph digest, contract digest, or using a FAIL record is rejected.

**Acceptance Scenarios**:

1. **Given** matching current PASS evidence, **When** a batch is created with separately authorized limits and prices, **Then** the batch may be created but generation is still not submitted by preflight.
2. **Given** no matching PASS evidence or a changed graph digest, **When** a batch is requested, **Then** it is rejected before an attempt or consumption exists.
3. **Given** a prior PASS whose captured runtime catalog no longer matches the runtime seen at submit time, **When** submission is requested, **Then** it fails closed before staging inputs or calling `/prompt`.

---

### User Story 3 - Inspect technical evidence (Priority: P2)

An operator can read the immutable technical result for a graph and see the graph identity, runtime and catalog fingerprints, validator identity, timestamp, and safe failure reasons.

**Why this priority**: The evidence must be auditable without exposing credentials, paths, endpoints, or raw secrets.

**Independent Test**: Stored evidence can be queried by graph snapshot; writes and deletes are rejected by database append-only protection.

**Acceptance Scenarios**:

1. **Given** a completed preflight, **When** the operator inspects its evidence, **Then** the result identifies the graph, contract, runtime facts, catalog fingerprint, validator, outcome, and safe diagnostics.
2. **Given** a caller attempts to alter prior evidence, **When** the write is attempted, **Then** the datastore rejects it.

---

### User Story 4 - Import a compatible Capability Pack and plan a dynamic graph (Priority: P1)

本地管理员可以导入经过审核的 Capability Pack JSON，以追加一个 `TRIAL` capability；随后 Shot
Planner/AI 只能输出受限 Graph Intent，由服务端已发布的 compiler profile 生成该 Shot 的新 frozen
graph。运维不必逐张审批 graph，且导入或规划不得调用 ComfyUI、模型或 provider。

**Independent Test**: 对一份有正确 canonical digest 的 Pack，服务端产生不可变 `TRIAL` registry
registration 与 receipt。对合法的 Shot Intent，服务端可产生 frozen graph identity；raw graph、secret、
未知字段、未注册 compiler、越界参数或白名单外节点必须在任何外部调用前失败。

**Acceptance Scenarios**:

1. **Given** 本地管理员已复核 Pack，**When** 先请求 canonical digest 再导入，**Then** 服务端只追加
   receipt、CapabilityProfile、RuntimeContract 和 `TRIAL` implementation，不产生 generation。
2. **Given** 已导入的兼容 Pack，**When** AI 为一个 Shot 产生合法 Intent，**Then** server-owned compiler
   生成并冻结该 Shot 的 graph，后续 Feature 018 preflight 可按其 digest 校验。
3. **Given** 一个新的 `TRIAL` Pack，**When** graph 通过 zero-call preflight，**Then** 它仍需要独立的
   Owner Trial-scope authorization；当 capability 是 `READY` 时，仍需要该次 action-time authorization。

### Edge Cases

- A catalog response lacks one or more required node definitions.
- A graph includes an undeclared node, a forbidden metadata key, an invalid literal, an invalid link, a cycle, an orphan node, or an output mismatch.
- A catalog changes after a PASS, including one that keeps the same node class names but changes schemas.
- Preflight transport or malformed runtime responses must create safe failure evidence and never fall through to `/prompt`.
- Repeated preflight checks are preserved as separate evidence; no historic PASS is overwritten.
- Capability Pack v1 不能包含任意拓扑、node ID、link、代码、凭据、endpoint 或模型权重。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST fetch only read-only runtime facts and node definitions during technical preflight; it MUST NOT call `/prompt`, stage inputs, consume authorization, or create a generation attempt.
- **FR-002**: The system MUST validate the exact persisted frozen graph digest, runtime-contract digest, declared node classes, node input schemas and values, graph links, graph reachability, and declared output against the current runtime catalog.
- **FR-003**: The system MUST append a Graph Validation Evidence record for every completed PASS or FAIL preflight, including safe runtime and node-catalog fingerprints, validator identity, graph digest, contract digest, timestamp, outcome, and diagnostics.
- **FR-004**: The system MUST make Graph Validation Evidence append-only and prevent browser supplied PASS evidence.
- **FR-005**: The system MUST reject real batch creation unless every target has a matching PASS Graph Validation Evidence record for its frozen graph and runtime-contract digest.
- **FR-006**: The system MUST recheck that the current runtime facts still match the evidence at submission time and fail closed before staging or submitting when they do not.
- **FR-007**: The system MUST provide a server-owned preflight operation and a read-only evidence lookup without returning credentials, filesystem paths, endpoint URLs, or raw secrets.
- **FR-008**: The system MUST retain separate action-time authorization and provider pricing gates; technical preflight alone MUST NOT authorize generation.
- **FR-009**: 服务端 MUST 为 Capability Pack v1 重新计算 canonical SHA-256，并拒绝 digest 不符、未知字段、secret、raw graph、未排序节点白名单和受限 binding 之外的内容。
- **FR-010**: 本地管理员入口 MUST 只追加不可变 receipt、CapabilityProfile、RuntimeContract 和 `TRIAL` GenerationImplementation；导入不联系 runtime、ComfyUI 或 provider，且不创建 authorization、batch 或 attempt。
- **FR-011**: 每个 Shot MUST 先被解析为受限 Graph Intent；只有 server-owned、已注册 compiler profile 可以把它编译为 graph。Pack 可以配置固定 recipe 的节点类和输入名，但不能提供 raw graph、任意 node ID 或 links。
- **FR-012**: 图编译 MUST 冻结 Pack digest、Intent digest、GenerationSpec 与 graph SHA；编译图必须完全属于 RuntimeContract 节点白名单，并可交给 FR-001 的既有 preflight。
- **FR-013**: `TRIAL` graph 的首次真实执行 MUST 保持独立 Owner Trial-scope authorization；`READY` graph 仍 MUST 保持独立按次 action-time authorization。导入、摘要、编译、冻结及预检均不得授权或提交生成。

### Key Entities

- **Graph Validation Evidence**: Immutable outcome of validating one frozen graph against one observed runtime and node catalog.
- **Frozen Graph Snapshot**: The canonical per-generation-spec graph whose digest identifies the exact graph evaluated and submitted.
- **Runtime Contract**: The allowed node classes and identity the graph must satisfy.
- **Capability Pack**: 经过摘要校验的模型/运行目标/受限 recipe 配置；服务端从它派生独立的 registry record 和 receipt。
- **Graph Intent**: AI 可为单个 Shot 提供的受限 prompt、素材引用、时长、比例等数据；它不是 graph。
- **Capability Publication Receipt**: 记录 Pack digest、操作人和所派生 registry identity 的 append-only 导入事实。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Automated tests demonstrate both passing and failing graph preflight paths with zero `/prompt` calls.
- **SC-002**: Automated tests demonstrate that no authorization, attempt, or consumption can be created for a graph without matching PASS evidence.
- **SC-003**: Automated tests demonstrate that a changed graph digest or runtime catalog prevents submission before any input staging or `/prompt` call.
- **SC-004**: Every persisted evidence row is traceable to one frozen graph digest and runtime-contract digest, and database mutation attempts are rejected.
- **SC-005**: 自动化测试证明 Pack digest、严格 schema、server-owned ref freeze、`TRIAL` receipt 与 Graph Intent 编译路径均为零外部调用，且不返回已授权生成。
- **SC-006**: 自动化测试证明一份兼容 Pack 可在不重新部署应用的前提下生成不同 Shot 的 frozen graph；非法 Intent 或 compiler 输出在 preflight 前失败关闭。

## Assumptions

- A ComfyUI runtime exposes `/system_stats` and `/object_info` read-only endpoints.
- The existing capability registry remains the sole source of allowed RuntimeContract node classes.
- Runtime preflight can run while the generation worker is stopped; no real provider credentials or paid calls are needed for automated verification.
- `runtimeTargetRef` 是部署目标身份；每个 Pack 派生自己唯一的 RuntimeContract identity，因此多个模型可以共用同一 ComfyUI MCP/provider 而各自拥有节点合同。

## Clarification Record

- The feature validates persisted, server-owned frozen graphs only; it does not accept browser, worker, or LLM raw graphs.
- "Current" evidence means an exact graph SHA and runtime-contract digest match, plus a submission-time catalog fingerprint recheck. No time-to-live is introduced because no expiry policy is currently published.
- Runtime transport failures are recorded as safe FAIL evidence where a graph identity is available; they do not permit a batch or submission.
- Capability Pack v1 是 JSON；ZIP 仅可作为未来审核附件容器，不是执行载荷。当前管理员口令由 `CAPABILITY_PUBLICATION_ADMIN_TOKEN` 在服务端部署配置，绝不持久化或返回。
