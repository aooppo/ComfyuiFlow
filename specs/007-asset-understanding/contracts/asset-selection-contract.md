# 资产候选合同：Phase 2 到 Phase 3

## 目的

`AssetCandidateRequirement v1` 让未来 AI Storyboard 用结构化需求查找素材，而不是输出文件路径
或让模型在全库自由猜测。Phase 2 实现只读候选预览；Phase 3 才把同一合同嵌入
ShotAssetRequirement，并持久化正式选择与 AssetResolutionManifest。

## 输入 v1

```json
{
  "contractVersion": "asset-candidate-v1",
  "requirementId": "shot-03-character-primary",
  "projectId": "uuid",
  "assetType": "CHARACTER",
  "characterProfileId": "uuid",
  "characterStateVersionId": "uuid",
  "referenceUsages": ["FULL_BODY", "IDENTITY"],
  "viewpoints": ["FRONT_THREE_QUARTER"],
  "shotScales": ["FULL"],
  "mediaCapability": {
    "mediaType": "IMAGE",
    "acceptedMimeTypes": ["image/png", "image/jpeg"],
    "minimumWidth": 1024,
    "minimumHeight": 1024
  },
  "policy": {
    "allowUnspecifiedViewpoint": false,
    "allowUnspecifiedShotScale": false
  }
}
```

身份字段组合必须可验证：指定 CharacterStateVersion 时，它必须属于同一 CharacterVersion 和
CharacterProfile；指定 ProductionAssetVersion 时必须属于指定 ProductionAsset。缺少稳定身份
不能被自由文本名称替代。

## 硬过滤顺序

1. `PROJECT_MATCH`：所有身份、版本、状态、组件、文件和绑定属于请求项目。
2. `IDENTITY_MATCH`：精确 ProductionAsset/Character；不得按外观跨身份替代。
3. `VERSION_MATCH`：使用显式锁定版本，否则只解析当前 ACTIVE 版本。
4. `STATE_MATCH`：角色状态和所需组件版本精确匹配。
5. `LIFECYCLE_ELIGIBLE`：ProductionAsset/Version/Binding 活动，ProjectAsset 为 READY。
6. `OWNER_APPROVED`：绑定与其来源事实已人工批准；未审核机器建议不合格。
7. `REFERENCE_USAGE_MATCH`：满足全部要求用途，不把 FACE 当 FULL_BODY。
8. `VIEWPOINT_AND_SCALE_MATCH`：按显式策略匹配；默认不接受 UNSPECIFIED。
9. `MEDIA_CAPABILITY_MATCH`：MIME、尺寸和结构探测满足调用方能力。

任何硬规则失败即进入 rejected，不进入排序。规则不能因候选为空自动放宽。

## 合格集合排序

Phase 2 `deterministic-assets-v1` 只使用可解释事实，顺序稳定：人工 preferred、用途精确度、
视角/景别精确度、探测完整性、有效分辨率、绑定创建序和 UUID tie-breaker。返回每个分量，不
返回无法解释的总分作为唯一理由。

Embedding 或模型排序不属于 v1。未来若增加，只能重排 eligible 集合，不能恢复 rejected 项，
并需要独立 Provider 合同、外部调用授权、Attempt 和结果来源。

## 输出 v1

```json
{
  "policyVersion": "deterministic-assets-v1",
  "inputHash": "sha256",
  "resolvedIdentity": {
    "productionAssetVersionId": "uuid",
    "characterStateVersionId": "uuid"
  },
  "eligible": [
    {
      "projectAssetId": "uuid",
      "productionAssetVersionId": "uuid",
      "bindingId": "uuid",
      "matchedRules": ["PROJECT_MATCH", "IDENTITY_MATCH", "REFERENCE_USAGE_MATCH"],
      "scoreFacts": { "preferred": 1, "usageExact": 1, "effectivePixels": 4194304 }
    }
  ],
  "rejected": [{ "bindingId": "uuid", "reasonCodes": ["WRONG_CHARACTER_STATE"] }],
  "gaps": [],
  "formalSelectionCreated": false
}
```

稳定拒绝/缺口码至少包括：`CROSS_PROJECT`、`WRONG_IDENTITY`、`WRONG_VERSION`、
`WRONG_CHARACTER_STATE`、`INACTIVE_ASSET`、`FILE_NOT_READY`、`UNAPPROVED_BINDING`、
`REFERENCE_USAGE_MISSING`、`VIEWPOINT_MISMATCH`、`SHOT_SCALE_MISMATCH`、
`MEDIA_CAPABILITY_MISMATCH`、`NO_ELIGIBLE_CANDIDATE`。

## Phase 3 持久化边界

Phase 3 的 ShotAssetRequirement 保存本输入及其规范化哈希。用户或受控 Planner 从 eligible 中
选择后，ShotAssetBinding 保存锁定的 ProductionAssetVersion、CharacterStateVersion、
AssetVersionFile 和 ProjectAsset。AssetResolutionManifest 再冻结 policyVersion、候选结果哈希、
最终绑定和来源时间。

Phase 2 API 始终返回 `formalSelectionCreated=false`，不得写上述三类记录。候选为空必须返回明确
缺口，不能跨项目、换角色、换状态、使用未批准素材或自动发起素材理解/生成来补齐。
