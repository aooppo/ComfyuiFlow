# Phase 2 验证记录

日期：2026-08-25（本地开发环境）

## 已执行证据

| 检查            | 命令/动作                                                                                   | 结果                                                            |
| --------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Prisma schema   | `pnpm project:db:validate`                                                                  | 通过                                                            |
| PostgreSQL 迁移 | `DATABASE_URL=...:5448/comfyuiflow pnpm project:db:migrate`                                 | 6 个迁移发现，新增 5 个 Phase 2 迁移全部成功应用                |
| PostgreSQL 集成 | `RUN_PROJECT_DB_TESTS=1 ... pnpm test -- tests/integration/project-asset-workspace.test.ts` | 21 files / 66 tests 通过；含 500 文件读取在 2 秒内              |
| 默认单元/合同   | `pnpm test`                                                                                 | 20 files 通过、1 个环境依赖 suite 跳过；63 tests 通过、3 个跳过 |
| 类型/lint/格式  | `pnpm typecheck && pnpm lint && pnpm format:check`                                          | 全部通过                                                        |
| 生产构建        | `pnpm project:build`                                                                        | Next.js 构建通过                                                |
| 安全/差异       | `pnpm secret:scan && git diff --check`                                                      | 通过                                                            |

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

## 尚需人工/进一步集成验证

- 真实浏览器 Human QA：四态文件提示、版本/角色状态编辑、候选排除原因、审核历史和 LIVE
  警告文案。
- 真实 Provider 不在本次授权范围。`ASSET_UNDERSTANDING_LIVE_ENABLED=false` 保持默认，且
  OpenAI adapter 配置 `store:false`、30 秒 timeout、SDK retry=0；不得因此视作真实上传验证。
- 需要继续补充 PostgreSQL 并发/锁竞争、Worker 崩溃、完整审核应用和 Lala daily/gala fixture
  的端到端测试，详见 `tasks.md` 的未完成收敛项。
