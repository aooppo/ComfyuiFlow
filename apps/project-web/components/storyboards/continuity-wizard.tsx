"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Policy = "WHOLE_FILM_HOLD" | "SHOT_CHANGE" | "UNIMPORTANT";

interface SubjectView {
  subjectKey: string;
  kind: string;
  label: string;
  productionAssetVersionId: string | null;
  assetVersionFileId: string | null;
  sourceSha256: string | null;
  factsJson: Record<string, unknown>;
  rules: Array<{
    propertyKey: string;
    policy: Policy;
    importance: "HARD" | "SOFT";
    expectedValueJson: unknown;
    explanation: string | null;
  }>;
}

interface BoundaryView {
  id: string;
  boundaryIndex: number;
  label: string;
  stateJson: Record<string, unknown>;
  stateHash: string;
}

interface ShotStateView {
  storyboardShotId: string;
  ordinal: number;
  startBoundaryId: string;
  endBoundaryId: string;
  declaredChangesJson: Record<string, unknown>;
}

interface VersionView {
  id: string;
  versionNumber: number;
  outputHash: string;
  subjects: SubjectView[];
  boundaries: BoundaryView[];
  shotStates: ShotStateView[];
  keyframePlans: Array<{ id: string; status: string }>;
}

interface ContinuityView {
  projectId: string;
  storyboardId: string;
  storyboardRowVersion: number;
  title: string;
  eligible: boolean;
  continuityRulesCurrent: boolean;
  blockers: string[];
  profile: null | {
    id: string;
    rowVersion: number;
    approvedVersionId: string | null;
    headVersion: VersionView;
  };
  preflight: null | {
    ready: boolean;
    preflightHash: string;
    blockers: ContinuityIssue[];
    warnings: ContinuityIssue[];
  };
}

interface ContinuityIssue {
  code: string;
  subjectKey: string | null;
  shotOrdinal: number | null;
  boundaryIndex: number | null;
  message: string;
  actions: string[];
}

interface KeyframePreview {
  planHash: string;
  ready: boolean;
  blockers: string[];
  maximumCalls: number;
  estimatedMaximumCostUsd: number | null;
  targets: Array<{ boundaryIndex: number; label: string }>;
  capability: {
    profileId: string;
    modelId: string;
    modelSnapshot: string;
    providerRequestSize: string;
    width: number;
    height: number;
    estimatedCostUsdPerImage: number | null;
    priceAsOf: string | null;
    priceExpiresAt: string | null;
    liveReady: boolean;
  };
}

interface KeyframeState {
  id: string;
  status: string;
  planHash: string;
  maximumCalls: number;
  targets: Array<{
    boundaryIndex: number;
    label: string;
    attemptStatus: string | null;
    safeResultCode: string | null;
    artifact: null | {
      id: string;
      sha256: string;
      width: number;
      height: number;
      mimeType: string;
      decision: string | null;
    };
  }>;
}

const kindLabels: Record<string, string> = {
  ENVIRONMENT: "场景环境",
  CHARACTER: "人物",
  PRODUCT: "产品",
  PROP: "道具",
  CAMERA: "摄影",
  VISUAL_STYLE: "视觉风格",
};

const policyLabels: Record<Policy, string> = {
  WHOLE_FILM_HOLD: "全片保持",
  SHOT_CHANGE: "本镜允许变化",
  UNIMPORTANT: "不重要",
};

