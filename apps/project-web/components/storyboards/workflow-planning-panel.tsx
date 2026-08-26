"use client";

import { useState } from "react";

type Shot = { shotKey: string; ordinal: number };
type Mode = "AUTO" | "PREFERRED" | "LOCKED";

const repairCopyZh: Record<string, string> = {
  CHANGE_IMPLEMENTATION: "不改变创意内容，仅选择另一个兼容实现。",
  RELAX_REQUIREMENT: "仅放宽负责人明确接受的非必要要求，并保留审计记录。",
  REPLACE_ASSET: "Shot 内容不变；返回素材库替换并重新批准绑定。",
  REWRITE_SHOT: "只重写阻塞 Shot，并约束前后状态连续。",
  SPLIT_SHOT: "把一个阻塞动作拆为连续 Shot，并保持故事边界状态。",
};

interface PlanningPreview {
  generationPlanVersionId: string;
  dependencyPolicyHash: string;
  counts: { ready: number; trial: number; blocked: number; waiting: number };
  shots: Array<{
    planId: string;
    shotKey: string;
    ordinal: number;
    planningOutcome: string;
    blockerCodes: string[];
    implementationId: string | null;
    estimatedCostMicros: number | null;
    currency: string | null;
  }>;
  canConfirm: boolean;
  previewHash: string;
  targets: Array<{
    shotExecutionPlanId: string;
    planTemplateSha256: string;
    executionDisposition: "EXECUTE";
  }>;
  costSnapshot: {
    schemaVersion: "batch-cost-snapshot-v1";
    currency: string;
    estimatedCostMicros: number;
    maximumCostMicros: number;
    generationCalls: number;
    qaCalls: number;
    pricingExpiresAt: string;
    retryPolicy: "NO_RETRY_NO_FALLBACK";
    snapshotHash: string;
  } | null;
  continuationPolicy: {
    schemaVersion: "qa-continuation-policy-v1";
    mode: "AUTO_CONTINUE_AFTER_QA_PASS" | "PAUSE_AFTER_EACH_SHOT";
    hardCriteria: string[];
    hardFailConfidence: "HIGH";
    policyHash: string;
  };
  externalCalls: 0;
  generationAuthorized: false;
}

interface RepairProposal {
  proposalHash: string;
  action: string;
  creativeImpact: string;
  estimatedCalls: number;
}

interface RepairPreview {
  proposals: RepairProposal[];
}

