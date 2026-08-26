"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type UiLocale = "en" | "zh-CN";

type BilingualCopy = { en: string; "zh-CN": string };

const capabilityRequirementReasonCopy: Record<string, BilingualCopy> = {
  CHARACTER_APPEARANCE_CONTINUITY_REQUIRED: {
    en: "The character's appearance must remain continuous in this Shot.",
    "zh-CN": "这个镜头需要保持角色外观连续。",
  },
  EXPLICIT_CHARACTER_IDENTITY_REQUIRED: {
    en: "This Shot must preserve an explicitly named character identity.",
    "zh-CN": "这个镜头需要保持明确指定的角色身份。",
  },
  OWNER_SELECTED_OPTIONAL_EVIDENCE: {
    en: "You selected this as optional supporting evidence; planning can continue without it.",
    "zh-CN": "你已把它选作可选辅助素材；没有它也可以继续规划。",
  },
  PERSON_PRESENT_WITHOUT_IDENTITY_LOCK: {
    en: "A person is present, but this Shot does not require a locked character identity.",
    "zh-CN": "镜头中有人物，但不需要锁定特定角色身份。",
  },
  NO_EXPLICIT_CHARACTER_NEED: {
    en: "This Shot has no explicit character identity or appearance-continuity need.",
    "zh-CN": "这个镜头没有明确的角色身份或外观连续性需求。",
  },
  PRODUCT_IDENTITY_REQUIRED: {
    en: "The product's identity and structure must remain stable in this Shot.",
    "zh-CN": "这个镜头需要保持产品身份和结构稳定。",
  },
  ENVIRONMENT_IDENTITY_REQUIRED: {
    en: "The environment must match a specific scene identity in this Shot.",
    "zh-CN": "这个镜头需要匹配特定场景环境。",
  },
  STYLE_REFERENCE_DESIRED: {
    en: "A style reference would help, but it is not required.",
    "zh-CN": "风格参考会有帮助，但不是必需项。",
  },
  PREVIOUS_FINAL_FRAME_REQUIRED: {
    en: "This Shot must continue from the exact final frame of its upstream Shot.",
    "zh-CN": "这个镜头必须从上游镜头的确切尾帧继续。",
  },
  MOTION_REFERENCE_REQUIRED: {
    en: "This Shot needs a motion reference.",
    "zh-CN": "这个镜头需要动作参考。",
  },
  AUDIO_REFERENCE_REQUIRED: {
    en: "This Shot needs an audio reference.",
    "zh-CN": "这个镜头需要音频参考。",
  },
  PURPOSE_NOT_NEEDED_FOR_SHOT: {
    en: "This input type is not needed for the current Shot.",
    "zh-CN": "当前镜头不需要这类输入。",
  },
};

const capabilityPurposeCopy: Record<string, BilingualCopy> = {
  CHARACTER: { en: "Character", "zh-CN": "角色" },
  PRODUCT: { en: "Product", "zh-CN": "产品" },
  ENVIRONMENT: { en: "Environment", "zh-CN": "场景" },
  STYLE: { en: "Style", "zh-CN": "风格" },
  CONTINUITY: { en: "Continuity", "zh-CN": "连续性" },
  MOTION: { en: "Motion", "zh-CN": "动作" },
  AUDIO: { en: "Audio", "zh-CN": "音频" },
  OTHER: { en: "Other", "zh-CN": "其他" },
};

const unresolvedPurposeGuidance: Record<string, BilingualCopy> = {
  CHARACTER: {
    en: "Bind a verified character or character-state asset to this Shot, then prepare it again.",
    "zh-CN": "请为这个镜头绑定已验证的角色或角色状态素材，然后重新准备。",
  },
  PRODUCT: {
    en: "Bind a verified product asset to this Shot, then prepare it again.",
    "zh-CN": "请为这个镜头绑定已验证的产品素材，然后重新准备。",
  },
  ENVIRONMENT: {
    en: "Bind a verified scene asset to this Shot, then prepare it again.",
    "zh-CN": "请为这个镜头绑定已验证的场景素材，然后重新准备。",
  },
  CONTINUITY: {
    en: "Finish and preserve the upstream Shot's final frame, then prepare this Shot again.",
    "zh-CN": "请先完成并保存上游镜头的尾帧，再重新准备这个镜头。",
  },
  MOTION: {
    en: "Bind a verified motion-reference video to this Shot, then prepare it again.",
    "zh-CN": "请为这个镜头绑定已验证的动作参考视频，然后重新准备。",
  },
  AUDIO: {
    en: "Bind a verified audio reference to this Shot, then prepare it again.",
    "zh-CN": "请为这个镜头绑定已验证的音频参考，然后重新准备。",
  },
};

