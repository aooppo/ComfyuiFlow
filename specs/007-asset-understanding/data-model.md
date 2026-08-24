# 数据模型：语义资产基础与素材理解

## 1. 分层总览

```text
字节层          StoredObject 1──* MediaProbeResult
                    │
项目文件层          └──* ProjectAsset *──1 Project
                            │
语义资产层                  └──* AssetVersionFile *──1 ProductionAssetVersion
                                                        │
                                   ProductionAsset 1──*─┘
                                           │
角色层                         CharacterProfile / CharacterVersion
                                           └──* CharacterStateVersion
                                                    └──* CharacterStateComponent

理解证据层      Manifest ─ Grant ─ Run ─ Attempt ─ Machine Revision ─ Review
候选合同层      AssetCandidateRequirement → AssetCandidateResult（Phase 2 不持久化 Shot 决定）
```

PostgreSQL 保存上述元数据、状态、关系、来源和审核；二进制仅存在 StorageProvider。所有业务表
使用 UUID、`createdAt`，可变草稿带 `updatedAt`/乐观版本。项目范围关系通过复合键约束。

## 2. 文件与导入层

### StoredObject

沿用现有表：`id`、唯一 `sha256`、`byteSize`、`detectedMimeType`、唯一 `storageKey`、创建时间。
`verificationStatus` 扩展为 `PRESERVED | VERIFIED | INVALID`，但 ProjectAsset 的 READY 才表示
业务可用。`storageKey` 只供服务端使用，不进入公共 DTO。

### MediaProbeResult

追加式探测：`id`、`storedObjectId`、单对象递增 `ordinal`、`probeVersion`、`status=PASS|FAIL`、
`mediaType`、`container`、`codecFactsJson`、`width`、`height`、`durationMs`、`streamCount`、
`safeResultCode`、`probedAt`。

约束：`(storedObjectId, ordinal)` 唯一；记录创建后不可更新/删除。最新 PASS 是结构事实投影，
最新结果决定能否晋升 ProjectAsset；失败错误只用枚举码，不存原始工具输出中的路径。

### ProjectAsset（映射现有物理表 `Asset`）

字段：`id`、`projectId`、`storedObjectId`、原文件名、显示名、`mediaType`、`legacyRole`、notes、
`status=PRESERVED|READY|INVALID|REMOVED`、`removedAt`、时间戳。

兼容迁移：现有 width/height/duration/inspectionWarning 暂时保留只读，待调用方全部切到
MediaProbeResult 投影后再另行清理。`(projectId, id)` 唯一供复合外键使用；
`(projectId, storedObjectId)` 继续唯一。

状态机：

```text
导入保存字节 → PRESERVED
PRESERVED ──probe PASS + hash PASS──> READY
PRESERVED ──probe/hash FAIL─────────> INVALID
READY ──new validation FAIL─────────> INVALID
PRESERVED|READY|INVALID ──remove───> REMOVED
REMOVED 不自动恢复；恢复创建显式活动并重新验证
```

### AssetImportBatch

字段：`id`、`projectId`、唯一 `(projectId,idempotencyKey)`、`requestedItemCount`、
`status=PROCESSING|COMPLETED|COMPLETED_WITH_ERRORS|FAILED`、时间戳。

### AssetImportAttempt

扩展现有表：增加 `batchId`、`itemIndex`、`status=PROCESSING|TERMINAL`；保留 submitted facts、
requested legacy role、`outcome`、安全结果码和可选 ProjectAsset。唯一 `(batchId,itemIndex)`。
使用 `(projectId, assetId) -> ProjectAsset(projectId,id)` 复合外键阻止跨项目错配。

### ProjectActivity

保留追加式活动；Asset 关系同样使用 `(projectId,assetId)` 复合外键。扩展活动类型覆盖重验证、
语义资产创建/发布、状态发布、文件绑定和审核应用，但 summary 只保存安全短文本。

## 3. 语义资产层

### ProductionAsset

字段：`id`、`projectId`、`type`、`name`、可选 `slug`、`status=ACTIVE|INACTIVE|ARCHIVED`、
可选 `currentVersionId`、时间戳、乐观 `rowVersion`。

`ProductionAssetType`：

`CHARACTER | OUTFIT | PROP | SCENE | VOICE | LORA | HAIR | MAKEUP | ACCESSORY | OTHER`

