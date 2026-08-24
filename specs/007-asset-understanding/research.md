# 研究与设计决策：语义资产基础与素材理解

## R-001：文件引用与制作资产必须分层

**决定**：现有 `Asset` 作为 `ProjectAsset`（项目文件引用）；新增 ProductionAsset 表达
Character、Outfit、Prop 等稳定业务身份。

**理由**：文件可重复、替换或服务多个用途；角色和道具的身份不应随某个文件消失。

**未采用**：继续给 `Asset` 增加角色/服装字段，会把文件、身份、状态和镜头用途耦合在一行。

## R-002：兼容映射优先于立即重命名物理表

**决定**：领域/DTO 使用 ProjectAsset；首个迁移保留物理 `Asset` 表并使用 ORM 映射或兼容别名。

**理由**：现有 API、外键和 Phase 1 数据已工作，物理重命名没有产品价值却扩大回滚风险。

**未采用**：一次迁移重命名全部表、外键和路由，风险与收益不匹配。

## R-003：历史 READY 先降为 PRESERVED

**决定**：引入 PRESERVED、READY、INVALID、REMOVED；历史 READY 迁移为 PRESERVED，经重新
计算 SHA-256 和结构探测后再晋升。

**理由**：当前实现的签名检测和碰撞检查不足以证明媒体完整。PRESERVED 表示字节证据存在，
READY 才表示可以安全进入分析/生成链。

**未采用**：直接保留 READY 会继承未知质量；直接标 INVALID 会错误否定可能有效的原件。

## R-004：媒体事实属于 StoredObject 的追加探测结果

**决定**：宽高、时长、流、探测器版本和错误写入追加式 MediaProbeResult，并由最新成功结果
形成只读投影。

**理由**：同一字节在多个项目引用时结构事实相同；探测工具升级后需要保留旧证据。

**未采用**：继续在每个 ProjectAsset 上覆盖 width/height/duration 会重复且丢失来源。

## R-005：批量导入必须逐项审计和隔离失败

**决定**：AssetImportBatch 记录请求，先为每项建立 Attempt，再逐项捕获并终结；批次状态由
项目终态派生。

**理由**：文件数量、角色缺失或运行时异常同样是用户操作事实，不能在创建 Attempt 前丢失。

**未采用**：裸 `Promise.all` 会让一个异常拒绝整个批次并留下不明确结果。

## R-006：资产类型、参考用途和视角分开

**决定**：ProductionAssetType、ReferenceUsage、Viewpoint、ShotScale 使用独立枚举；旧
AssetRole 只作为迁移建议来源。

**理由**：CHARACTER 是身份类型，FULL_BODY 是参考用途/景别，REAR_SIDE 是视角；三者不是
互斥维度。

**未采用**：继续扩充 AssetRole 会产生组合爆炸，也无法精确支持分镜筛选。

## R-007：发布版本不可变，单 ACTIVE 由数据库与事务共同保证

**决定**：ProductionAssetVersion、CharacterVersion、CharacterStateVersion 在发布后不可变；
使用部分唯一索引或当前版本指针加事务锁保证单 ACTIVE。

**理由**：分镜复现必须能锁定历史语义；并发发布不能制造两个默认版本。

**未采用**：原地修改加 `updatedAt` 无法重建旧镜头使用的身份状态。

## R-008：服装和道具是独立资产，角色状态只组合固有造型

**决定**：Outfit、Prop、Hair、Makeup、Accessory 都是 ProductionAsset；角色状态组合
Outfit/Hair/Makeup/Accessory，普通手持 Prop 在 Phase 3 按 Shot 绑定。

**理由**：同一服装可被复用，道具常随镜头变化。把普通 Prop 固化进角色状态会产生大量状态
组合并破坏镜头语义。

**未采用**：把所有物件都做 Character 子字段，无法复用也无法表达临时镜头关系。

## R-009：AI 分镜选材先硬过滤，再考虑排序

