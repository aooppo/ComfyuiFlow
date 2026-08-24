# 实施方案：语义资产基础与素材理解

**分支**：`codex/phase-0-discovery` | **日期**：2026-08-25 | **规格**：[spec.md](spec.md)

## 摘要

Phase 2 不再直接在 Phase 1 `Asset` 上叠加 AI 标签，而是先补齐可信文件层和稳定语义层，再
执行素材理解：

1. **Phase 2A-0 文件底座加固**：把现有 `Asset` 明确为 `ProjectAsset`，复核内容碰撞，增加
   PRESERVED/READY/INVALID 状态、追加式媒体探测、逐项导入审计、分页搜索和项目一致性约束。
2. **Phase 2A-1 语义资产**：建立 ProductionAsset、不可变版本、文件用途绑定和资产关系。
3. **Phase 2A-2 角色状态**：建立 CharacterProfile、CharacterVersion、CharacterStateVersion
   与 Outfit/Hair/Makeup/Accessory 组件关系；普通 Prop 留给 Phase 3 的 Shot 级绑定。
4. **Phase 2A-3 候选准备**：定义未来分镜可消费的 AssetCandidateRequirement，并实现只读、
   确定性、失败关闭的候选预览。
5. **Phase 2B 素材理解**：零调用预览、一次性 LIVE 授权、单尝试 Worker、机器修订、人工审核
   和批准投影；默认验收使用 Fake Provider，真实外部调用不属于本规划授权。

## 技术背景

**语言/版本**：TypeScript 5.9、Node.js 22、React 19  
**主要依赖**：Next.js App Router、Prisma 6、PostgreSQL 16、Zod 4、现有
`AiModelProvider`/OpenAI Responses SDK  
**存储**：PostgreSQL 保存业务元数据和来源链；本地内容寻址 StorageProvider 保存二进制  
**测试**：Vitest 单元/合同/集成测试、Fake Provider、显式真实 PostgreSQL、Prisma 验证、
浏览器 Human QA、密钥扫描和生产构建  
**目标环境**：本地 macOS 浏览器、Node Web/API、一个独立本地单并发 Worker  
**项目类型**：TypeScript 模块化单体  
**性能目标**：500 个文件、100 个语义版本、100 条理解修订下，素材库和候选预览首个有用
结果小于 2 秒；9 张图片分析预览小于 1 秒  
**约束**：本地单用户但项目严格隔离；图片分析每批 1–9 张；每个 LIVE Run 最多一次外部
Attempt；默认零调用；无自动重试、回退、选择或批准

## Constitution 检查

| 原则                  | 设计证据                                                                  | 结果 |
| --------------------- | ------------------------------------------------------------------------- | ---- |
| I. 先证明视频路径     | 保留 Phase 0/0.5 已有证据，不重写工作流和产物历史                         | 通过 |
| II. 创意与生成分离    | Phase 2 只提供资产事实和候选，不创建 Storyboard、Shot 或 GenerationSpec   | 通过 |
| III. Provider 中立    | 素材理解使用任务特定的版本化 `AiModelProvider` 合同；候选硬过滤不依赖模型 | 通过 |
| IV. 零调用与受控 LIVE | 导入、候选和分析预览均零调用；LIVE 精确授权在网络前消费且最多一次尝试     | 通过 |
| V. 来源与验证         | 文件探测、资产版本、理解修订和审核均追加式或不可变                        | 通过 |
| MVP 技术约束          | 复用 PostgreSQL、本地存储和单 Worker；不引入 Redis、向量库或新服务        | 通过 |
| 质量门                | 每个需求映射任务和测试；真实数据库读回、构建、Human QA、调用账本均列入    | 通过 |

## 架构分层

```text
本地 StorageProvider
  └─ StoredObject（字节身份）
       ├─ MediaProbeResult（追加式结构验证）
       └─ ProjectAsset（项目文件引用；现有 Asset 的领域名称）
              │
              └─ AssetVersionFile（用途/视角/景别/审核来源）
                    └─ ProductionAssetVersion
                           ├─ ProductionAsset（Character/Outfit/Prop/...）
                           ├─ CharacterVersion / CharacterStateVersion
                           └─ CharacterStateComponent（Outfit/Hair/Makeup/Accessory）

未来 Phase 3：ShotAssetRequirement
  → AssetCandidateService（Phase 2 合同与硬过滤）
  → ShotAssetBinding + AssetResolutionManifest（Phase 3 持久化）
```

文件身份、语义身份和镜头选择是三个不同层次。AI 理解只提出结构化建议；人工批准后才允许
建议影响 AssetVersionFile、资产版本或候选资格。

## 项目结构