约束：`(projectId,id)` 唯一；同项目活动名称策略由 `(projectId,type,normalizedName)` 唯一；
`currentVersionId` 必须属于同一 ProductionAsset 和项目。

### ProductionAssetVersion

字段：`id`、`projectId`、`productionAssetId`、递增 `versionNumber`、可选 `basedOnVersionId`、
`status=DRAFT|ACTIVE|RETIRED`、`displayName`、`description`、版本化 `factsJson`、`sourceType`、
可选 `sourceRevisionId`、`publishedAt`、时间戳。

约束：`(productionAssetId,versionNumber)` 唯一；项目复合外键；ACTIVE/RETIRED 记录不可变；同一
ProductionAsset 通过部分唯一索引保证最多一个 ACTIVE。发布事务同时退休旧版本并更新
`currentVersionId`。

### AssetVersionFile

字段：`id`、`projectId`、`productionAssetVersionId`、`projectAssetId`、`referenceUsage`、
可选 `viewpoint`、`shotScale`、`regionJson`、`qualityFactsJson`、`approvalStatus`、`isPreferred`、
`sourceType=OWNER|MIGRATION|UNDERSTANDING_REVISION`、可选 `sourceRevisionId`、`status`、时间戳。

`ReferenceUsage`：`IDENTITY | FACE | FULL_BODY | OUTFIT_DETAIL | PROP_DETAIL | SCENE_STYLE |
POSE | CONTROL | TRAINING_SOURCE`

`Viewpoint`：`FRONT | FRONT_THREE_QUARTER | SIDE | REAR_THREE_QUARTER | REAR | TOP | LOW |
DETAIL | UNSPECIFIED`

`ShotScale`：`EXTREME_CLOSE_UP | CLOSE_UP | MEDIUM_CLOSE_UP | MEDIUM | MEDIUM_FULL |
FULL | WIDE | EXTREME_WIDE | UNSPECIFIED`

约束：等价绑定组合唯一；双方必须同项目；只有 READY ProjectAsset 和 ACCEPTED 绑定可进入候选。
MACHINE 建议不能直接写 ACCEPTED。

### ProductionAssetRelation

字段：`id`、`projectId`、`fromAssetVersionId`、`toAssetVersionId`、`relationType`、`status`、
`sourceType`、可选 `sourceRevisionId`、`validFrom`、`validTo`、时间戳。

关系类型首版：`DEFAULT_VOICE | IDENTITY_LORA | REQUIRES | COMPATIBLE_WITH | PART_OF | DERIVED_FROM`。
不用于角色状态组件；组件使用更严格的专表。双方同项目，活动等价关系唯一。

## 4. 角色层

### CharacterProfile

字段：`id`、`projectId`、唯一 `productionAssetId`、稳定 `canonicalName`、可选用户维护的
`identityNotes`、时间戳。关联的 ProductionAsset.type 必须为 CHARACTER。

### CharacterVersion

字段：`id`、`projectId`、`characterProfileId`、`productionAssetVersionId`、递增
`versionNumber`、`status`、版本化 `identityFactsJson`、可选 `basedOnVersionId`、发布时间。

约束：ProductionAssetVersion 必须属于 CharacterProfile 对应 CHARACTER；项目一致；已发布
不可变；同一 CharacterProfile 最多一个 ACTIVE。

### CharacterStateVersion

字段：`id`、`projectId`、`characterVersionId`、稳定 `stateKey`、递增 `versionNumber`、`name`、
`status=DRAFT|ACTIVE|RETIRED`、`description`、可选 `basedOnStateVersionId`、发布时间。

`stateKey` 表示“晚宴装”等稳定状态系列，`versionNumber` 表示该状态的修订。唯一
`(characterVersionId,stateKey,versionNumber)`；同一 CharacterVersion 的每个 stateKey 系列最多
一个 ACTIVE，但 daily 与 gala 可以同时各有一个 ACTIVE；发布后不可变。

### CharacterStateComponent

字段：`id`、`projectId`、`characterStateVersionId`、`slotType=OUTFIT|HAIR|MAKEUP|ACCESSORY`、
`componentAssetVersionId`、可选 `slotKey`、`sortOrder`、`required`、时间戳。

约束：组件 ProductionAssetType 必须匹配 slotType；双方同项目；OUTFIT/HAIR/MAKEUP 默认每个
slotKey 唯一，ACCESSORY 可多项。PROP 被数据库/服务合同拒绝，留给 Phase 3 Shot 绑定。

