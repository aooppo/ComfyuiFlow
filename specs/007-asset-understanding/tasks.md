# 任务：语义资产基础与素材理解

**输入**：[spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、
[data-model.md](data-model.md) 与 `contracts/`  
**测试要求**：涉及字节完整性、数据库隔离、不可变版本、外部调用授权和人工批准，全部用户故事
必须测试先行。真实 Provider 调用不在任务范围内。

## Phase 1：设置与共享合同

- [ ] T001 在 `packages/project-core/src/project-asset-contracts.ts` 定义 ProjectAsset 状态、分页、重验证和安全错误 Schema
- [ ] T002 [P] 在 `packages/project-core/src/production-asset-contracts.ts` 定义 ProductionAsset、Version、ReferenceUsage、Viewpoint、ShotScale 和 Character State Schema
- [ ] T003 [P] 在 `packages/project-core/src/asset-candidate-contracts.ts` 定义 `asset-candidate-v1` 请求、结果、解释码和规范化哈希 Schema
- [ ] T004 [P] 在 `packages/project-core/src/analysis-contracts.ts` 定义 Manifest、Grant、Run、Attempt、Revision、Review 和 Application Schema
- [ ] T005 在 `packages/contracts/src/index.ts` 导出版本化公共 DTO，并保持现有 Storyboard/Phase 1 合同兼容
- [ ] T006 [P] 在 `.env.example` 和 `packages/project-core/src/analysis-config.ts` 增加零调用默认、图片限制、Lease 和 LIVE Gate 配置
- [ ] T007 在 `packages/project-core/src/index.ts` 与 `tsconfig.base.json` 导出/解析新增服务合同

**检查点**：公共合同可编译，默认配置无法发生外部调用。

---

## Phase 2：用户故事 1——可信文件资产（P1）

**目标**：修复 Phase 1 文件可信度、逐项导入审计和大型素材库读取。

**独立测试**：导入碰撞、损坏、重复和局部失败 Fixture；每项有终态，错误字节不被复用，
损坏媒体不为 READY，分页稳定。

### 测试

- [ ] T008 [P] [US1] 在 `tests/unit/project-storage.test.ts` 先写已有同尺寸不同内容必须重算 SHA-256 并拒绝覆盖的失败测试
- [ ] T009 [P] [US1] 在 `tests/unit/media.test.ts` 先写合法签名但截断/损坏媒体进入 INVALID、探测结果追加且错误脱敏的失败测试
- [ ] T010 [P] [US1] 在 `tests/integration/project-asset-workspace.test.ts` 先写批次逐项终态、局部失败隔离和所有拒绝均有 Attempt 的失败测试
- [ ] T011 [P] [US1] 在 `tests/integration/project-assets-postgres.test.ts` 先写跨项目 Attempt/Activity 复合外键、状态迁移和探测不可变测试
- [ ] T012 [P] [US1] 在 `tests/contract/project-assets-api.test.ts` 先写游标分页、总数、搜索、状态/媒体筛选和用户安全错误合同

### 实现

- [ ] T013 [US1] 在 `packages/project-core/prisma/schema.prisma` 把领域模型映射为 ProjectAsset，增加 PRESERVED/INVALID 状态、MediaProbeResult、AssetImportBatch、复合键和分页索引
- [ ] T014 [US1] 在 `packages/project-core/prisma/migrations/202608250001_project_asset_hardening/migration.sql` 编写兼容迁移，将旧 READY 设为 PRESERVED且保留物理 `Asset` 表/旧列
- [ ] T015 [US1] 在 `packages/project-core/src/local-storage.ts` 实现已存在目标的流式 SHA-256 复核、字节不一致安全失败和永不覆盖
- [ ] T016 [US1] 在 `packages/project-core/src/media-probe.ts` 与 `packages/project-core/src/media-probe-service.ts` 实现版本化结构探测、追加事实和 READY/INVALID 状态转换
- [ ] T017 [US1] 在 `packages/project-core/src/asset-service.ts` 与 `packages/project-core/src/asset-import-service.ts` 实现先建批次/逐项 Attempt、独立错误捕获和终态汇总
- [ ] T018 [US1] 在 `packages/project-core/src/project-asset-service.ts` 实现稳定游标分页、搜索、筛选和 MediaProbeResult 投影
- [ ] T019 [US1] 在 `apps/project-web/app/api/projects/[projectId]/assets/route.ts` 和 `apps/project-web/app/api/projects/[projectId]/assets/revalidate/route.ts` 接入分页与本地重验证 API
- [ ] T020 [US1] 在 `apps/project-web/components/asset-library.tsx` 和 `apps/project-web/components/asset-importer.tsx` 展示四态、逐项结果、分页搜索和安全探测说明
- [ ] T021 [US1] 在 `packages/project-core/src/operation-log.ts` 增加导入/重验证安全操作码及路径、工具输出和用户内容脱敏测试

**检查点 A**：SC-001–SC-003 通过；旧数据/字节未丢失。此处必须先验收再建立语义层。

---

## Phase 3：用户故事 2——可复用 ProductionAsset（P1）

**目标**：将 Character、Outfit、Prop 等稳定身份与文件分离，并建立不可变版本/用途绑定。

**独立测试**：一个 OutfitVersion 绑定三张不同用途图片；发布 v1/v2 后只有一个 ACTIVE，历史
可读；跨项目绑定原子拒绝。

### 测试

- [ ] T022 [P] [US2] 在 `tests/unit/production-assets.test.ts` 先写类型、草稿/发布状态机、发布后不可变和 Legacy Role 不再写入测试
- [ ] T023 [P] [US2] 在 `tests/integration/production-assets-postgres.test.ts` 先写单 ACTIVE、并发发布、项目复合外键和无部分写入测试
- [ ] T024 [P] [US2] 在 `tests/contract/production-assets-api.test.ts` 先写创建、分页、新版本、发布、文件绑定、资产关系、幂等与 If-Match 合同

### 实现

- [ ] T025 [US2] 在 `packages/project-core/prisma/schema.prisma` 增加 ProductionAsset、ProductionAssetVersion、AssetVersionFile、ProductionAssetRelation 及唯一/部分索引设计
- [ ] T026 [US2] 在 `packages/project-core/prisma/migrations/202608250002_production_assets/migration.sql` 创建语义资产表、项目复合约束和发布不可变保护
- [ ] T027 [US2] 在 `packages/project-core/src/production-asset-service.ts` 实现创建、草稿修订、事务发布、退休、历史锁定和项目幂等
- [ ] T028 [US2] 在 `packages/project-core/src/asset-version-file-service.ts` 实现 READY 文件绑定、用途/视角/景别验证、人工来源与等价去重
- [ ] T029 [US2] 在 `packages/project-core/src/production-asset-relation-service.ts` 实现版本化语义关系、类型规则和项目隔离
- [ ] T030 [US2] 在 `packages/project-core/src/legacy-asset-role-migration.ts` 生成仅供用户确认的 ReferenceUsage/Viewpoint 建议，模糊 AUDIO/OTHER 标记 NEEDS_REVIEW
- [ ] T031 [US2] 在 `apps/project-web/app/api/projects/[projectId]/production-assets/route.ts`、`apps/project-web/app/api/production-assets/[assetId]/versions/route.ts` 和 `apps/project-web/app/api/production-asset-versions/[versionId]/route.ts` 实现列表、创建、新版本和版本读取 API
- [ ] T032 [US2] 在 `apps/project-web/app/api/production-asset-versions/[versionId]/files/route.ts`、`apps/project-web/app/api/production-asset-versions/[versionId]/relations/route.ts` 和 `apps/project-web/app/api/production-asset-versions/[versionId]/publish/route.ts` 实现文件绑定、资产关系与原子发布 API
- [ ] T033 [US2] 在 `apps/project-web/components/production-assets/production-asset-library.tsx` 与 `production-asset-editor.tsx` 实现类型、版本历史、文件用途绑定和发布 UI

**检查点 B**：SC-004 的语义资产部分与 SC-005 通过；文件身份和语义身份在 UI/API 中明确分离。

---

## Phase 4：用户故事 3——Character 版本与状态（P1）

**目标**：一个 Character 拥有多个版本/状态，Outfit 等独立复用，普通 Prop 留在镜头层。

**独立测试**：Lala daily/gala Fixture 分别组合 Outfit/Accessory；状态发布后不可改；PROP 组件
被拒绝。

### 测试

- [ ] T034 [P] [US3] 在 `tests/unit/character-states.test.ts` 先写 Character 身份、状态版本、允许组件类型、PROP 拒绝和发布不可变测试
- [ ] T035 [P] [US3] 在 `tests/integration/character-states-postgres.test.ts` 先写每个 stateKey 单 ACTIVE、daily/gala 同时活动、组件项目/类型复合约束、并发发布和历史读回测试
- [ ] T036 [P] [US3] 在 `tests/contract/character-states-api.test.ts` 先写角色版本、状态草稿、组件绑定、发布、幂等和安全错误合同

### 实现

- [ ] T037 [US3] 在 `packages/project-core/prisma/schema.prisma` 增加 CharacterProfile、CharacterVersion、CharacterStateVersion、CharacterStateComponent 与类型/唯一约束
- [ ] T038 [US3] 在 `packages/project-core/prisma/migrations/202608250003_character_states/migration.sql` 创建角色状态表、每个 stateKey 单 ACTIVE 索引和发布不可变保护
- [ ] T039 [US3] 在 `packages/project-core/src/character-service.ts` 实现 CHARACTER 类型专属资料、版本创建/发布和历史锁定
- [ ] T040 [US3] 在 `packages/project-core/src/character-state-service.ts` 实现状态草稿/发布、组件类型校验、继承和项目隔离
- [ ] T041 [US3] 在 `apps/project-web/app/api/character-profiles/[characterProfileId]/versions/route.ts`、`apps/project-web/app/api/character-versions/[characterVersionId]/states/route.ts`、`apps/project-web/app/api/character-state-versions/[stateVersionId]/components/route.ts` 和 `apps/project-web/app/api/character-state-versions/[stateVersionId]/publish/route.ts` 实现版本、状态、组件和发布 API
- [ ] T042 [US3] 在 `apps/project-web/components/character-states/character-state-editor.tsx` 实现角色版本、状态版本和 Outfit/Hair/Makeup/Accessory 组合 UI，并说明 Prop 属于 Shot
- [ ] T043 [US3] 在 `tests/fixtures/production-assets/lala-states.ts` 建立 daily/gala、礼服、耳环和雨伞的确定性共享 Fixture

**检查点 C**：完整 SC-004/SC-005 通过；可从数据库重建每个角色状态的精确组件版本。

---

## Phase 5：用户故事 4——AI 分镜候选准备（P2）

**目标**：按结构化硬条件返回可解释候选/缺口，不创建正式 Shot 选择。

**独立测试**：请求 Lala gala 全身参考；其他角色、状态、项目、用途、未批准和非 READY 文件
全部排除；重复运行输出相同。

### 测试

- [ ] T044 [P] [US4] 在 `tests/unit/asset-candidates.test.ts` 先写九级硬过滤、失败关闭、稳定排序和错误身份永不恢复测试
- [ ] T045 [P] [US4] 在 `tests/integration/asset-candidates-postgres.test.ts` 先写 ACTIVE/锁定历史、状态组件、批准投影、媒体能力和查询数上界测试
- [ ] T046 [P] [US4] 在 `tests/contract/asset-candidates-api.test.ts` 先写 v1 输入组合、eligible/rejected/gaps、稳定解释码及 `formalSelectionCreated=false` 合同

### 实现

- [ ] T047 [US4] 在 `packages/project-core/src/asset-candidate-policy.ts` 实现 `deterministic-assets-v1` 硬过滤顺序、失败码和可解释排序事实
- [ ] T048 [US4] 在 `packages/project-core/src/asset-candidate-service.ts` 实现项目范围只读查询、锁定/ACTIVE 版本解析、状态组件校验和规范化结果哈希
- [ ] T049 [US4] 在 `apps/project-web/app/api/projects/[projectId]/asset-candidates/preview/route.ts` 实现零调用候选预览 API，禁止写 Storyboard/Shot/Manifest
- [ ] T050 [US4] 在 `apps/project-web/components/production-assets/asset-candidate-preview.tsx` 实现需求输入、合格候选、排除原因和缺口 UI
- [ ] T051 [US4] 在 `tests/integration/asset-candidates-postgres.test.ts` 增加 500 文件/100 语义版本的 2 秒目标及确定性快照

**检查点 D**：SC-006、SC-007 通过且外部调用为 0。`asset-candidate-v1` 冻结后，Phase 3 可用
Fixture/Fake Director 并行开发，但不得持久化正式资产选择。

---

## Phase 6：用户故事 5——受控素材理解与审核（P2）

**目标**：零调用预览、最多一次 Fake Provider Attempt、追加机器/人工修订和显式应用。

**独立测试**：无凭证预览调用数 0；Fake 成功/失败/崩溃均不产生第二 Attempt；修正不改变机器
Revision；只有批准投影可显式应用。

### 基础与测试

- [ ] T052 [US5] 在 `apps/project-worker/package.json`、`apps/project-worker/tsconfig.json`、`apps/project-worker/src/index.ts` 和根 `package.json` 增加独立单并发 Worker 骨架/脚本
- [ ] T053 [P] [US5] 在 `tests/unit/analysis-authorization.test.ts` 先写清单哈希、过期、网络前消费、幂等、Lease 恢复和不返还测试
- [ ] T054 [P] [US5] 在 `tests/contract/asset-understanding-provider.test.ts` 先写能力、精确槽位、非法结果、`store:false`、零 SDK 重试和安全字段合同
- [ ] T055 [P] [US5] 在 `tests/integration/asset-understanding.test.ts` 先写零调用预览、Fake 成功/失败/超时/歧义、重复投递和禁止部分修订测试
- [ ] T056 [P] [US5] 在 `tests/integration/understanding-review.test.ts` 先写机器不可变、接受/拒绝/修正、Approved Projection 和幂等显式应用测试
- [ ] T057 [P] [US5] 在 `tests/contract/asset-understanding-api.test.ts` 先写 Preview/Run/History/Review/Correction/Application API 和用户安全错误合同

### 数据与服务实现

- [ ] T058 [US5] 在 `packages/project-core/prisma/schema.prisma` 增加 Manifest/Item、AiCallGrant、Run、Attempt、Revision、Review、Application 和队列/历史索引
- [ ] T059 [US5] 在 `packages/project-core/prisma/migrations/202608250004_asset_understanding/migration.sql` 创建追加证据表、唯一 Attempt、项目复合约束和不可变保护
- [ ] T060 [US5] 在 `packages/project-core/src/analysis-manifest.ts` 实现 A1–A9 清单、能力查询、输入限制、规范化哈希、过期和源文件复核
- [ ] T061 [US5] 在 `packages/project-core/src/analysis-service.ts` 实现零调用预览、事务化 Grant 创建/消费、幂等入队和安全状态机
- [ ] T062 [US5] 在 `packages/project-core/src/analysis-content.ts` 实现只读 READY 文件、哈希复核、内存编码和路径/Base64 不持久化
- [ ] T063 [US5] 在 `packages/project-core/src/analysis-worker.ts` 实现行锁/Lease、执行前复核、唯一 Attempt、全有或全无 Revision 和 AMBIGUOUS 恢复
- [ ] T064 [US5] 在 `packages/project-core/src/understanding-service.ts` 实现追加 Review/OWNER 修订、Approved Projection 和仅应用到 DRAFT 且不覆盖人工字段的显式 Application

### Provider、API 与 UI

- [ ] T065 [P] [US5] 在 `packages/ai-providers/src/provider.ts` 和 `packages/ai-providers/src/index.ts` 扩展 `ASSET_UNDERSTANDING` 判别能力且不放宽现有合同
- [ ] T066 [P] [US5] 在 `packages/ai-providers/src/fake-asset-understanding-provider.ts` 实现可控成功/非法/超时并精确计数的 Fake Adapter
- [ ] T067 [P] [US5] 在 `packages/ai-providers/src/openai-asset-understanding-provider.ts` 实现固定 OpenAI Adapter、严格 Schema、有限超时、`store:false` 和 retry=0，但不执行 LIVE
- [ ] T068 [US5] 在 `apps/project-worker/src/index.ts` 接入 Provider Registry、单并发领取、安全退出和无自动回退
- [ ] T069 [US5] 在 `apps/project-web/app/api/projects/[projectId]/asset-analyses/preview/route.ts`、`asset-analyses/route.ts` 和 `apps/project-web/app/api/asset-analyses/[runId]/route.ts` 实现预览/确认/状态 API
- [ ] T070 [US5] 在 `apps/project-web/app/api/project-assets/[assetId]/understanding/route.ts`、`apps/project-web/app/api/understanding-revisions/[revisionId]/reviews/route.ts`、`apps/project-web/app/api/understanding-revisions/[revisionId]/corrections/route.ts` 和 `apps/project-web/app/api/understanding-revisions/[revisionId]/applications/route.ts` 实现历史、审核、修正和应用 API
- [ ] T071 [US5] 在 `apps/project-web/components/asset-understanding/analysis-selection.tsx`、`analysis-preview.tsx` 和 `analysis-run.tsx` 实现多选、外发确认、进度和歧义 UI
- [ ] T072 [US5] 在 `apps/project-web/components/asset-understanding/understanding-review.tsx` 实现原图对照、机器/人工来源、接受/拒绝/修正和显式目标应用 UI
- [ ] T073 [US5] 在 `tests/integration/asset-understanding-postgres.test.ts` 验证真实 PostgreSQL 的授权原子消费、`SKIP LOCKED`、唯一 Attempt、重启读回、不可变触发器和批准投影

**检查点 E**：SC-008–SC-010/SC-012 通过；Fake 完整，真实 Provider LIVE 保持关闭。

---

## Phase 7：收敛、迁移证据与交付

- [ ] T074 [P] 在 `README.md` 与 `apps/project-web/README.md` 记录三层资产模型、重验证、版本/状态、候选失败关闭、Worker 和零调用规则
- [ ] T075 [P] 在 `tests/unit/security.test.ts` 扩展 storageKey/路径、探测输出、Provider Payload、用户修正和凭证脱敏测试
- [ ] T076 在 `tests/integration/phase2-migration.test.ts` 演练 Phase 1 快照迁移并核对行数、状态、SHA-256、活动和无二进制变化
- [ ] T077 在 `specs/007-asset-understanding/verification.md` 记录 quickstart 的数据库读回、Lala 状态、候选哈希、性能、Worker 崩溃、Human QA 和外部调用账本
- [ ] T078 执行仓库格式、lint、类型、单元/合同/集成、Prisma、真实 PostgreSQL、生产构建、密钥扫描和 `git diff --check` 质量门并把精确命令/结果写入 `verification.md`
- [ ] T079 对照 FR-001–FR-034 与 SC-001–SC-012 运行 Spec Kit analyze/converge，补齐未实现任务并更新任务状态和验证证据

## 依赖与执行顺序

- Phase 1 共享合同完成后，US1 是所有后续故事的阻塞入口。
- US2 依赖 US1 READY/ProjectAsset/MediaProbeResult；US3 依赖 US2 ProductionAssetVersion。
- US4 依赖 US2/US3 及人工批准的 AssetVersionFile；这是 Phase 3 并行开发 Gate。
- US5 的零调用预览依赖 US1；批准结果应用依赖 US2。Worker 基础可以在 US2/US3 UI 期间开发，
  但正式集成按检查点顺序。
- 每个故事先提交失败测试，再实现数据库/领域服务，最后 HTTP/UI；不得先做 LIVE 验收。

## 可并行任务

- 同一故事中标记 `[P]` 的单元、合同和数据库测试可在共享 Schema 冻结后并行。
- T025/T026 完成后，T027–T030 可按服务边界并行；T037/T038 后 T039/T040 可并行。
- Candidate v1 冻结并通过检查点 D 后，Phase 3 的 Storyboard/Shot Schema、编辑器壳和 Fake
  Director 可在独立分支并行；不得提前写正式 ShotAssetBinding。
- T065–T067 可在分析合同冻结后并行，但 OpenAI Adapter 的存在不授权网络调用。
- 文档/安全测试 T074/T075 可与数据库性能和迁移证据准备并行。

## 追踪关系

- US1：FR-001、FR-002、FR-003、FR-004、FR-005、FR-006、FR-007、FR-008；SC-001、SC-002、
  SC-003、SC-011。
- US2：FR-009、FR-010、FR-011、FR-012、FR-013、FR-014、FR-017、FR-019；SC-004、SC-005、
  SC-011。
- US3：FR-015、FR-016、FR-017、FR-018、FR-019；SC-004、SC-005。
- US4：FR-020、FR-021、FR-022、FR-023、FR-024；SC-006、SC-007、SC-008、SC-011。
- US5：FR-025、FR-026、FR-027、FR-028、FR-029、FR-030、FR-031、FR-032、FR-033、FR-034；
  SC-008、SC-009、SC-010、SC-012。

全部 79 个任务均包含 checkbox、连续编号、适用的 `[P]`/用户故事标签和明确文件路径。任务
完成不等于获得真实外部图片上传、付费调用、Storyboard 自动批准或视频生成权限。

## Phase 8：收敛

- [ ] T080 [US1] 补齐 `tests/integration/project-assets-postgres.test.ts` 与 `tests/contract/project-assets-api.test.ts`，证明批次逐项唯一终态、跨项目复合外键、探测追加不可变、游标搜索/总数和安全错误（partial）。
- [ ] T081 [US2] 实现 `packages/project-core/src/legacy-asset-role-migration.ts` 的只读建议，并在 `production-asset-library.tsx` 中提供 READY 文件用途绑定、关系与 If-Match 冲突提示（missing）。
- [ ] T082 [US2] 补齐 `tests/integration/production-assets-postgres.test.ts`、`tests/contract/production-assets-api.test.ts`，覆盖并发发布、单 ACTIVE、跨项目原子拒绝和不可变历史（partial）。
- [ ] T083 [US3] 补齐 Lala daily/gala 共享 fixture、角色状态组件编辑/发布 UI，以及 `tests/integration/character-states-postgres.test.ts` / API 合同测试（partial）。
- [ ] T084 [US4] 将候选硬过滤策略抽为 `asset-candidate-policy.ts`，并补 PostgreSQL 的状态组件/批准/性能快照及 API 合同测试，证明错误身份不会恢复（partial）。
- [ ] T085 [US5] 将分析内容读取抽为 `analysis-content.ts`，用 PostgreSQL `FOR UPDATE SKIP LOCKED` 或等价可证明实现领取，补授权原子消费、Lease 崩溃、唯一 Attempt、全有或全无 Revision 的 PostgreSQL 测试（partial）。
- [ ] T086 [US5] 补齐 Fake INVALID/timeout 与 OpenAI adapter 的 retry/timeout/store 安全合同测试，以及 Preview/Run/History/Review/Correction/Application HTTP 合同测试（partial）。
- [ ] T087 [US5] 完成理解审核 UI 的 Owner correction、Approved Projection、显式 draft-target application 与原图对照，并以 Human QA 验证四态、语义版本、角色状态、候选和 LIVE 警告（partial）。
- [ ] T088 [US1-US5] 执行 Phase 1 快照迁移演练，记录迁移前后行数/状态/SHA、Lala 候选哈希、Worker 重启和完整质量门到 `verification.md`，然后更新原任务完成状态（partial）。