```text
apps/
├── project-web/
│   ├── app/api/projects/[projectId]/assets/
│   ├── app/api/projects/[projectId]/production-assets/
│   ├── app/api/projects/[projectId]/asset-candidates/preview/
│   ├── app/api/projects/[projectId]/asset-analyses/
│   ├── app/api/production-asset-versions/[versionId]/
│   ├── app/api/character-state-versions/[stateVersionId]/
│   ├── app/api/asset-analyses/[runId]/
│   └── components/{asset-library,production-assets,character-states,asset-understanding}/
└── project-worker/
    └── src/index.ts

packages/
├── contracts/src/index.ts
├── ai-providers/src/
│   ├── provider.ts
│   ├── fake-asset-understanding-provider.ts
│   └── openai-asset-understanding-provider.ts
└── project-core/
    ├── prisma/schema.prisma
    └── src/
        ├── asset-import-service.ts
        ├── media-probe-service.ts
        ├── production-asset-contracts.ts
        ├── production-asset-service.ts
        ├── character-state-service.ts
        ├── asset-candidate-service.ts
        ├── analysis-contracts.ts
        ├── analysis-service.ts
        ├── analysis-worker.ts
        └── understanding-service.ts
```

**结构决定**：`project-core` 拥有不变量、事务、授权和候选规则；`ai-providers` 只做模型协议
转换；`project-web` 只暴露安全 DTO 和交互；`project-worker` 负责领取和执行持久任务。

## Phase 2A-0：文件层迁移与加固

### 名称与兼容性

- 领域、DTO 和新服务使用 `ProjectAsset`，清楚表达“项目中的文件引用”。
- 为降低破坏性迁移风险，首个数据库迁移可保留物理表名 `Asset`，通过 Prisma `@@map("Asset")`
  或兼容导出完成模型重命名；API 旧 `/assets` 路径继续兼容。
- 现有 `AssetRole` 暂时保留为 `legacyRole`，只用于回迁和显示。新的资产类型、ReferenceUsage、
  Viewpoint 分开建模；新业务不得继续写入混合角色枚举。

### 状态迁移

1. 扩展 ProjectAsset 状态为 PRESERVED、READY、INVALID、REMOVED。
2. 数据迁移把历史 READY 全部设为 PRESERVED，不推断其结构有效。
3. 重验证服务按 StoredObject 读取并重新计算哈希，再运行媒体结构探测。
4. 成功追加 MediaProbeResult(PASS) 并晋升所有匹配引用为 READY；失败追加 FAIL 并标记 INVALID。
5. 不删除、覆盖或重新编码任何原件；重跑验证会新增探测结果，结果可复现且可审计。

### 导入边界

- 先创建 AssetImportBatch 和逐项占位 Attempt，再独立处理每个项目，避免 `Promise.all` 的单项
  异常终止整个请求。
- `ROLE_REQUIRED`、数量超限、文件过大、签名/结构错误、碰撞和运行时错误都必须形成终态。
- 对已存在 storageKey 的文件重新读取并计算 SHA-256；字节不一致时进入安全错误，绝不覆盖。
- 通过 `(projectId, assetId)` 复合外键或等价数据库约束保证 Attempt/Activity 不跨项目。

## Phase 2A-1：语义资产与版本

- ProductionAsset 是项目内稳定身份；类型决定可用的扩展资料，但不决定文件视角或用途。
- ProductionAssetVersion 保存不可变内容快照；DRAFT 可编辑，发布产生 ACTIVE 快照；旧 ACTIVE
  转为 RETIRED，同时允许历史锁定读取。
- AssetVersionFile 是多对多关联。每个绑定记录 ReferenceUsage，选择性记录 Viewpoint、
  ShotScale、裁切/区域、质量事实、人工批准来源和生命周期。
- ProductionAssetRelation 表达语义关系，例如角色默认声音、LoRA 对应角色、场景包含固定陈设；
  关系本身有来源、版本和状态。
- 所有创建/发布/绑定动作使用项目范围幂等键、乐观版本或事务锁，避免并发双 ACTIVE。

## Phase 2A-2：角色状态

- CHARACTER ProductionAsset 拥有一对一 CharacterProfile；CharacterVersion 是角色身份设定快照。
- CharacterStateVersion 指向具体 CharacterVersion，表示可复用造型状态。
- CharacterStateComponent 只接受允许的组件槽位：OUTFIT、HAIR、MAKEUP、ACCESSORY；每个槽位
  可绑定相符类型的 ProductionAssetVersion，并通过顺序/标签支持多配饰。
- 普通手持 Prop、场景临时物件、镜头动作不进入角色状态；Phase 3 用 ShotAssetBinding 表达。
- 发布的角色版本和状态版本不可变。新改动创建新版本并显式继承来源。

## Phase 2A-3：面向 AI 分镜的候选合同