**决定**：AssetCandidateService 先按项目、稳定身份/锁定版本、角色状态、READY、人工批准、
ReferenceUsage 和媒体能力做确定性过滤；只在合格集合内做结构化排序。

**理由**：相似度不能补救“错误角色”或“错误状态”。硬条件可测试、可解释、可失败关闭。

**未采用**：全库向量搜索后取最相似结果可能跨角色/项目；Phase 2 不引入 pgvector。

## R-010：Phase 2 只预览候选，Phase 3 持久化镜头决定

**决定**：Phase 2 冻结 AssetCandidateRequirement/Result v1 并提供只读预览；StoryboardVersion、
Shot、ShotAssetBinding、AssetResolutionManifest 属于 Phase 3。

**理由**：资产是否合格与镜头最终选择是不同生命周期。提前写 Shot 表会让 Phase 2 越界。

**未采用**：在素材理解结果里直接保存“已选分镜文件”，会把模型建议误当正式创意决定。

## R-011：PostgreSQL 作为本地持久队列

**决定**：分析 Run 存现有 PostgreSQL，单 Worker 用行锁、Lease 和单并发领取。

**理由**：授权、幂等和队列可在同一事务边界；本地负载不需要新 Broker。

**未采用**：进程内/文件队列弱化恢复和唯一性；Redis 增加不必要基础设施。

## R-012：素材理解使用任务特定 Provider 合同

**决定**：在 `AiModelProvider` 中增加 `ASSET_UNDERSTANDING` 判别任务、能力、请求与结果版本，
不把 Payload 放宽为任意 JSON。

**理由**：Provider 可替换，但每种任务的模态和结构输出能力必须诚实注册并严格验证。

**未采用**：通用 `unknown` 合同会让 Provider 字段泄漏到业务层，也掩盖能力差异。

## R-013：一次有序批次最多一次外部尝试

**决定**：一份 Run 含 1–9 张图片和 A1–A9 匿名槽位，一个 Grant 最多一次 Attempt；Attempt
在网络前创建，崩溃后结果不明则 AMBIGUOUS。

**理由**：这是可理解的成本上限，也是避免重复外发的不可逆边界。

**未采用**：按图片自动重试或失败后换 Provider 都会扩大未经再次确认的调用范围。

## R-014：授权绑定规范化 Manifest

**决定**：哈希项目、按序文件身份/哈希/大小、Provider/模型、合同/Prompt 版本、过期和
`maxCalls=1`；确认、消费和入队在一个事务完成。

**理由**：任何范围变化都会让确认失效；会话内布尔开关不具备持久审计能力。

**未采用**：只按 Provider 授权过宽；Worker 执行时才消费会留下重复队列窗口。

## R-015：机器结果与人工事实分离

**决定**：Provider 结果写不可变 MACHINE Revision；接受/拒绝写追加 Review；修正写 OWNER
Revision。只有 Approved Projection 能应用到语义资产。

**理由**：技术成功不是事实批准；覆盖机器结果会破坏来源链。

**未采用**：可变 `approved` 标志和原地编辑无法回答谁在何时基于什么做了决定。

## R-016：只保存验证后的最小 Provider 事实

**决定**：保存响应身份、解析模型、数值用量、安全状态/错误码和结构化事实；不保存图片副本、
Base64、凭证、完整请求响应或无界错误。

**理由**：满足可追溯性同时降低隐私、密钥和路径泄漏风险。

**未采用**：保存完整原始响应会把外发内容和 Provider 回显永久复制到数据库。

## R-017：实现 OpenAI 路径但默认不执行

**决定**：复用固定 OpenAI 注册身份，要求图片与结构输出能力，使用 `store:false`、有限超时、
SDK retry=0；实现验收以 Fake Provider 为准，LIVE Gate 关闭。

**理由**：符合 OpenAI-first 和零调用治理；Qwen 可在后续以受控注册方式加入，不能静默回退。

**未采用**：规划时真实测试、自动多模型比较或兼容端点猜测都超出用户授权。