const capabilityBlockerGuidanceCopy: Record<string, BilingualCopy> = {
  INPUT_CONTRACT_UNSATISFIED: {
    en: "The selected implementation cannot compile the current inputs. Resolve the missing required asset and prepare this Shot again.",
    "zh-CN": "当前输入无法满足所选实现的编译要求。请先补齐必需素材，再重新准备这个镜头。",
  },
  INPUT_INVARIANT_FAILED: {
    en: "This implementation needs at least one valid image or video reference. Add the required visual reference and prepare this Shot again.",
    "zh-CN": "这个实现至少需要一项有效的图片或视频参考。请添加所需视觉素材后重新准备。",
  },
  INPUT_COUNT_MISMATCH: {
    en: "The number of reference files is outside this implementation's supported range. Adjust the references and prepare again.",
    "zh-CN": "参考素材数量超出这个实现的支持范围。请调整素材数量后重新准备。",
  },
  CAPABILITY_MISMATCH: {
    en: "The available implementation does not support this Shot's needs. Choose a compatible reviewed implementation.",
    "zh-CN": "当前可用实现不支持这个镜头的需求。请选择经过审核的兼容实现。",
  },
  UPSTREAM_FINAL_FRAME_NOT_MATERIALIZED: {
    en: "The required upstream final frame is not ready. Finish the upstream Shot first, then prepare this Shot again.",
    "zh-CN": "所需的上游尾帧尚未准备好。请先完成上游镜头，再重新准备这个镜头。",
  },
  UPSTREAM_FINAL_FRAME_LINEAGE_INVALID: {
    en: "The upstream final-frame record cannot be verified. Recreate the exact final-frame binding before continuing.",
    "zh-CN": "无法验证上游尾帧记录。请重新建立确切的尾帧绑定后再继续。",
  },
  MONETARY_PRICE_MISSING_OR_EXPIRED: {
    en: "The current price cannot be verified. Refresh the reviewed pricing before asking for generation authorization.",
    "zh-CN": "当前价格无法验证。请先更新经过审核的价格信息，再申请生成授权。",
  },
  TRIAL_SCOPE_REQUIRED: {
    en: "This implementation is limited to an explicitly reviewed trial. Select a Ready implementation or obtain a separate trial scope.",
    "zh-CN": "这个实现仅限明确审核过的试运行。请选择可用实现，或另行取得试运行范围。",
  },
  IMPLEMENTATION_LIFECYCLE_NOT_SELECTABLE: {
    en: "This implementation is not selectable for new work. Choose a Ready implementation.",
    "zh-CN": "这个实现不能用于新任务。请选择状态为可用的实现。",
  },
  TEST_ONLY_IMPLEMENTATION: {
    en: "A test-only implementation cannot be used for production planning. Choose a reviewed production implementation.",
    "zh-CN": "测试专用实现不能用于正式规划。请选择经过审核的正式实现。",
  },
};

export function capabilityPurposeText(purpose: string, locale: UiLocale) {
  return capabilityPurposeCopy[purpose]?.[locale] ?? (locale === "zh-CN" ? "其他" : "Other");
}

export function capabilityRequirementReasonText(reasonCode: string, locale: UiLocale) {
  return (
    capabilityRequirementReasonCopy[reasonCode]?.[locale] ??
    (locale === "zh-CN"
      ? "系统已记录这项输入决定；稳定代码可在技术记录中查看。"
      : "The input decision is recorded; its stable code is available in the technical record.")
  );
}

export function capabilityBlockerGuidanceText(blockerCode: string, locale: UiLocale) {
  if (blockerCode.startsWith("UNRESOLVED_")) {
    const purpose = blockerCode.slice("UNRESOLVED_".length);
    const guidance = unresolvedPurposeGuidance[purpose];
    if (guidance) return guidance[locale];
  }
  return (
    capabilityBlockerGuidanceCopy[blockerCode]?.[locale] ??
    (locale === "zh-CN"
      ? "这个镜头仍有一项准备条件未满足。请查看技术记录，并在补齐相关输入后重新准备。"
      : "One preparation condition is still unresolved. Check the technical record, resolve the related input, and prepare again.")
  );
}

const STORAGE_KEY = "comfyuiflow.ui.locale";