export function WorkflowPlanningPanel({
  generationPlanVersionId,
  generationPlanRowVersion,
  shots,
  isChinese,
}: {
  generationPlanVersionId: string;
  generationPlanRowVersion: number;
  shots: Shot[];
  isChinese: boolean;
}) {
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [preview, setPreview] = useState<PlanningPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [repairs, setRepairs] = useState<Record<string, RepairPreview>>({});
  const [confirmed, setConfirmed] = useState(false);

  async function plan() {
    setBusy(true);
    setError("");
    setConfirmed(false);
    const shotPreferences = shots.map((shot) => {
      const mode = modes[shot.shotKey] ?? "AUTO";
      const modelSelection =
        mode === "PREFERRED"
          ? { mode, preferredModelFamilies: ["minimax-h3"] }
          : mode === "LOCKED"
            ? {
                mode,
                providerId: "comfyui-partner",
                modelProfileId: "minimax-h3-comfyui-partner",
              }
            : { mode };
      return { shotKey: shot.shotKey, modelSelection };
    });
    const response = await fetch(
      `/api/generation-plan-versions/${generationPlanVersionId}/workflow-plans`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaVersion: "workflow-planning-request-v1", shotPreferences }),
      },
    );
    const body = (await response.json()) as PlanningPreview & {
      error?: { message?: string };
    };
    if (response.ok) setPreview(body);
    else setError(body.error?.message ?? (isChinese ? "规划失败。" : "Planning failed."));
    setBusy(false);
  }

  async function loadRepair(planId: string) {
    const response = await fetch(`/api/shot-execution-plans/${planId}/repair-preview`, {
      method: "POST",
    });
    const body = (await response.json()) as RepairPreview & { error?: { message?: string } };
    if (response.ok) setRepairs((current) => ({ ...current, [planId]: body }));
    else
      setError(
        body.error?.message ?? (isChinese ? "修复方案读取失败。" : "Repair options failed."),
      );
  }

  async function confirmBatch() {
    if (!preview?.canConfirm || !preview.costSnapshot || !confirmed) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/generation-batches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
        "If-Match": `"generation-plan-${generationPlanRowVersion}"`,
      },
      body: JSON.stringify({
        engineVersion: "WORKFLOW_AGENT_V1",
        generationPlanVersionId: preview.generationPlanVersionId,
        dependencyPolicyHash: preview.dependencyPolicyHash,
        targets: preview.targets,
        costSnapshot: preview.costSnapshot,
        continuationPolicy: preview.continuationPolicy,
        previewHash: preview.previewHash,
        confirmed: true,
        expiresInSeconds: 300,
      }),
    });
    const body = (await response.json()) as { error?: { message?: string } };
    if (response.ok) window.location.reload();
    else {
      setError(
        body.error?.message ?? (isChinese ? "批次确认失败。" : "Batch confirmation failed."),
      );
      setBusy(false);
    }
  }

  return (
    <section
      className="storyboardPanel workflowPlanningPanel"
      aria-label={isChinese ? "工作流规划" : "Workflow planning"}
    >
      <div>
        <p className="eyebrow">{isChinese ? "零调用规划" : "Zero-call planning"}</p>
        <h2>{isChinese ? "为每个 Shot 选择执行方式" : "Choose execution per Shot"}</h2>
        <p>
          {isChinese
            ? "AUTO 自动择优；PREFERRED 优先同系列；LOCKED 固定到已注册实现。规划不会授权或提交视频。"
            : "AUTO selects deterministically, PREFERRED favors one family, and LOCKED fixes a registered model. Planning never authorizes or submits video."}
        </p>
      </div>
      <div className="workflowPreferenceGrid">
        {shots.map((shot) => (
          <label key={shot.shotKey}>
            {isChinese ? `Shot ${shot.ordinal} 模式` : `Shot ${shot.ordinal} mode`}
            <select
              value={modes[shot.shotKey] ?? "AUTO"}
              onChange={(event) => {
                setModes((current) => ({
                  ...current,
                  [shot.shotKey]: event.target.value as Mode,
                }));
                setPreview(null);
                setConfirmed(false);
              }}
            >
              <option value="AUTO">AUTO</option>
              <option value="PREFERRED">PREFERRED</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </label>
        ))}
      </div>
      <button className="panelButton" disabled={busy} onClick={() => void plan()}>
        {busy
          ? isChinese
            ? "正在规划…"
            : "Planning…"
          : isChinese
            ? "刷新工作流规划"
            : "Refresh workflow plan"}
      </button>
      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}
      {!preview && (
        <p className="noticePanel">
          {isChinese ? "尚未生成工作流规划。" : "No workflow plan yet."}
        </p>
      )}
      {preview && (
        <div className="workflowPlanningResults" aria-live="polite">
          <p>
            <strong>
              {isChinese ? "可执行" : "Ready"}: {preview.counts.ready}
            </strong>{" "}
            · {isChinese ? "试运行" : "Trial"}: {preview.counts.trial} ·{" "}
            {isChinese ? "阻塞" : "Blocked"}: {preview.counts.blocked} ·{" "}
            {isChinese ? "等待上游" : "Waiting"}: {preview.counts.waiting}
          </p>
          {preview.costSnapshot && (
            <div className="noticePanel">
              <p>
                {isChinese ? "本批次上限" : "Batch ceiling"}:{" "}
                {preview.costSnapshot.maximumCostMicros} {isChinese ? "微单位" : "micros"}{" "}
                {preview.costSnapshot.currency} · {preview.costSnapshot.generationCalls}{" "}
                {isChinese ? "次视频" : "video call(s)"} · {preview.costSnapshot.qaCalls}{" "}
                {isChinese ? "次 AI 质检" : "AI QA call(s)"}
              </p>
              <p>
                {isChinese
                  ? "无重试、无自动换模型或供应商。"
                  : "No retry and no automatic model/provider fallback."}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                {isChinese
                  ? "我确认以上确切范围和费用上限"
                  : "I confirm this exact scope and cost ceiling"}
              </label>
              <button
                className="primaryButton"
                disabled={busy || !preview.canConfirm || !confirmed}
                onClick={() => void confirmBatch()}
              >
                {isChinese ? "确认一次有界视频批次" : "Confirm one bounded video batch"}
              </button>
            </div>
          )}
          {preview.shots.map((shot) => (
            <article className="executionShot" key={shot.planId}>
              <h3>
                Shot {shot.ordinal} · {shot.planningOutcome}
              </h3>
              <p>
                {shot.implementationId ??
                  (isChinese ? "尚无可用实现" : "No available implementation")}
              </p>
              {shot.blockerCodes.length > 0 && (
                <div className="formError">
                  <p>
                    {isChinese
                      ? `${shot.blockerCodes.length} 项执行条件尚未满足。`
                      : `${shot.blockerCodes.length} execution conditions are not ready.`}
                  </p>
                  <details>
                    <summary>{isChinese ? "技术证据" : "Technical evidence"}</summary>
                    <p>{shot.blockerCodes.join(" · ")}</p>
                  </details>
                </div>
              )}
              {shot.planningOutcome === "BLOCKED" && (
                <button className="panelButton" onClick={() => void loadRepair(shot.planId)}>
                  {isChinese ? "查看修复选择" : "View repair options"}
                </button>
              )}
              {repairs[shot.planId] && (
                <ul className="repairOptionList">
                  {repairs[shot.planId]?.proposals.map((repair) => (
                    <li key={repair.proposalHash}>
                      <strong>{repair.action}</strong> ·{" "}
                      {isChinese
                        ? (repairCopyZh[repair.action] ?? repair.creativeImpact)
                        : repair.creativeImpact}{" "}
                      · {repair.estimatedCalls} {isChinese ? "次调用" : "call(s)"}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