`AssetCandidateRequirement v1` 是 Phase 2 与 Phase 3 的冻结接口。服务执行顺序：

1. 验证项目、合同版本和请求组合合法性。
2. 解析明确锁定的 ProductionAssetVersion/CharacterStateVersion，或当前 ACTIVE 版本。
3. 按同项目、稳定身份、状态、组件、READY、人工批准、ReferenceUsage、Viewpoint、ShotScale、
   MIME/尺寸等 Provider 能力硬过滤。
4. 在合格集合内按结构化事实排序，例如人工首选、探测质量、用途精确度、分辨率和新鲜度。
5. 返回候选、每个规则的 matched/rejected 解释和缺口，不跨身份或静默降级。

该服务是确定性只读域服务。Phase 2 API 只提供预览；不写 Shot、不作正式选择、不保存正式
AssetResolutionManifest。Embedding/AI 相似度排序推迟，未来也只能作用于合格集合。

## Phase 2B：受控素材理解

1. 用户从 READY 图片中选择 1–9 个文件；服务读取哈希、大小和媒体能力，生成 `A1`–`A9`
   匿名槽位和规范化 Manifest。预览不实例化 Provider。
2. 确认请求绑定 Manifest 哈希、Provider、模型、合同、目标和 `maxCalls=1`。事务创建并消费
   一次性 Grant，再幂等入队 Run。
3. Worker 用 PostgreSQL 行锁和 Lease 领取任务，重新验证项目、文件哈希、能力和授权；在
   网络前创建唯一 Attempt。已有未完成 Attempt 的任务恢复为 AMBIGUOUS，不重试。
4. Adapter 使用固定任务合同、有限超时、`store:false` 和 SDK retry=0。结果必须精确覆盖全部
   槽位；非法或部分输出使整个 Run 失败。
5. 成功事务只保存安全 Attempt 事实和不可变 MACHINE Revision；不保存图片副本、Base64、
   凭证、完整 Payload 或未验证原始响应。
6. 用户 ACCEPT/REJECT/CORRECT 都追加 Review/OWNER Revision；Approved Projection 只暴露
   当前有效接受内容。应用到语义资产时记录来源和幂等键，并要求显式目标字段确认。

## API 与合同策略

- [production-assets.openapi.yaml](contracts/production-assets.openapi.yaml)：文件分页/重验证、
  ProductionAsset、版本、文件绑定、角色状态、候选预览和素材理解 HTTP 合同。
- [asset-selection-contract.md](contracts/asset-selection-contract.md)：Phase 3 可消费的候选请求、
  硬过滤顺序、解释码和未来 AssetResolutionManifest 边界。
- [provider-contract.md](contracts/provider-contract.md)：素材理解 Provider 合同、能力、外部调用
  边界和安全持久化字段。

HTTP 合同使用用户可理解的安全错误码；内部 storageKey、本地路径、原始 Provider 错误和凭证
不出现在响应中。所有写操作带项目上下文、幂等键和版本前置条件。

## 数据迁移、部署与回滚

### 迁移顺序

1. **Migration A（兼容）**：新增状态、MediaProbeResult、ImportBatch、复合项目约束和分页索引；
   历史 READY → PRESERVED；保留旧列和表名。
2. 部署只读兼容代码和重验证命令；验证抽样及全量结果，期间候选/分析只接受 READY。
3. **Migration B（新增语义层）**：新增 ProductionAsset、Version、File、Relation、Character 和
   State 表；不自动从混合 `AssetRole` 猜角色身份。
4. 提供显式 Legacy Role 辅助迁移：明显角色视角只转为 ReferenceUsage 建议，AUDIO/OTHER 等
   模糊项标为 NEEDS_REVIEW；用户确认后再建语义身份。
5. **Migration C（素材理解）**：新增 Manifest/Grant/Run/Attempt/Revision/Review；Worker 默认停用。
6. Fake Provider 和真实 PostgreSQL 验收通过后启 Worker；真实 Provider Gate 仍保持关闭。

### 回滚

- 每个迁移前生成数据库备份和行数/哈希基线；只做向前修复，不删除证据表。
- Web 回滚先停 Worker，再回兼容版本；新增表可保留，不做有数据后的破坏性 down migration。
- PRESERVED 迁移不改二进制；如新验证器有缺陷，暂停晋升并发布新探测器版本重新验证，不覆盖
  旧 MediaProbeResult。
- 语义层失败不会改变 ProjectAsset/StoredObject；素材理解失败不会改变已批准语义事实。

## 安全、隐私与可观测性