## 5. 候选合同（Phase 2 只读）

### AssetCandidateRequirement v1

不持久化为业务表；经 Zod/JSON Schema 验证：`contractVersion`、`projectId`、`requirementId`、
`assetType`、可选 `productionAssetId`/锁定 version、可选 `characterProfileId`/
`characterVersionId`/`characterStateVersionId`、所需 ReferenceUsage、Viewpoint、ShotScale、
媒体/尺寸能力、`allowUnspecifiedViewpoint=false` 等显式策略。

### AssetCandidateResult v1

返回 `resolvedIdentity`、`eligible[]`、`rejected[]`、`gaps[]`、`policyVersion` 和输入规范化哈希。
每个候选包含 ProjectAsset、ProductionAssetVersion、AssetVersionFile 标识和结构化 score facts；
每个拒绝项包含稳定 reason code。结果本身不是正式选择。

## 6. 素材理解层

### AssetUnderstandingManifest / ManifestItem

不可变零调用范围。Manifest：项目、唯一 `manifestHash`、Provider/模型、task/prompt/schema 版本、
`maxCalls=1`、数量/字节、过期和创建时间。Item：按序 `A1`–`A9`、ProjectAsset、SHA-256、大小、
媒体类型。Manifest 内 slot、position、asset 各自唯一；只允许 READY 图片。

### AiCallGrant

字段：Manifest/hash、operation、Provider/模型、`maxCalls=1`、唯一幂等键、
`status=CREATED|CONSUMED|EXPIRED`、过期/消费时间。`CREATED -> CONSUMED` 只发生一次且不返还。

### AssetUnderstandingRun

字段：Project/Manifest/Grant、唯一项目幂等键、`status=QUEUED|RUNNING|COMPLETED|FAILED|AMBIGUOUS`、
安全结果码、claim/lease、生命周期时间。Grant 与 Run 一对一。终态不回 QUEUED；无 Attempt 的
过期 Lease 可重新领取，有 Attempt 的恢复为 AMBIGUOUS。

### AiProviderAttempt

每 Run 最多一行：`attemptNumber=1`、Provider、requested/resolved model、
`status=STARTED|SUCCEEDED|FAILED|AMBIGUOUS`、request hash、可选响应身份、数值 usage、安全错误码、
时间戳。创建 Attempt 是网络尝试边界。

### AssetUnderstandingRevision

字段：ProjectAsset、可选 Run/Attempt、可选源 Revision、单资产递增 ordinal、
`authorType=MACHINE|OWNER`、schema version、验证后 facts JSON、时间。机器 `(runId,assetId)` 唯一；
OWNER 修正必须指向同 ProjectAsset 的 Revision；所有行不可变。

事实字段有界：直接观察、身份/类型建议、ReferenceUsage/Viewpoint/ShotScale 建议、场景/构图/
光线/颜色、可见文字、质量事实、不确定项、连续性风险和生成约束。建议不包含正式数据库 ID。

### UnderstandingReview / UnderstandingApplication

Review：Revision、`ACCEPTED|REJECTED`、有界 notes、唯一幂等键、时间；最新事件形成有效决定。
Approved Projection 选择当前有效 ACCEPTED Revision。

Application 记录用户把批准字段应用到哪个 DRAFT ProductionAssetVersion/AssetVersionFile、映射
版本、幂等键和时间；只能显式应用，不自动覆盖已有 OWNER 来源字段。若目标版本已发布，必须
先创建基于它的新 DRAFT，不能修改 ACTIVE/RETIRED 快照。

## 7. 索引、不可变与保留

- 素材库：`(projectId,status,createdAt DESC,id)`、媒体类型、标准化显示名搜索索引。
- 语义库：`(projectId,type,status,name)`、版本 `(productionAssetId,versionNumber DESC)`。
- 候选：AssetVersionFile 的项目、版本、用途、状态组合索引；ProjectAsset READY 索引。
- 队列：`(status,createdAt)`、`(status,leaseExpiresAt)`；历史：`(projectId,createdAt DESC)`。
- Revision：`(projectAssetId,ordinal DESC)`；Review：`(revisionId,createdAt DESC)`。
- Phase 2 不硬删除任何源文件、探测、发布版本、Attempt、Revision 或 Review。
- 数据库触发器或服务+权限策略阻止发布版本、探测和修订更新；测试必须证明绕过服务也失败。