export function ContinuityWizard({
  projectId,
  storyboardId,
}: {
  projectId: string;
  storyboardId: string;
}) {
  const [view, setView] = useState<ContinuityView | null>(null);
  const [subjects, setSubjects] = useState<SubjectView[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryView[]>([]);
  const [shots, setShots] = useState<ShotStateView[]>([]);
  const [providerProfileId, setProviderProfileId] = useState("fake-keyframe-v1");
  const [preview, setPreview] = useState<KeyframePreview | null>(null);
  const [keyframes, setKeyframes] = useState<KeyframeState | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentApproved = Boolean(
    view?.continuityRulesCurrent &&
    view.profile?.approvedVersionId === view.profile?.headVersion.id,
  );

  const load = useCallback(async () => {
    const response = await fetch(`/api/storyboards/${storyboardId}/continuity`, {
      cache: "no-store",
    });
    const body = (await response.json()) as ContinuityView & { error?: { message: string } };
    if (!response.ok) throw new Error(body.error?.message ?? "无法读取全片一致性设置");
    setView(body);
    setSubjects(body.profile?.headVersion.subjects ?? []);
    setBoundaries(body.profile?.headVersion.boundaries ?? []);
    setShots(body.profile?.headVersion.shotStates ?? []);
    const latestPlanId = body.profile?.headVersion.keyframePlans[0]?.id;
    if (latestPlanId) {
      const planResponse = await fetch(`/api/keyframe-plans/${latestPlanId}`, {
        cache: "no-store",
      });
      if (planResponse.ok) setKeyframes((await planResponse.json()) as KeyframeState);
    } else setKeyframes(null);
  }, [storyboardId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "无法读取全片一致性设置"),
    );
  }, [load]);

  async function request(path: string, init: RequestInit, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, init);
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "操作未完成");
      setMessage(success);
      await load();
      return body;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作未完成");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createSuggestions() {
    if (!view) return;
    await request(
      `/api/storyboards/${storyboardId}/continuity`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedStoryboardRowVersion: view.storyboardRowVersion,
          idempotencyKey: crypto.randomUUID(),
        }),
      },
      "已从批准的分镜和素材生成一致性建议；外部调用 0 次。",
    );
  }

  function updatePolicy(subjectKey: string, policy: Policy) {
    setSubjects((current) =>
      current.map((subject) =>
        subject.subjectKey === subjectKey
          ? {
              ...subject,
              rules: subject.rules.map((rule) => ({
                ...rule,
                policy,
                importance: policy === "UNIMPORTANT" ? "SOFT" : rule.importance,
              })),
            }
          : subject,
      ),
    );
  }

  function inheritPrevious(issue: ContinuityIssue) {
    if (issue.boundaryIndex === null || !issue.subjectKey || issue.boundaryIndex < 1) return;
    setBoundaries((current) => {
      const previous = current.find((item) => item.boundaryIndex === issue.boundaryIndex! - 1);
      return current.map((boundary) =>
        boundary.boundaryIndex === issue.boundaryIndex
          ? {
              ...boundary,
              stateJson: {
                ...boundary.stateJson,
                [issue.subjectKey!]: previous?.stateJson[issue.subjectKey!] ?? null,
              },
            }
          : boundary,
      );
    });
    setMessage("已在本地选择沿用上一镜；请保存为新版本后重新检查。 ");
  }

  function allowChange(issue: ContinuityIssue) {
    if (!issue.subjectKey) return;
    updatePolicy(issue.subjectKey, "SHOT_CHANGE");
    if (issue.shotOrdinal)
      setShots((current) =>
        current.map((shot) =>
          shot.ordinal === issue.shotOrdinal
            ? {
                ...shot,
                declaredChangesJson: {
                  ...shot.declaredChangesJson,
                  [issue.subjectKey!]: "owner-declared-change",
                },
              }
            : shot,
        ),
      );
    setMessage("已声明本镜允许变化；请保存新版本。 ");
  }

  async function saveVersion() {
    if (!view?.profile) return;
    const boundaryIndex = new Map(
      boundaries.map((boundary) => [boundary.id, boundary.boundaryIndex]),
    );
    await request(
      `/api/continuity-profiles/${view.profile.id}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentVersionId: view.profile.headVersion.id,
          expectedRowVersion: view.profile.rowVersion,
          idempotencyKey: crypto.randomUUID(),
          subjects: subjects.map((subject) => ({
            subjectKey: subject.subjectKey,
            kind: subject.kind,
            label: subject.label,
            productionAssetVersionId: subject.productionAssetVersionId,
            assetVersionFileId: subject.assetVersionFileId,
            sourceSha256: subject.sourceSha256,
            facts: subject.factsJson,
            rules: subject.rules.map((rule) => ({
              propertyKey: rule.propertyKey,
              policy: rule.policy,
              importance: rule.importance,
              expectedValue: rule.expectedValueJson,
              explanation: rule.explanation ?? undefined,
            })),
          })),
          boundaries: boundaries.map((boundary) => ({
            boundaryIndex: boundary.boundaryIndex,
            label: boundary.label,
            state: boundary.stateJson,
          })),
          shots: shots.map((shot) => ({
            storyboardShotId: shot.storyboardShotId,
            ordinal: shot.ordinal,
            startBoundaryIndex: boundaryIndex.get(shot.startBoundaryId),
            endBoundaryIndex: boundaryIndex.get(shot.endBoundaryId),
            declaredChanges: shot.declaredChangesJson,
          })),
        }),
      },
      "已保存新的不可变一致性版本。",
    );
  }

  async function approveProfile() {
    if (!view?.profile?.headVersion || !view.preflight) return;
    await request(
      `/api/continuity-profile-versions/${view.profile.headVersion.id}/decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVED",
          preflightHash: view.preflight.preflightHash,
          idempotencyKey: crypto.randomUUID(),
        }),
      },
      "全片一致性版本已批准；尚未生成或授权图片、视频。",
    );
  }

  async function previewKeyframes() {
    if (!view?.profile || !currentApproved) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/continuity-profile-versions/${view.profile.headVersion.id}/keyframe-plans/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerProfileId }),
        },
      );
      const body = (await response.json()) as KeyframePreview & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "无法预览关键帧批次");
      setPreview(body);
      setMessage("关键帧费用与调用上限预览完成；外部调用 0 次。 ");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法预览关键帧批次");
    } finally {
      setBusy(false);
    }
  }

  async function createAuthorizeAndRun() {
    if (!view?.profile || !currentApproved || !preview?.ready) return;
    const isFake = providerProfileId === "fake-keyframe-v1";
    setBusy(true);
    setError("");
    try {
      const createResponse = await fetch(
        `/api/continuity-profile-versions/${view.profile.headVersion.id}/keyframe-plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerProfileId, planHash: preview.planHash }),
        },
      );
      const created = (await createResponse.json()) as { id?: string; error?: { message: string } };
      if (!createResponse.ok || !created.id)
        throw new Error(created.error?.message ?? "无法建立关键帧计划");
      const authorizeResponse = await fetch(`/api/keyframe-plans/${created.id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planHash: preview.planHash,
          confirmed: true,
          maximumCalls: preview.maximumCalls,
          expiresInSeconds: 300,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!authorizeResponse.ok) {
        const body = (await authorizeResponse.json()) as { error?: { message: string } };
        throw new Error(body.error?.message ?? "无法确认关键帧批次");
      }
      const executeResponse = await fetch(`/api/keyframe-plans/${created.id}/execute`, {
        method: "POST",
      });
      const state = (await executeResponse.json()) as KeyframeState & {
        error?: { message: string };
      };
      if (!executeResponse.ok) throw new Error(state.error?.message ?? "关键帧批次未完成");
      setKeyframes(state);
      setMessage(
        isFake
          ? `已生成 ${preview.maximumCalls} 张本地 Fake 关键帧；外部调用 0 次。`
          : `LIVE 批次已按上限提交；最多 ${preview.maximumCalls} 次图片调用，失败不自动重试。`,
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "关键帧批次未完成");
    } finally {
      setBusy(false);
    }
  }

  async function decideKeyframe(artifactId: string, decision: "APPROVED" | "REJECTED") {
    await request(
      `/api/keyframe-artifacts/${artifactId}/decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, idempotencyKey: crypto.randomUUID() }),
      },
      decision === "APPROVED" ? "该关键帧已批准。" : "该关键帧已拒绝；不会自动补图。",
    );
  }

  const step = useMemo(() => {
    if (currentApproved && keyframes?.status === "APPROVED") return 4;
    if (currentApproved && keyframes) return 3;
    if (currentApproved) return 2;
    if (view?.profile) return 1;
    return 0;
  }, [currentApproved, keyframes, view]);

  if (!view)
    return (
      <main className="pageFrame">
        <p>{error || "正在打开全片一致性…"}</p>
      </main>
    );

  return (
    <main className="pageFrame storyboardPage continuityPage">
      <a className="backLink" href={`/projects/${projectId}/storyboards/${storyboardId}`}>
        ← 返回分镜
      </a>
      <header className="storyboardHero continuityHero">
        <div>
          <p className="eyebrow">分镜 → 全片一致性 → 关键帧预演 → 付费生成 → 成片审核</p>
          <h1>全片一致性</h1>
          <p>先把全片不变的内容和镜头交界状态定下来，再花视频 credit。</p>
        </div>
        <span className="statusPill">当前步骤 {step + 1}/5</span>
      </header>

      {message && <p className="successPanel">{message}</p>}
      {error && <p className="errorPanel">{error}</p>}
      {!view.eligible && <p className="errorPanel">{view.blockers.join("；")}</p>}
      {view.profile && !view.continuityRulesCurrent && (
        <p className="errorPanel">
          本次关键帧验收发现桌子形状、桌腿、书、灯和酒杯状态可能漂移。请点击“重新扫描批准素材”，确认并冻结新版规则后再预览；旧批次和旧授权不会复用。
        </p>
      )}

      {!view.profile ? (
        <section className="editorPanel continuityEmpty">
          <h2>1. 让系统先整理需要保持一致的内容</h2>
          <p>系统从已批准的场景、人物、产品、道具和分镜自动预填，不需要写 Prompt。</p>
          <button
            className="primaryButton"
            disabled={busy || !view.eligible}
            onClick={createSuggestions}
          >
            自动整理一致性设置
          </button>
        </section>
      ) : (
        <>
          <section className="editorPanel">
            <div className="sectionHeadingRow">
              <div>
                <h2>1. 全片哪些内容必须保持不变？</h2>
                <p>
                  人物、场景和主产品默认全片保持；未占用视频参考槽的批准道具也会列出，并默认允许逐镜变化。
                </p>
              </div>
              <div className="inlineActions">
                <button className="panelButton" disabled={busy} onClick={createSuggestions}>
                  重新扫描批准素材
                </button>
                <button className="panelButton" disabled={busy} onClick={saveVersion}>
                  保存为新版本
                </button>
              </div>
            </div>
            <div className="continuitySubjectGrid">
              {subjects.map((subject) => (
                <article className="continuitySubjectCard" key={subject.subjectKey}>
                  <span className="subjectKind">{kindLabels[subject.kind] ?? "其他"}</span>
                  <h3>{subject.label}</h3>
                  <div
                    className="policyChoices"
                    role="radiogroup"
                    aria-label={`${subject.label} 一致性规则`}
                  >
                    {(Object.keys(policyLabels) as Policy[]).map((policy) => (
                      <label
                        key={policy}
                        className={subject.rules[0]?.policy === policy ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name={subject.subjectKey}
                          checked={subject.rules[0]?.policy === policy}
                          onChange={() => updatePolicy(subject.subjectKey, policy)}
                        />
                        {policyLabels[policy]}
                      </label>
                    ))}
                  </div>
                  <p className="subjectHint">
                    {subject.sourceSha256 ? "已绑定批准素材" : "由分镜状态定义"} ·{" "}
                    {subject.rules[0]?.importance === "HARD" ? "必须满足" : "模型尽量参考"}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="editorPanel">
            <h2>2. 逐镜变化与共享边界</h2>
            <p>中间每一格同时是上一镜的结束和下一镜的开始，不需要填两遍。</p>
            <div className="boundaryTimeline">
              {boundaries.map((boundary, index) => (
                <div className="boundaryNode" key={boundary.id}>
                  <span className="boundaryIndex">K{boundary.boundaryIndex}</span>
                  <strong>{boundary.label}</strong>
                  <small>
                    {index === 0 || index === boundaries.length - 1 ? "端点状态" : "共享边界"}
                  </small>
                </div>
              ))}
            </div>
            {view.preflight?.blockers.map((issue) => (
              <div
                className="continuityIssue blocker"
                key={`${issue.code}-${issue.boundaryIndex}-${issue.subjectKey}`}
              >
                <div>
                  <strong>需要处理</strong>
                  <p>{issue.message}</p>
                </div>
                <div className="inlineActions">
                  {issue.actions.includes("INHERIT_PREVIOUS") && (
                    <button className="panelButton" onClick={() => inheritPrevious(issue)}>
                      沿用上一镜
                    </button>
                  )}
                  {issue.actions.includes("DECLARE_SHOT_CHANGE") && (
                    <button className="panelButton" onClick={() => allowChange(issue)}>
                      允许本镜变化
                    </button>
                  )}
                  {issue.actions.includes("SELECT_APPROVED_REFERENCE") && (
                    <a className="panelButton" href={`/projects/${projectId}`}>
                      重新选择参考
                    </a>
                  )}
                </div>
              </div>
            ))}
            {view.preflight?.warnings.map((issue) => (
              <div
                className="continuityIssue warning"
                key={`${issue.code}-${issue.boundaryIndex}-${issue.subjectKey}`}
              >
                <strong>模型只能参考</strong>
                <p>{issue.message}</p>
              </div>
            ))}
            {view.preflight?.ready && !currentApproved && (
              <button className="primaryButton" disabled={busy} onClick={approveProfile}>
                确认并冻结这版一致性设置
              </button>
            )}
            {currentApproved && (
              <p className="successPanel">
                一致性设置已冻结。后续修改会生成新版本，并让旧预览失效。
              </p>
            )}
          </section>

          {currentApproved && (
            <section className="editorPanel">
              <h2>3. 低成本关键帧联系表</h2>
              <p>
                三个 Shot 使用四张边界图。默认 Fake 不产生外部费用；LIVE
                必须另行显示实时价格并确认。
              </p>
              <label className="fieldLabel">
                图片方式
                <select
                  value={providerProfileId}
                  onChange={(event) => {
                    setProviderProfileId(event.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="fake-keyframe-v1">本地 Fake（0 credit，用于检查流程）</option>
                  <option value="codexmanager-gpt-image-2-v1">
                    Codex Manager · GPT Image 2（LIVE，需费用确认）
                  </option>
                </select>
              </label>
              <button className="panelButton" disabled={busy} onClick={previewKeyframes}>
                查看调用上限和费用（0 次调用）
              </button>
              {preview && (
                <div className="costConfirmation">
                  <h3>{preview.targets.length} 张边界关键帧</h3>
                  <dl>
                    <div>
                      <dt>最大图片调用</dt>
                      <dd>{preview.maximumCalls} 次</dd>
                    </div>
                    <div>
                      <dt>最大估算费用</dt>
                      <dd>
                        {preview.estimatedMaximumCostUsd === null
                          ? "价格不可用"
                          : `$${preview.estimatedMaximumCostUsd.toFixed(4)}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Provider 请求尺寸</dt>
                      <dd>{preview.capability.providerRequestSize}</dd>
                    </div>
                    <div>
                      <dt>成片关键帧尺寸</dt>
                      <dd>
                        {preview.capability.width}×{preview.capability.height}（本地校验并规范化）
                      </dd>
                    </div>
                    <div>
                      <dt>重试</dt>
                      <dd>失败不自动重试，不切换模型</dd>
                    </div>
                  </dl>
                  {preview.blockers.length > 0 && (
                    <p className="errorPanel">当前不能执行：{preview.blockers.join("、")}</p>
                  )}
                  {preview.ready && (
                    <button
                      className="primaryButton"
                      disabled={busy}
                      onClick={createAuthorizeAndRun}
                    >
                      {providerProfileId === "fake-keyframe-v1"
                        ? "确认并生成本地 Fake 联系表"
                        : `确认并生成 ${preview.maximumCalls} 张 LIVE 关键帧（最多 $${preview.estimatedMaximumCostUsd?.toFixed(4)}）`}
                    </button>
                  )}
                  {providerProfileId !== "fake-keyframe-v1" && !preview.ready && (
                    <p className="noticePanel">
                      当前只完成零调用预览。所有门控通过后才会显示 LIVE 生成确认按钮。
                    </p>
                  )}
                </div>
              )}
              {keyframes && (
                <div className="keyframeContactSheet">
                  {keyframes.targets.map((target) => (
                    <article key={target.boundaryIndex} className="keyframeCard">
                      <h3>
                        K{target.boundaryIndex} · {target.label}
                      </h3>
                      {target.artifact ? (
                        <>
                          <img
                            src={`/api/keyframe-artifacts/${target.artifact.id}/content`}
                            alt={`${target.label} 关键帧`}
                          />
                          <p>
                            {target.artifact.width}×{target.artifact.height} ·{" "}
                            {target.artifact.decision
                              ? `已${target.artifact.decision === "APPROVED" ? "批准" : "拒绝"}`
                              : "待人工确认"}
                          </p>
                          {!target.artifact.decision && (
                            <div className="inlineActions">
                              <button
                                className="primaryButton"
                                onClick={() => decideKeyframe(target.artifact!.id, "APPROVED")}
                              >
                                通过
                              </button>
                              <button
                                className="panelButton"
                                onClick={() => decideKeyframe(target.artifact!.id, "REJECTED")}
                              >
                                拒绝，不自动补图
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>{target.safeResultCode ?? "尚未生成"}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {keyframes?.status === "APPROVED" && (
                <p className="successPanel">
                  联系表已全部人工批准。下一步的视频确认必须重新显示 H3“普通参考”的限制与总费用。
                </p>
              )}
            </section>
          )}

          <details className="editorPanel advancedDetails">
            <summary>高级信息</summary>
            <p>
              版本 {view.profile.headVersion.versionNumber} · 技术 Hash、素材版本和 Provider
              快照仅用于追踪，不需要小白编辑。
            </p>
            <code>{view.profile.headVersion.outputHash}</code>
          </details>
        </>
      )}
    </main>
  );
}