const zh: Record<string, string> = {
  "Local studio": "本地工作室",
  "Project library": "项目库",
  "Make every source easy to find.": "让每一份素材都清晰可寻。",
  "Create a project, preserve the original files, and organize the visual world before directing a single shot.":
    "创建项目、保存原始文件，并在设计镜头前整理好视觉素材。",
  "New project": "新建项目",
  "Project name": "项目名称",
  "Creative brief": "创意说明",
  "Target format": "目标画幅",
  "Portrait 9:16": "竖屏 9:16",
  "Landscape 16:9": "横屏 16:9",
  "Square 1:1": "方形 1:1",
  "Portrait 4:5": "竖屏 4:5",
  "Create project": "创建项目",
  Workspace: "工作区",
  "Active projects": "进行中的项目",
  Active: "进行中",
  Archived: "已归档",
  "Your first project starts here": "从第一个项目开始",
  "Use the project form above to create a home for your source material.":
    "使用上方表单，为原始素材创建一个工作空间。",
  "Loading your workspace…": "正在载入工作区…",
  "Opening your project…": "正在打开项目…",
  "← Project library": "← 返回项目库",
  "← Back to project assets": "← 返回项目素材",
  "← All storyboards": "← 返回全部分镜",
  "Edit details": "编辑详情",
  "Edit project details": "编辑项目详情",
  "Save changes": "保存更改",
  "Saving…": "正在保存…",
  "Project could not be updated": "无法更新项目",
  "Project action failed": "项目操作失败",
  "Confirm archive": "确认归档",
  "Archiving…": "正在归档…",
  Archive: "归档",
  Restore: "恢复",
  "Archive this project? All source files and project details will be kept.":
    "要归档这个项目吗？所有原始文件和项目详情都会保留。",
  "Add a creative brief to keep the work focused.": "添加创意说明，让制作目标保持清晰。",
  "Plan a three-shot storyboard": "规划三镜头分镜",
  "Plan a flexible storyboard": "规划灵活镜头数的分镜",
  "Fake Director, immutable versions, and explainable asset gaps · 0 external calls":
    "Fake Director、不可变版本与可解释素材缺口 · 0 次外部调用",
  "Open storyboards →": "打开分镜工作区 →",
  "Source intake": "原始素材导入",
  "Add original assets": "添加原始素材",
  "Files stay local. Each item is preserved first, then structurally checked before it becomes ready.":
    "文件保留在本地。每项素材先被保存，再通过结构检查后进入可用状态。",
  "Creative role": "创意角色",
  Scene: "场景",
  Product: "产品",
  "Character · full body": "角色 · 全身",
  "Character · face": "角色 · 面部",
  "Character · rear / side": "角色 · 背面/侧面",
  Prop: "道具",
  Audio: "音频",
  Other: "其他",
  "Choose or drop files": "选择或拖入文件",
  "Images, MP4/WebM, and common audio · up to 20 at once":
    "支持图片、MP4/WebM 和常见音频 · 每次最多 20 个",
  "Import selected files": "导入所选文件",
  "Preserving originals…": "正在保存原始文件…",
  "Source library": "原始素材库",
  "Project assets": "项目素材",
  Search: "搜索",
  "Name or original file": "名称或原始文件名",
  Media: "媒体类型",
  Role: "角色",
  State: "状态",
  "All media": "全部媒体",
  Images: "图片",
  Video: "视频",
  "All roles": "全部角色",
  "All states": "全部状态",
  Preserved: "已保存",
  Ready: "可用",
  "Needs attention": "需要处理",
  Removed: "已移除",
  "No matching assets": "没有匹配的素材",
  "Add original images, video, or audio above.": "请从上方添加原始图片、视频或音频。",
  "Already in this project": "该素材已存在于当前项目",
  "Preserved and queued for local verification": "已保存，等待本地验证",
  Preview: "预览",
  Revalidate: "重新验证",
  Edit: "编辑",
  Remove: "移除",
  image: "图片",
  video: "视频",
  audio: "音频",
  ready: "可用",
  preserved: "已保存",
  invalid: "无效",
  removed: "已移除",
  "Semantic catalog": "语义素材库",
  "Characters, outfits, props and more": "角色、服装、道具及更多素材",
  "File assets are evidence; semantic assets are reusable creative identities and version history.":
    "文件素材是原始证据；语义素材代表可复用的创意身份与版本历史。",
  "Semantic type": "语义类型",
  Name: "名称",
  Description: "说明",
  "Create draft semantic asset": "创建语义素材草稿",
  CHARACTER: "角色",
  OUTFIT: "服装",
  PROP: "道具",
  SCENE: "场景",
  VOICE: "声音",
  LORA: "LoRA",
  HAIR: "发型",
  MAKEUP: "妆容",
  ACCESSORY: "配饰",
  OTHER: "其他",
  DEFAULT_VOICE: "默认声音",
  IDENTITY_LORA: "身份 LoRA",
  REQUIRES: "必需依赖",
  COMPATIBLE_WITH: "兼容",
  PART_OF: "属于",
  DERIVED_FROM: "派生自",
  DRAFT: "草稿",
  ACTIVE: "活动",
  RETIRED: "历史版本",
  PRESERVED: "已保存",
  READY: "可用",
  INVALID: "无效",
  REMOVED: "已移除",
  ACCEPTED: "已接受",
  REJECTED: "已拒绝",
  QUEUED: "排队中",
  RUNNING: "执行中",
  PAUSED: "已暂停",
  AWAITING_HUMAN_QA: "等待人工质检",
  TECHNICAL_FAILED: "技术检查失败",
  QA_PASS: "质检通过",
  QA_FAIL: "质检未通过",
  CANCELLED: "已取消",
  COMPLETED: "已完成",
  FAILED: "失败",
  AMBIGUOUS: "结果不明确",
  TRIAL: "需试运行验证",
  BLOCKED: "已阻塞",
  WAITING_FOR_UPSTREAM_REPAIR: "等待上游修复",
  INVALIDATED: "已失效",
  SUPERSEDED: "已被新版本替代",
  CHANGE_IMPLEMENTATION: "更换执行实现",
  RELAX_REQUIREMENT: "放宽非必要要求",
  REPLACE_ASSET: "替换素材",
  REWRITE_SHOT: "重写 Shot",
  SPLIT_SHOT: "拆分 Shot",
  CONTINUE: "自动续跑",
  PAUSE_OWNER_POLICY: "按负责人策略暂停",
  PAUSE_QA_FAIL: "AI 质检失败后暂停",
  PAUSE_HARD_CRITERION_FAIL: "硬性标准失败后暂停",
  AWAITING_OWNER_QA_CONTINUING: "等待负责人审核，安全下游继续",
  AI_QA_HIGH_CONFIDENCE_HARD_FAIL: "AI 高置信硬性标准失败",
  CONTINUATION_POLICY_STALE: "续跑策略已变化",
  COST_UNAVAILABLE: "费用信息不可用",
  BATCH_COST_LIMIT_EXCEEDED: "批次费用上限不足",
  PRE_DISPATCH_BLOCKED: "提交前检查阻止执行",
  UPSTREAM_ARTIFACT_NOT_READY: "上游结果尚未准备好",
  MATERIALIZED_INPUT_SHA_MISMATCH: "上游输入已变化",
  ADAPTER_NOT_IMPLEMENTED: "执行适配器尚不可用",
  OWNER: "负责人",
  FAKE_DIRECTOR: "Fake Director",
  IDENTITY: "身份",
  FACE: "面部",
  FULL_BODY: "全身",
  OUTFIT_DETAIL: "服装细节",
  PROP_DETAIL: "道具细节",
  SCENE_STYLE: "场景风格",
  GENERATION_PROFILE_INCOMPATIBLE: "生成配置不兼容",
  REFERENCE_SLOT_MISSING: "缺少引用槽位",
  REFERENCE_SLOT_AMBIGUOUS: "引用槽位不明确",
  REFERENCE_CHARACTER_MISMATCH: "角色引用版本不一致",
  REFERENCE_NOT_READY: "引用素材尚未就绪",
  REFERENCE_HASH_MISMATCH: "引用素材哈希不一致",
  WORKFLOW_NOT_READY: "工作流尚未就绪",
  LIVE_DISABLED: "LIVE 执行未开启",
  QA_NOT_READY: "AI 质检尚未就绪",
  AUTHORIZATION_EXPIRED: "执行授权已过期",
  PRODUCT: "产品",
  CHARACTER_FULL_BODY: "角色全身",
  CHARACTER_FACE: "角色面部",
  CHARACTER_REAR: "角色背面",
  FIRST: "首帧",
  MIDDLE: "中间帧",
  FINAL: "尾帧",
  POSE: "姿势",
  CONTROL: "控制参考",
  TRAINING_SOURCE: "训练来源",
  FRONT: "正面",
  FRONT_THREE_QUARTER: "正面四分之三",
  SIDE: "侧面",
  REAR_THREE_QUARTER: "背面四分之三",
  REAR: "背面",
  TOP: "俯视",
  LOW: "仰视",
  DETAIL: "细节",
  UNSPECIFIED: "未指定",
  CLOSE_UP: "近景",
  MEDIUM_CLOSE_UP: "中近景",
  MEDIUM: "中景",
  MEDIUM_FULL: "中全景",
  FULL: "全景",
  WIDE: "远景",
  EXTREME_WIDE: "大远景",
  EXTREME_CLOSE_UP: "特写",
  "Bind a verified source file": "绑定已验证的原始文件",
  "READY file": "可用文件",
  "Choose a READY file": "选择一个可用文件",
  Purpose: "用途",
  Viewpoint: "视角",
  "Shot scale": "景别",
  "Bind file": "绑定文件",
  "Relate another semantic version": "关联其他语义版本",
  "Relate another semantic version (optional)": "关联其他语义版本（可选）",
  "Leave this blank unless the current version depends on, is compatible with, or derives from another exact version. Add one relation at a time; multiple relations are allowed.":
    "如果当前版本不依赖、不兼容或不是派生自另一个确切版本，请留空。每次添加一条关系，可以添加多条。",
  "Target version": "目标版本",
  "Target version (optional)": "目标版本（可选）",
  "Choose another version": "选择其他版本",
  Relation: "关系",
  "Add relation": "添加关系",
  "Active version available": "已有活动版本",
  "Draft only": "仅有草稿",
  Publish: "发布",
  "New draft version": "新建草稿版本",
  "Edit draft": "编辑草稿",
  "Collapse draft": "收起草稿",
  "View details": "查看详情",
  "Hide details": "收起详情",
  "Loading version details…": "正在加载版本详情…",
  "Version details could not be loaded": "无法加载版本详情",
  "Description:": "说明：",
  "No description": "无说明",
  "Source:": "来源：",
  "Published at:": "发布时间：",
  "File bindings": "文件绑定",
  "No file bindings": "没有文件绑定",
  Relations: "关系",
  "No relations": "没有关系",
  Preferred: "首选",
  OUTGOING: "指向",
  INCOMING: "引用自",
  "Published versions are immutable. Create a draft from this version to make changes.":
    "已发布版本是不可变历史。如需修改，请从该版本创建新草稿。",
  "Create draft from this version": "从此版本创建草稿",
  "A new editable draft was created from the selected historical version.":
    "已从选中的历史版本创建可编辑的新草稿。",
  "READY file purpose binding saved to this draft version.":
    "可用文件及其用途已绑定到当前草稿版本。",
  "Semantic version relation saved.": "语义版本关系已保存。",
  "Version published. Any previous ACTIVE version is now historical.":
    "版本已发布，之前的活动版本已转为历史版本。",
  "A new draft version was created from the current version.": "已从当前版本创建新的草稿版本。",
  "Character composition": "角色状态组合",
  "Character versions and named states": "角色版本与命名状态",
  "A Character is stable identity. States compose Outfit, Hair, Makeup and Accessory versions; ordinary props remain Shot-level.":
    "Character 是稳定身份。状态可组合服装、发型、妆容和配饰版本；普通道具仍属于镜头层。",
  "A named state is optional for general candidate preview. Publish it only when a Shot must lock this exact outfit, hair, makeup, or accessory combination; draft states cannot be used for formal Storyboard binding or approval.":
    "普通候选预览不强制要求命名状态。只有当镜头必须锁定这套服装、发型、妆容或配饰组合时才需要发布；草稿状态不能用于正式分镜绑定或批准。",
  Character: "角色",
  "Choose a Character": "选择角色",
  "State key": "状态标识",
  "State name": "状态名称",
  "Create state draft": "创建状态草稿",
  "Component slot": "组件类型",
  "Published component version": "已发布组件版本",
  "Choose a published version": "选择一个已发布版本",
  "Slot label": "组件标签",
  "Add component": "添加组件",
  "Publish state": "发布状态",
  "No published versions are available for this component type. Create and publish one in the Semantic catalog first.":
    "当前组件类型没有可用的已发布版本。请先在上方语义素材库中创建并发布一个版本。",
  "Go to the Semantic catalog": "前往语义素材库",
  "Select a published component version to enable Add component.":
    "请选择一个已发布组件版本，然后即可添加组件。",
  "Component added to the draft state. Props remain Shot-level and cannot be selected here.":
    "组件已加入状态草稿。普通道具仍属于镜头层，不能在此选择。",
  "Draft state created. Add independently published Outfit, Hair, Makeup, or Accessory versions, then publish it.":
    "状态草稿已创建。请添加独立发布的服装、发型、妆容或配饰版本，然后发布状态。",
  "Storyboard preparation": "分镜准备",
  "Deterministic asset candidates": "确定性素材候选",
  "Checks the required identity, version, approval, reference usage and file readiness. It never selects or creates a Shot.":
    "检查所需身份、版本、批准状态、引用用途和文件可用性；不会选择或创建镜头。",
  "Creative identity": "创意身份",
  "Choose a semantic asset": "选择语义素材",
  "Reference usage": "引用用途",
  Identity: "身份",
  "Full body": "全身",
  "Outfit detail": "服装细节",
  "Prop detail": "道具细节",
  "Scene style": "场景风格",
  "Preview candidates": "预览候选素材",
  "Input hash": "输入哈希",
  "Candidate preview returned an incomplete response": "候选预览返回的数据不完整，请刷新后重试",
  Eligible: "符合条件",
  eligible: "符合条件",
  excluded: "已排除",
  "Eligible:": "符合条件：",
  "Excluded:": "已排除：",
  "Gap:": "缺口：",
  Rejected: "已排除",
  Gaps: "缺口",
  CROSS_PROJECT: "跨项目引用",
  WRONG_IDENTITY: "身份不匹配",
  WRONG_VERSION: "版本不匹配",
  WRONG_CHARACTER_STATE: "角色状态不匹配",
  INACTIVE_ASSET: "素材未激活",
  FILE_NOT_READY: "文件尚不可用",
  UNAPPROVED_BINDING: "绑定尚未批准",
  REFERENCE_USAGE_MISSING: "缺少所需用途",
  VIEWPOINT_MISMATCH: "视角不匹配",
  SHOT_SCALE_MISMATCH: "景别不匹配",
  MEDIA_CAPABILITY_MISMATCH: "媒体能力不匹配",
  NO_ELIGIBLE_CANDIDATE: "没有符合条件的候选素材",
  "No formal selection was created.": "本次预览没有创建正式素材选择。",
  "No eligible candidates": "没有符合条件的候选素材",
  "Controlled understanding": "受控素材理解",
  "Reviewable image observations": "可审核的图片观察结果",
  "Preview makes zero external calls. Confirm consumes a single-use grant; Fake is selected by default and real image upload is disabled unless the server’s LIVE gate is explicitly enabled.":
    "预览不会产生外部调用。确认操作会消耗一次性授权；默认使用 Fake，除非服务器明确开启 LIVE Gate，否则不会上传真实图片。",
  "Preview images": "预览图片",
  "Queue one controlled attempt": "排队一次受控尝试",
  "Preview only:": "仅预览：",
  "I understand this confirmation authorizes one provider attempt for these selected images.":
    "我理解此次确认仅授权对所选图片执行一次 Provider 尝试。",
  "The Worker is single-concurrency and never retries automatically.":
    "Worker 采用单并发，且永不自动重试。",
  "Understanding review": "素材理解审核",
  "Verified original · compare every observation against this source before approval.":
    "已验证原图 · 批准前请逐项对照原始素材。",
  "No approved projection. Machine output cannot affect semantic assets until an owner accepts or corrects it.":
    "尚无已批准投影。机器结果只有在负责人接受或修正后才能影响语义素材。",
  Accept: "接受",
  Reject: "拒绝",
  "Correct as owner": "以负责人身份修正",
  "Apply approved facts": "应用已批准事实",
  "Save owner correction": "保存负责人修正",
  "Revision accepted as the approved projection.": "该修订已接受为批准投影。",
  "Revision rejected; machine evidence remains unchanged.": "该修订已拒绝；机器证据保持不变。",
  "Owner correction saved and accepted as a new revision.": "负责人修正已保存并作为新修订接受。",
  "Approved facts were explicitly applied to the selected draft target with provenance.":
    "已将批准事实显式应用到所选草稿目标，并保留来源记录。",
  Cancel: "取消",
  "Production asset draft": "语义素材草稿",
  "Draft file binding": "文件绑定草稿",
  "Choose a draft version": "选择草稿版本",
  "Creative planning · zero external calls": "创意规划 · 0 次外部调用",
  "AI storyboard creation · one disclosed call": "AI 分镜创建 · 一次明确授权调用",
  "Zero calls · no intermediate approval": "零调用 · 无中间审批",
  "Prepare only what each Shot needs": "只准备每个镜头真正需要的内容",
  "Select saved Shots to see required, optional, and omitted inputs independently. Planning automatically saves immutable generation specs but never authorizes or submits video.":
    "选择已保存的镜头后，系统会分别说明必需、可选和已省略的输入。规划会自动保存不可变生成规格，但不会授权或提交视频。",
  "Prepare selected Shots": "生成逐镜头准备说明",
  "This plan made no external calls and granted no generation authority. A missing input on one Shot does not block another Shot.":
    "这次规划没有外部调用，也没有生成授权。某个镜头缺少输入，不会阻止其他镜头继续准备。",
  Required: "必需",
  Optional: "可选",
  Omitted: "已省略",
  Storyboards: "分镜",
  "Create a three-shot draft, preserve every version, and resolve approved assets later.":
    "创建三镜头草稿、保留每个版本，并在后续解析已批准素材。",
  "Start with three shots, then add, remove, and reorder up to twenty while preserving every version.":
    "从三镜头开始，可增删并重新排序至最多二十个镜头，同时保留每个历史版本。",
  "Start a storyboard": "创建分镜",
  Title: "标题",
  "Create storyboard": "创建分镜",
  "Create and call AI": "创建并调用 AI",
  "Creating and queueing AI…": "正在创建并排队 AI…",
  "Checking exact AI scope and current price…": "正在检查精确 AI 范围和当前费用…",
  "Exact AI Director authorization": "精确 AI 导演授权",
  "One authorization only. Failure or ambiguity consumes the call; no retry or Provider fallback.":
    "仅授权一次。失败或结果不确定都会消耗调用；不重试，也不切换供应商。",
  "Add and approve at least one READY image reference before creating this AI Storyboard.":
    "创建 AI 分镜前，请先添加并接受至少一张 READY 图片参考。",
  "Opening storyboard…": "正在打开分镜…",
  "Three-shot draft · Fake Director · 0 external calls":
    "三镜头草稿 · Fake Director · 0 次外部调用",
  "Flexible shot draft · Fake Director starts with 3 · 0 external calls":
    "灵活镜头草稿 · Fake Director 默认生成 3 个 · 0 次外部调用",
  "Generate three shots": "生成三镜头",
  "Zero-call execution preview is ready. Review the exact scope before confirming.":
    "零调用执行预览已准备完成。请在确认前检查确切范围。",
  "Batch authorized and queued. Each permission is consumed before its one call.":
    "批次已授权并进入队列。每项权限会在对应的单次调用前消耗。",
  "New Fake proposal": "生成新的 Fake 提案",
  "Save new version": "保存新版本",
  "Add shot": "添加镜头",
  Actions: "操作",
  Delete: "永久删除",
  "No active storyboards.": "没有进行中的分镜。",
  "No archived storyboards.": "没有已归档的分镜。",
  "This storyboard is archived and remains read-only until restored.":
    "该分镜已归档，恢复之前保持只读。",
  "A deterministic three-shot proposal was added. External calls: 0.":
    "已添加确定性的三镜头提案。外部调用：0。",
  "A new immutable version was saved.": "新的不可变版本已保存。",
  "A new version was saved with the project’s structured asset requirements.":
    "已保存新版本，并补充项目的结构化素材需求。",
  "Candidate preview completed without creating a formal selection.":
    "候选预览已完成，没有创建正式选择。",
  "Candidate preview completed. The highest-ranked eligible candidate for each requirement was preselected as an editable recommendation; no formal selection was created.":
    "候选预览已完成。每项需求已预选排名最高的可用候选作为可编辑建议；没有创建正式选择。",
  "Recommended from the structured shot requirement · editable": "根据结构化镜头需求推荐 · 可修改",
  "This version has no structured asset requirements, so there are no candidates to preview. Save a new version with project asset requirements first.":
    "当前版本没有结构化素材需求，因此没有候选可预览。请先保存一个包含项目素材需求的新版本。",
  "This version has no structured asset requirements, so there are no candidates to preview.":
    "当前版本没有结构化素材需求，因此没有候选可预览。",
  "Formal asset binding and approval remain closed until Phase 2 verification passes":
    "Phase 2 验证通过前，正式素材绑定和批准保持关闭",
  "Version history and comparison": "版本历史与对比",
  "Select version": "选择版本",
  "Select a version.": "请选择一个版本。",
  "Asset resolution and owner decision": "素材解析与负责人决策",
  "Preview is always read-only. Formal binding and approval stay closed until Phase 2 verification passes.":
    "预览始终为只读。Phase 2 验证通过前，正式绑定和批准保持关闭。",
  "Preview asset candidates": "预览素材候选",
  "No candidate gaps": "没有候选缺口",
  "All structured asset requirements have eligible candidates":
    "所有结构化素材需求都有符合条件的候选。",
  "No structured asset requirements were found for this version.": "当前版本没有结构化素材需求。",
  "Structured asset requirements": "结构化素材需求",
  "No structured asset requirements on this version.": "当前版本没有结构化素材需求。",
  "This version has no structured asset requirements. Your shot text can stay unchanged; save a new version to add the project’s published semantic assets as requirements.":
    "当前版本没有结构化素材需求。镜头文字无需改动，保存新版本即可把项目中已发布的语义素材加入需求。",
  "Save with project asset requirements": "保存并补充项目素材需求",
  "Formal asset binding is closed because the recorded Phase 2 Gate is not complete.":
    "正式素材绑定仍关闭：Phase 2 Gate 的验证记录尚未完成。",
  "Select eligible asset": "选择符合条件的素材",
  "Freeze asset manifest": "冻结素材清单",
  "Approve storyboard": "批准分镜",
  "Revoke approval": "撤销批准",
  "Storyboard approval never authorizes external AI or video generation.":
    "批准分镜永远不会授权外部 AI 或视频生成。",
  "Duration seconds": "时长（秒）",
  title: "标题",
  "creative Description": "创意描述",
  "start State": "起始状态",
  action: "动作",
  "end State": "结束状态",
  camera: "摄影机",
  composition: "构图",
};

