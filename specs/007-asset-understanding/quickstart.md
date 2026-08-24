# Phase 2 验证指南：语义资产基础与素材理解

本指南是实施后的验收合同，不代表当前已经实现。默认全过程使用 Fake Provider，外部调用数
必须为 0；任何真实图片外发必须在执行当时另行确认。

## 1. 前置条件

- Node.js 22、项目包管理器依赖、PostgreSQL 16。
- 复制 `.env.example` 的本地配置；不要把真实 Provider 凭证写入项目文件。
- `ASSET_UNDERSTANDING_LIVE_ENABLED=false`，Worker Provider 设为 Fake。
- 准备隔离测试数据库和临时 StorageProvider 根目录，不复用生产/个人素材目录。

## 2. 基线与迁移演练

1. 从 Phase 1 Fixture 建立含 READY 图片、视频、音频、活动和导入记录的数据库快照。
2. 记录 Project、StoredObject、Asset、Attempt、Activity 行数及 StoredObject SHA-256 清单。
3. 依次执行文件加固、语义资产、素材理解迁移。
4. 验证所有历史 READY 已变为 PRESERVED，原文件字节、SHA-256、活动和导入记录不变。
5. 验证旧 API 仍能读取素材，且新 DTO 使用 ProjectAsset 语义。

## 3. 文件层加固验收

- 对 PRESERVED 素材运行本地重验证；确认有效媒体追加 PASS 并晋升 READY，截断/伪装媒体追加
  FAIL 并标 INVALID。
- 在内容寻址目标预放同尺寸不同字节文件；导入必须因哈希不一致失败且不覆盖目标。
- 一批导入正常、缺角色、超限、损坏和重复文件；确认每项各有一个终态 Attempt，成功项不因
  其他项失败而回滚。
- 验证跨项目 Attempt/Activity 指向 ProjectAsset 的 SQL 写入被数据库拒绝。
- 创建 500 个 ProjectAsset，验证搜索、状态筛选、稳定游标翻页、总数和 2 秒目标。

## 4. ProductionAsset 与版本验收

1. 建立 CHARACTER“Lala”、OUTFIT“晚宴礼服”、ACCESSORY“珍珠耳环”和 PROP“雨伞”。
2. 为每个资产建立草稿版本；将多张 READY 图片以不同 ReferenceUsage/Viewpoint/ShotScale 绑定。
3. 发布 v1，再发布 v2；确认 v1 变 RETIRED、v2 为唯一 ACTIVE，v1 内容不可更新。
4. 并发发布两个草稿；确认只有一个成功成为 ACTIVE。
5. 尝试绑定另一个项目的文件/版本；确认服务和数据库均拒绝且无部分写入。

## 5. Character 状态验收

1. 为 Lala 建立 CharacterVersion v1。
2. 建立 `daily` 和 `gala` 两个 CharacterStateVersion。
3. `gala` 绑定晚宴礼服和珍珠耳环；确认组件仍是独立 ProductionAssetVersion。
4. 尝试把 PROP“雨伞”绑定为状态组件；必须被拒绝，说明它应在 Phase 3 Shot 级绑定。
5. 发布状态后修改；系统必须创建新版本，旧状态及组件保持不变。

## 6. AI 分镜候选准备验收

- 请求 Lala `gala` + FULL_BODY + FRONT_THREE_QUARTER；只返回精确角色/状态和 READY、ACCEPTED
  绑定。
- 加入另一角色的高分辨率图片、旧版本、未审核建议和非 READY 文件；全部进入 rejected，原因
  稳定且不会因质量更高进入 eligible。
- 删除必要 FULL_BODY 绑定；结果返回 `NO_ELIGIBLE_CANDIDATE`/
  `REFERENCE_USAGE_MISSING`，不自动使用 FACE、不创建 Shot、不触发 Provider。
- 对相同 Fixture 重复请求；输入哈希、候选顺序、分数事实和拒绝码完全一致。

## 7. 素材理解零调用与 Fake 执行

1. 选择 1–9 张 READY 图片预览；确认显示 A1–A9、哈希、Provider/模型、外发说明、过期和
   `maxCalls=1`，数据库无 Grant/Run/Attempt，调用账本为 0。
2. 用 Fake Provider 确认 Manifest；确认 Grant 在 Attempt 前消费，一份 Run 最多一个 Attempt。
3. 验证 Fake 成功、非法槽位、超时、Worker 崩溃、重复 HTTP、重复投递和 Lease 恢复；任何
   场景都不产生第二个 Attempt、回退或部分 Revision。
4. 接受、拒绝和修正机器建议；确认机器 Revision 不变，修正追加 OWNER Revision，Approved
   Projection 只返回当前接受内容。
5. 显式把批准的 ReferenceUsage/Viewpoint 建议应用到目标 AssetVersionFile；确认记录
   UnderstandingApplication，重复幂等，不覆盖现有 OWNER 字段。

## 8. 自动化质量门

按仓库脚本运行：格式检查、lint、类型检查、单元/合同/集成测试、真实 PostgreSQL 测试、Prisma
验证/迁移检查、生产构建、密钥扫描和 `git diff --check`。把确切命令与结果写入
`verification.md`，不得只写“测试通过”。

## 9. 浏览器 Human QA

- 素材库清楚区分 PRESERVED、READY、INVALID、REMOVED，并能查看不泄露路径的探测历史。
- 语义资产页能理解“一个角色、多版本、多状态；服装/道具独立复用”。
- Character 状态编辑器不把普通 Prop 混入造型组件。
- 候选预览显示纳入、排除和缺口原因，不暗示已完成正式 AI 分镜选择。
- 素材理解页面明确区分机器建议、人工批准和应用结果，并在 LIVE 前再次提示图片将离开本机。

## 10. 交付证据

`verification.md` 至少记录：迁移前后行数/状态/哈希、逐项导入结果、跨项目拒绝、版本并发结果、
角色状态 Fixture、候选确定性哈希、Fake Provider Attempt 计数、Worker 崩溃语义、性能、浏览器
截图/观察、外部调用账本和仍需人工验证项。

正常 Phase 2 验收的调用账本应为：素材理解 Provider 0、AI 排序 0、ComfyUI/视频生成 0。
