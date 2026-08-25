# Phase 2 验证记录

日期：2026-08-25（本地开发环境）

## 已执行证据

| 检查            | 命令/动作                                                                                                                                                                                                            | 结果                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Prisma schema   | `pnpm project:db:validate`                                                                                                                                                                                           | 通过                                                            |
| PostgreSQL 迁移 | `DATABASE_URL=...:5448/comfyuiflow pnpm project:db:migrate`                                                                                                                                                          | 6 个迁移发现，新增 5 个 Phase 2 迁移全部成功应用                |
| PostgreSQL 集成 | `RUN_PROJECT_DB_TESTS=1 ... pnpm vitest run tests/integration/phase2-convergence-postgres.test.ts tests/integration/storyboards-postgres.test.ts tests/integration/generation-plans-postgres.test.ts --maxWorkers=1` | 3 files / 10 tests 通过；约束、并发、清单与批准读回通过         |
| 默认单元/合同   | `pnpm test`                                                                                                                                                                                                          | 32 files 通过、4 个数据库 suite 跳过；102 tests 通过、13 个跳过 |
| 类型/lint/格式  | `pnpm typecheck && pnpm lint && pnpm format:check`                                                                                                                                                                   | 全部通过                                                        |
| 生产构建        | `pnpm project:build`                                                                                                                                                                                                 | Next.js 构建通过                                                |
| 安全/差异       | `pnpm secret:scan && git diff --check`                                                                                                                                                                               | 通过                                                            |

## 已验证行为

- 本地 content-addressed 目标已有同尺寸但不同字节时，重新计算 SHA-256、返回
  `STORAGE_COLLISION` 且不覆盖既有字节。
- 截断 PNG 产生 `MEDIA_STRUCTURE_INVALID`/`FAIL`，不会晋升为 READY，也不泄露路径或
  ffprobe 原始输出。
- Phase 1 历史 READY/VERIFIED 数据在迁移中转为 PRESERVED；此操作被拆为独立迁移以适配
  PostgreSQL 新 enum 值的事务可见性。
- 本地 PostgreSQL workspace 回归验证了导入、重复、移除、重启读回及 500 项读取；清理逻辑已
  包含 Phase 2 新增的探测与语义关联表。
- 所有本次自动化验证均未调用素材理解 Provider、AI 排序、ComfyUI 或视频生成：`0 / 0 / 0`。

## 人工验收与进一步集成边界

- 真实浏览器 Human QA 已由 Owner 在任务 `01a03663-5cc7-7ad3-8ba2-e37e927639e1`
  逐项确认 PASS：文件四态、语义资产版本、角色状态组合与刷新读回、候选合格项/排除原因/缺口、
  素材理解完成态、修正/批准投影/显式应用及 LIVE 警告均通过。
- 真实 Provider 不在本次授权范围。`ASSET_UNDERSTANDING_LIVE_ENABLED=false` 保持默认，且
  OpenAI adapter 配置 `store:false`、30 秒 timeout、SDK retry=0；不得因此视作真实上传验证。
- Reviewer：Owner（任务 `01a03663-5cc7-7ad3-8ba2-e37e927639e1`）
- Decision：PASS
- Notes：用户明确说明该任务最后列出的 1–9 项全部 PASS；未把技术观察自动提升为其他创意决定。

## 2026-08-25 收敛补充证据

- `phase2-convergence-postgres.test.ts` 在隔离 `comfyuiflow_test` 中验证了 5 个跨项目复合外键、
  3 个已发布版本不可变触发器、跨项目引用全有或全无拒绝，以及两个草稿并发发布后仅一个
  ACTIVE。与 Storyboard、Generation Plan 数据库测试串行执行时，共 3 files / 10 tests 通过。
- Worker 领取改为 PostgreSQL `FOR UPDATE SKIP LOCKED` 原子事务；READY 内容读取、SHA-256
  复核和内存编码已独立到 `analysis-content.ts`。数据库约束继续保证唯一 Attempt 和追加历史。
- Lala daily/gala 确定性 fixture、角色状态组件编辑/发布与刷新读回、READY 文件用途绑定、关系
  编辑、理解修正/批准投影/显式应用和原图对照 UI 已补齐。
- Phase 1 快照迁移演练从首个迁移开始插入一个项目、StoredObject 和 Asset，再部署全部迁移；
  迁移后名称、64 位 SHA-256 与关联一致，历史资产状态为 PRESERVED。临时
  `comfyuiflow_migration_test` 数据库已删除。
- 真实浏览器已技术验证项目入口、三镜头 Fake 草稿、追加版本、刷新读回、版本对比、候选预览
  和 Gate 关闭时 409 拒绝；浏览器控制台无错误。该观察不代替 Human QA 签字。
- 本轮账本仍为 `Provider 0 / AI ranking 0 / ComfyUI 0 / video generation 0`。

Phase 2 Gate 的默认配置继续保持关闭。Gate 关闭路径已由 Owner 验收；Gate 开启下的正式
Manifest/批准/撤销路径由隔离 PostgreSQL 与后续隔离浏览器技术验收覆盖。开启 Gate 仍必须是
明确、临时的服务端操作，不得由客户端或测试自动长期打开。