const patterns: Array<[RegExp, (...values: string[]) => string]> = [
  [/^(\d+) matching assets$/, (count) => `${count} 个匹配素材`],
  [/^Preview (\d*) images?$/, (count) => `预览${count ? ` ${count} 张` : ""}图片`],
  [/^Preview (.+)$/, (name) => `预览 ${name}`],
  [/^Shot (\d+)$/, (number) => `镜头 ${number}`],
  [/^Version (\d+)$/, (number) => `版本 ${number}`],
  [/^v(\d+) · DRAFT$/, (number) => `v${number} · 草稿`],
  [/^v(\d+) · ACTIVE$/, (number) => `v${number} · 活动`],
  [/^v(\d+) · RETIRED$/, (number) => `v${number} · 历史版本`],
  [/^v(\d+) · OWNER$/, (number) => `v${number} · 负责人`],
  [/^v(\d+) · FAKE_DIRECTOR$/, (number) => `v${number} · Fake Director`],
  [
    /^(.+) · v(\d+) · (DRAFT|ACTIVE|RETIRED)$/,
    (name, number, status) => `${name} · v${number} · ${translateUiText(status, "zh-CN")}`,
  ],
  [/^ACTIVE · (\d+) components$/, (count) => `活动 · ${count} 个组件`],
  [/^DRAFT · (\d+) components$/, (count) => `草稿 · ${count} 个组件`],
  [/^RETIRED · (\d+) components$/, (count) => `历史版本 · ${count} 个组件`],
  [/^(草稿|活动|历史版本) · (\d+) components$/, (status, count) => `${status} · ${count} 个组件`],
  [
    /^(OUTFIT|HAIR|MAKEUP|ACCESSORY): (.+)$/,
    (slot, value) => `${translateUiText(slot, "zh-CN")}：${value}`,
  ],
  [
    /^(.+) · revision (\d+)$/,
    (state, revision) => `${translateUiText(state, "zh-CN")} · 修订 ${revision}`,
  ],
  [/^(\d+) blocking gaps$/, (count) => `${count} 个阻塞缺口`],
  [
    /^@(.+) · (CHARACTER|OUTFIT|PROP|SCENE|HAIR|MAKEUP|ACCESSORY)$/,
    (name, type) => `@${name} · ${translateUiText(type, "zh-CN")}`,
  ],
  [
    /^Status: (.+); recorded attempts: (\d+)$/,
    (status, attempts) => `状态：${status}；已记录尝试：${attempts}`,
  ],
  [/^Safe result: (.+)$/, (result) => `安全结果：${result}`],
];

