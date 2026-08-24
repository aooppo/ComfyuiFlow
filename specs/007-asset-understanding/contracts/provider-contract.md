# Provider 合同：素材理解

## 能力注册

只有精确 Provider/模型同时支持文本+图片输入、严格结构输出、1–9 张图片，以及注册的 Prompt/
Schema 版本时，才注册 `ASSET_UNDERSTANDING`。能力读取是本地注册表查询，外部调用数为零。

业务层不假设“OpenAI 兼容”等于图片、结构输出、错误、用量或隐私语义兼容。OpenAI 首个
Adapter 固定注册；Qwen 或其他 Provider 必须另行验证并显式加入，不能作为失败回退。

## 请求 v1

```text
taskType: ASSET_UNDERSTANDING
contractVersion: asset-understanding-v1
modelRef: { providerId, modelId }
promptVersion: asset-understanding-v1
schemaVersion: asset-understanding-v1
images: 1..9 ordered {
  slot: A1..A9,
  mediaType: verified image MIME,
  verifiedContent: in-memory only
}
context: bounded project brief and requested observation categories
```

Provider 输入不包含 ProjectAsset/ProductionAsset 数据库 ID、storageKey、本地路径、凭证、授权
记录或内部端点。Adapter 只从已验证 StorageProvider 读取内容，在内存编码，禁止日志和持久化。

## 结果 v1

```text
providerId, requestedModelId, resolvedModelId, optional responseId
optional numeric usage
results: exactly one per requested slot {
  slot
  summary
  directObservations[]
  uncertainInterpretations[]
  visibleText[]
  subjectTypeSuggestions[]
  referenceUsageSuggestions[]
  viewpointSuggestion
  shotScaleSuggestion
  scene, composition, lighting, colorPalette[]
  identityAnchors[], continuityRisks[], generationConstraints[]
  qualityFacts
  confidence: LOW | MEDIUM | HIGH
}
```

所有字符串、数组和数值均有 Schema 上限。未知、缺失、重复槽位，未知枚举，越界内容或非有限
数值使整个结果失败；不能写入部分 Revision。返回文本是未信任的描述数据，不能隐式成为
Prompt、HTML、路径、查询或配置。

Provider 只建议类型和参考用途，不返回或选择 ProductionAsset/Character 数据库身份。用户在
审核应用步骤中显式选择目标语义资产，避免模型凭相似外观绑定错误角色。

## 调用和失败语义

- 预览、能力查询、导入、候选筛选和 Fake 测试均不得调用外部 Provider。
- LIVE 需要精确 Manifest 的一次性 Grant；Grant 在创建唯一 Attempt 和网络访问前消费。
- Adapter 使用有限超时、`store:false` 和 SDK retry=0。
- Attempt 一旦 STARTED，任何错误都不能创建替代 Attempt或回退 Provider。
- 超时、连接中断或丢失完成信号记为 AMBIGUOUS，而不是“可安全重试”的 FAILED。
- 只有完整 Schema 与精确槽位验证通过后，才在事务中保存机器 Revision。

## 可持久化字段

允许：Provider/请求模型/解析模型、可选响应 ID、数值用量、请求规范化哈希、安全状态码、
安全错误码、验证后的结构事实和时间。

禁止：源图片副本、Base64/Data URL、凭证、完整请求/响应 Payload、Provider 回显的原始错误、
本地路径、storageKey、用户修正内容日志和未通过 Schema 的输出。

## 与候选服务的边界

素材理解输出只有在用户 ACCEPT 或 CORRECT 后，才能通过有来源的 Application 更新
AssetVersionFile 或语义版本。AssetCandidateService 不调用 Provider，也不直接读取未批准
Revision；未来 AI 排序如被批准，必须是独立任务类型和授权，且只能在硬过滤合格集合内执行。
