# Feature 018 扩展重规划：Capability Pack 与动态 Graph

## 已完成基础（保留不变）

Feature 018 现有实现负责校验一张已持久化的 frozen graph：读取目标 ComfyUI 的
`/system_stats` 和 `/object_info`，检查节点、连线、输入、输出与 RuntimeContract，并追加
PASS/FAIL evidence。它不提交 `/prompt`，不创建授权、attempt 或消费记录。

## 新目标

把空的 Capability Registry 变成无需重新发布应用代码即可扩展“已兼容模型”的能力包入口。
运维上传 JSON（可选 ZIP 包含审核证据）；服务端从受控的 Capability Pack 生成 `TRIAL`
Capability。用户每次创建 Shot 时，AI 只产生受限的 Graph Intent；通用 Compiler 将其编译为
本次新的 frozen graph，Feature 018 自动零调用预检。运维不逐张审核 graph。

## 三层职责

```text
开发发布一次：ComfyUI MCP adapter + 通用 Compiler/Validator + Graph DSL 语法
运维导入多次：Capability Pack（模型、runtime、允许 DSL 模式、参数范围、节点白名单）
每个 Shot 自动：AI Graph Intent -> Compiler -> 新 graph -> Feature 018 预检
```

Capability Pack 只可引用已发布的 adapter/compiler/validator；不能携带执行代码、模型权重、
凭据、endpoint、原始 ComfyUI graph 或任意脚本。若新模型适配既有 Graph DSL，则仅导入新包；
若需要新节点拓扑或新通信方式，开发才发布新 compiler recipe/adapter。

## 运行流

```text
Capability Pack 导入（本地运维 UI）
  -> 服务端 schema/digest/引用/节点白名单校验
  -> 追加 TRIAL Capability 与导入 receipt

用户创建 Shot
  -> AI 输出 Graph Intent（不能输出 raw graph）
  -> 通用 Compiler 用受限 DSL 编译本次 graph
  -> Feature 018 自动零调用预检
  -> PASS 后进入“可按次确认生成”状态

Owner 按次确认费用/范围
  -> 现有授权与执行路径
```

`READY` 表示某个 Capability 组合已获得真实受控成功证据，不表示每张 graph 需要运维批准。
新的 `TRIAL` Capability 可进行导入、动态 graph 编译与零调用预检；第一次真实生成仍需要
单独、明确的 Owner Trial-scope authorization。后续 `READY` Capability 的 graph 只需自动预检
和该次 Owner 授权。

## Capability Pack v1（JSON）

```json
{
  "schemaVersion": 1,
  "packId": "seedance-reference-video",
  "packVersion": "1.0.0",
  "runtimeTargetRef": { "id": "runtime.comfy-partner", "version": "1.0.0" },
  "model": { "id": "seedance-video", "version": "2.0.0", "availabilityKey": "seedance-v2" },
  "compilerProfile": "reference-video-v1",
  "compilerBinding": {
    "modelNode": {
      "classType": "ActualNodeFromObjectInfo",
      "promptInput": "prompt",
      "durationSecondsInput": "duration",
      "ratioInput": "ratio"
    },
    "outputNode": { "classType": "SaveVideo", "videoInput": "video", "outputMediaKey": "videos" }
  },
  "allowedIntentModes": ["text-to-video", "reference-video"],
  "parameterEnvelope": {
    "images": { "min": 0, "max": 9 },
    "durationSeconds": [4, 15],
    "ratios": ["16:9", "9:16"]
  },
  "requiredNodes": ["ActualNodeFromObjectInfo", "SaveVideo"],
  "expectedManifestSha256": "server-verified digest assertion"
}
```

字段值的来源：`runtimeTargetRef` 是已部署的目标；`requiredNodes` 必须来自该目标的
`/object_info`；`compilerProfile` 是开发已经发布的通用 DSL profile；model identity 与
availability key 来自模型接入说明并由 runtime 节点目录验证。UI 通过选择/导入生成这些值，
不让运维自由填写底层引用。

## 实施顺序

1. 新增 Capability Pack schema、严格解析和 fixture；只支持 JSON，ZIP 先作为可选审核附件。
2. 新增 server-owned pack import service、不可变 receipt、`TRIAL` registry transaction 与
   local-operator UI；普通 runtime 数据库身份仍不能直接写 registry。
3. 新增受限 Graph Intent schema 与 Generic Compiler Profile；AI/Workflow Agent 只能写 intent，
   不能写 raw graph。
4. 复用 Feature 018 preflight 自动校验每个新 graph；增加无人工 graph approval 的零调用测试。
5. 接入既有按次 Trial-scope/Owner authorization；不在 import、intent、preflight 中触发生成。

## 验收边界

- 导入 H3、Seedance 或本地 MiniMax H3 的兼容包不调用 provider、不安装权重、不提交 graph。
- 每个 Shot 的 graph 可不同；其节点和参数必须落在该 Pack 的 DSL/白名单/envelope 内。
- 未知 node、未知 compiler profile、未部署 runtime、越界参数、raw graph 或 secret 字段必须失败关闭。
- 能力包发布一次；图预检自动进行；真正生成仍是独立、按次 Owner 授权。