export function translateUiText(value: string, locale: UiLocale) {
  if (locale === "en") return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  const exact = zh[core];
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, render] of patterns) {
    const match = pattern.exec(core);
    if (match) return `${leading}${render(...match.slice(1))}${trailing}`;
  }
  return value;
}

interface LanguageContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>("en");
  const localeRef = useRef<UiLocale>("en");
  localeRef.current = locale;
  const textOrigins = useRef(new WeakMap<Text, string>());
  const textRendered = useRef(new WeakMap<Text, string>());
  const attributeOrigins = useRef(new WeakMap<Element, Map<string, string>>());
  const attributeRendered = useRef(new WeakMap<Element, Map<string, string>>());
  const applying = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initial: UiLocale =
      saved === "zh-CN" || saved === "en"
        ? saved
        : window.navigator.language.toLowerCase().startsWith("zh")
          ? "zh-CN"
          : "en";
    setLocaleState(initial);
  }, []);

  const setLocale = useCallback((next: UiLocale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `comfyuiflow-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocaleState(next);
  }, []);

  const applyLocale = useCallback(() => {
    if (applying.current) return;
    applying.current = true;
    const activeLocale = localeRef.current;
    document.documentElement.lang = activeLocale;
    const root = document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const parent = node.parentElement;
      if (
        parent &&
        !parent.closest("[data-i18n-ignore]") &&
        !["SCRIPT", "STYLE"].includes(parent.tagName)
      ) {
        const previous = textOrigins.current.get(node);
        const lastRendered = textRendered.current.get(node);
        if (previous === undefined || (lastRendered !== undefined && node.data !== lastRendered)) {
          textOrigins.current.set(node, node.data);
        }
        const original = textOrigins.current.get(node) ?? node.data;
        const translated = translateUiText(original, activeLocale);
        if (node.data !== translated) node.data = translated;
        textRendered.current.set(node, translated);
      }
      node = walker.nextNode() as Text | null;
    }
    for (const element of root.querySelectorAll("[placeholder], [aria-label], [title], [alt]")) {
      if (element.closest("[data-i18n-ignore]")) continue;
      const origins = attributeOrigins.current.get(element) ?? new Map<string, string>();
      const rendered = attributeRendered.current.get(element) ?? new Map<string, string>();
      for (const name of ["placeholder", "aria-label", "title", "alt"]) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        const previous = origins.get(name);
        const lastRendered = rendered.get(name);
        if (previous === undefined || (lastRendered !== undefined && current !== lastRendered)) {
          origins.set(name, current);
        }
        const original = origins.get(name) ?? current;
        const translated = translateUiText(original, activeLocale);
        if (current !== translated) element.setAttribute(name, translated);
        rendered.set(name, translated);
      }
      attributeOrigins.current.set(element, origins);
      attributeRendered.current.set(element, rendered);
    }
    applying.current = false;
  }, []);

  useEffect(() => {
    applyLocale();
    const observer = new MutationObserver(() => queueMicrotask(applyLocale));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    return () => observer.disconnect();
  }, [applyLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t: (text) => translateUiText(text, locale) }),
    [locale, setLocale],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