- 项目隔离在服务校验与数据库复合约束双层执行。
- 所有文件读取均从已验证 storageKey 解析，并再次核对 StoredObject 哈希；API 不接收任意路径。
- 凭证只从环境/系统密钥设施读取；不进入 PostgreSQL、日志或响应。
- 日志只记录安全 ID、操作码、数量、耗时、状态和规则码；不记录图片、文本内容、修正详情、
  Provider Payload、本地路径或原始错误。
- 关键指标：导入逐项终态率、PRESERVED 待验证数、INVALID 原因、ACTIVE 版本冲突、候选缺口
  码、分析授权/Attempt 比、AMBIGUOUS Run、Approved Projection 采用率。
- Provider 技术成功、人工事实批准和未来生成质量批准是三个独立 Gate。

## 实现增量与检查点

1. **增量 A：文件可信度**——碰撞复核、状态/探测迁移、逐项审计、分页搜索。完成后数据库
   读回验证 100% 旧记录已明确进入 PRESERVED/READY/INVALID。
2. **增量 B：语义资产**——ProductionAsset/Version/File/Relation 和管理 UI。完成后验证多文件
   归属一个版本、单 ACTIVE 和跨项目拒绝。
3. **增量 C：角色状态**——Character/Version/State/Component。完成后用 Lala 两个状态 Fixture
   验证服装/配饰复用，普通 Prop 不固化。
4. **增量 D：候选预览**——冻结合同和确定性服务。完成后验证错误角色/状态/用途 0 泄漏、
   缺口失败关闭。此时 Phase 3 合同/UI 可并行启动。
5. **增量 E：素材理解**——零调用预览、Fake Worker、审核和批准应用。真实 LIVE 保持关闭。
6. **收敛**——真实 PostgreSQL、性能、构建、浏览器 QA、迁移演练、密钥扫描和调用账本。

## 后续 Phase 与并行开发

| 轨道                 | 最早开始 Gate                                                          | 可并行范围                                                                    | 必须等待的正式集成                                                |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Phase 3 Storyboard   | Candidate v1、ProductionAssetVersion 和 CharacterStateVersion 合同冻结 | Storyboard/Shot Schema、编辑器壳、Fake Director、ShotAssetRequirement Fixture | 正式选材必须等 Phase 2 候选服务和批准资产可用                     |
| Phase 4 Shot Planner | StoryboardVersion/Shot Schema 冻结                                     | 连续性纯函数、GenerationSpec Schema、Fixture 测试                             | 正式计划必须等 Approved Storyboard 与正式 AssetResolutionManifest |
| Phase 5 生成基础设施 | GenerationSpec v1 冻结                                                 | 状态机、DRY_RUN、Provider Registry、Fake Adapter、Artifact 合同               | 外部提交必须等批准输入与新的执行时授权                            |
| Phase 6 QA           | Artifact/Job 合同冻结                                                  | FFprobe、哈希、帧抽取、Human QA UI、Fake AI QA                                | 不得自动批准或自动重做生成结果                                    |
| Phase 7 装配         | Artifact 与 QA 决策合同冻结                                            | 本地确定性拼接、导出清单、来源追踪                                            | 只能装配已明确 QA PASS 的镜头                                     |

推荐的并行切点是 Phase 2 增量 D：一旦 ProductionAsset/CharacterState 和候选合同冻结，Phase 3
可以用 Fixture/Fake Director 开发 Schema 与 UI；Phase 2B 素材理解和审核可继续并行。实现可以
并行，正式业务提升不能越过批准 Gate，也不因此授权任何外部上传、付费调用或生成。

## 验证策略

- **单元**：哈希碰撞、媒体状态机、版本不可变、组件类型、候选硬过滤、清单哈希、批准投影。
- **数据库/集成**：复合项目约束、单 ACTIVE、逐项导入、重验证、并发发布、队列/Lease、唯一
  Attempt、崩溃恢复、追加修订和重启读回。
- **合同**：分页/搜索 DTO、语义资产 API、候选解释码、Provider 精确槽位、错误脱敏。
- **迁移**：Phase 1 数据快照演练，核对行数、状态、哈希和活动历史；不改二进制。
- **性能**：按 SC-011 Fixture 测量数据库/API 首个有用结果。
- **Human QA**：文件状态、语义资产版本、角色状态组合、候选缺口、分析预览和审核对照。
- **调用账本**：正常 Phase 2 实现验收外部调用总数为 0；若以后获批真实运行，单独记录授权、
  Attempt、Provider/模型和结果，不混入本阶段完成声明。

## 设计后 Constitution 复核

所有 Gate 继续通过。Phase 2 的新语义层让后续 AI Director 和 Shot Planner 依赖稳定合同，而
不是文件标签或 Provider 输出；确定性候选先于任何 AI 排序；外部分析仍保持零调用默认和单次
不可逆授权边界；历史原件、版本、机器建议和人工决定均可追溯。
