"use client";

import { useEffect, useRef, useState } from "react";
import {
  capabilityBlockerGuidanceText,
  capabilityPurposeText,
  capabilityRequirementReasonText,
} from "../i18n/language-provider";
import { CapabilityV3BatchReview } from "./capability-v3-batch-review";

type Shot = { shotKey: string; ordinal: number };

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

interface CapabilityPlanningPreview {
  planId: string;
  planDigest: string;
  state: "VALID" | "BLOCKED";
  counts: { ready: number; trial: number; blocked: number };
  shots: Array<{
    shotId: string;
    shotKey: string;
    ordinal: number;
    planningOutcome: "READY" | "TRIAL" | "BLOCKED";
    blockerCodes: string[];
    requirements: Array<{
      purpose: string;
      necessity: "REQUIRED" | "OPTIONAL" | "OMITTED";
      reasonCode: string;
      constraints: string[];
    }>;
    bindings: Array<{
      id: string;
      purpose: string;
      modality: "IMAGE" | "VIDEO" | "AUDIO";
      roleLabel: string;
      necessity: "REQUIRED" | "OPTIONAL";
    }>;
    implementationRef: { id: string; version: string };
    implementationLifecycle: string;
    generationSpecRef: { id: string; version: string };
    referencePlanDigest: string | null;
    materializedGraphSha256: string | null;
    graphValidationStatus: "VALID" | null;
  }>;
  externalCalls: 0;
  generationAuthorized: false;
}

interface CapabilityExecutionPreview {
  schemaVersion: "capability-generation-execution-preview-v3";
  generationPlanId: string;
  planDigest: string;
  selectedShotIds: string[];
  targets: Array<{
    shotId: string;
    ordinal: number;
    lifecycle: "READY" | "TRIAL";
    implementationRef: { id: string; version: string };
    providerRef: { id: string; version: string };
    compilerRef: { id: string; version: string };
    blockers: string[];
  }>;
  ready: boolean;
  submissionBlockers: string[];
  expectedCalls: number;
  maximumCalls: number;
  maximumAiQaCalls: number;
  costPolicyDigest: string;
  maximumCostMicros: number | null;
  currency: string | null;
  localComputeResources: string[];
  pricingExpiresAt: string | null;
  noRetry: true;
  noFallback: true;
  externalCalls: 0;
  generationAuthorized: false;
  previewHash: string;
}

interface CapabilityBatch {
  id: string;
  state: string;
  expectedCalls: number;
  maximumCalls: number;
  maximumAiQaCalls: number;
  authorization: { expiresAt: string; consumedCalls: number };
}

interface TrialScopeApproval {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  scopeDigest: string;
  items: Array<{
    shotId: string;
    implementationRef: { id: string; version: string };
    providerRef: { id: string; version: string };
    modelRef: { id: string; version: string };
    adapterRef: { id: string; version: string };
    compilerRef: { id: string; version: string };
    costPolicyDigest: string;
  }>;
  externalCalls: 0;
  generationAuthorized: false;
  executionAuthorized: false;
}

interface TrialScopeHistory {
  approvals: TrialScopeApproval[];
  externalCalls: 0;
  generationAuthorized: false;
  executionAuthorized: false;
}

export function CapabilityWorkflowPlanningPanel({
  projectId,
  storyboardVersionId,
  storyboardRevisionVersion,
  shots,
  isChinese,
}: {
  projectId: string;
  storyboardVersionId: string;
  storyboardRevisionVersion: string;
  shots: Array<{ id: string; shotKey: string; ordinal: number }>;
  isChinese: boolean;
}) {
  const locale = isChinese ? "zh-CN" : "en";
  const [selectedShotIds, setSelectedShotIds] = useState(() => shots.map((shot) => shot.id));
  const [hailuoParameters, setHailuoParameters] = useState<
    Record<string, { aspectRatio: string; resolution: "768P" | "2K" }>
  >(() =>
    Object.fromEntries(
      shots.map((shot) => [shot.id, { aspectRatio: "adaptive", resolution: "768P" as const }]),
    ),
  );
  const [preview, setPreview] = useState<CapabilityPlanningPreview | null>(null);
  const [selectedForExecution, setSelectedForExecution] = useState<string[]>([]);
  const [executionPreview, setExecutionPreview] = useState<CapabilityExecutionPreview | null>(null);
  const [trialScopeHistory, setTrialScopeHistory] = useState<TrialScopeApproval[]>([]);
  const [selectedTrialShotIds, setSelectedTrialShotIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [batch, setBatch] = useState<CapabilityBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trialApprovalKey = useRef<string | null>(null);
  const trialRevocationKeys = useRef(new Map<string, string>());
  const shotIdentityKey = shots.map((shot) => shot.id).join(":");

  useEffect(() => {
    const currentIds = new Set(shots.map((shot) => shot.id));
    setSelectedShotIds((current) => current.filter((shotId) => currentIds.has(shotId)));
    setSelectedForExecution((current) => current.filter((shotId) => currentIds.has(shotId)));
    setHailuoParameters((current) =>
      Object.fromEntries(
        shots.map((shot) => [
          shot.id,
          current[shot.id] ?? { aspectRatio: "adaptive", resolution: "768P" as const },
        ]),
      ),
    );
    setPreview(null);
    setExecutionPreview(null);
    setConfirmed(false);
  }, [shotIdentityKey]);

  async function loadTrialScopeHistory() {
    const response = await fetch(
      `/api/storyboard-versions/${storyboardVersionId}/trial-scope-approvals`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const body = (await response.json()) as TrialScopeHistory;
    setTrialScopeHistory(body.approvals);
  }

  useEffect(() => {
    void loadTrialScopeHistory();
  }, [storyboardVersionId]);

  async function plan() {
    if (selectedShotIds.length === 0) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/storyboard-versions/${storyboardVersionId}/workflow-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "workflow-planning-request-v3",
        projectId,
        shotIds: selectedShotIds,
        storyboardRevisionRefs: [{ id: storyboardVersionId, version: storyboardRevisionVersion }],
        optionalOwnerConstraints: [],
        hailuo03Parameters: selectedShotIds.map((shotId) => ({
          shotId,
          aspectRatio: hailuoParameters[shotId]?.aspectRatio ?? "adaptive",
          resolution: hailuoParameters[shotId]?.resolution ?? "768P",
          watermark: false,
        })),
      }),
    });
    const body = (await response.json()) as CapabilityPlanningPreview & {
      error?: { message?: string };
    };
    if (response.ok) {
      setPreview(body);
      setSelectedTrialShotIds(
        body.shots
          .filter(
            (shot) =>
              shot.implementationLifecycle === "TRIAL" &&
              shot.blockerCodes.includes("TRIAL_SCOPE_REQUIRED"),
          )
          .map((shot) => shot.shotId),
      );
      setSelectedForExecution(
        body.shots
          .filter((shot) => shot.planningOutcome === "READY" || shot.planningOutcome === "TRIAL")
          .map((shot) => shot.shotId),
      );
      setExecutionPreview(null);
      setConfirmed(false);
      setBatch(null);
    } else
      setError(body.error?.message ?? (isChinese ? "镜头规划失败。" : "Shot planning failed."));
    setBusy(false);
  }

  async function approveTrialScope() {
    if (!preview || selectedTrialShotIds.length === 0) return;
    setBusy(true);
    setError("");
    const idempotencyKey = trialApprovalKey.current ?? crypto.randomUUID();
    trialApprovalKey.current = idempotencyKey;
    const response = await fetch(
      `/api/storyboard-versions/${storyboardVersionId}/trial-scope-approvals`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          schemaVersion: "trial-scope-approval-create-request-v3",
          generationPlanId: preview.planId,
          selectedShotIds: selectedTrialShotIds,
          expiresInSeconds: 1_800,
          confirmed: true,
        }),
      },
    );
    const body = (await response.json()) as TrialScopeApproval & {
      error?: { message?: string };
    };
    if (!response.ok) {
      setError(
        body.error?.message ??
          (isChinese ? "首次真实试运行范围批准失败。" : "Trial scope approval failed."),
      );
      setBusy(false);
      return;
    }
    trialApprovalKey.current = null;
    await loadTrialScopeHistory();
    setBusy(false);
    await plan();
  }

  async function revokeTrialScope(approvalId: string) {
    setBusy(true);
    setError("");
    const idempotencyKey = trialRevocationKeys.current.get(approvalId) ?? crypto.randomUUID();
    trialRevocationKeys.current.set(approvalId, idempotencyKey);
    const response = await fetch(`/api/trial-scope-approvals/${approvalId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        schemaVersion: "trial-scope-revocation-request-v3",
        reasonCode: "OWNER_REVOKED",
        confirmed: true,
      }),
    });
    const body = (await response.json()) as TrialScopeApproval & {
      error?: { message?: string };
    };
    if (!response.ok) {
      setError(
        body.error?.message ??
          (isChinese ? "试运行范围撤销失败。" : "Trial scope revocation failed."),
      );
      setBusy(false);
      return;
    }
    await loadTrialScopeHistory();
    setBusy(false);
    if (preview) await plan();
  }

  async function prepareExecutionPreview() {
    if (!preview || selectedForExecution.length === 0) return;
    setBusy(true);
    setError("");
    setConfirmed(false);
    const response = await fetch(
      `/api/generation-plan-versions/${preview.planId}/execution-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: "capability-generation-execution-preview-request-v3",
          shotIds: selectedForExecution,
        }),
      },
    );
    const body = (await response.json()) as CapabilityExecutionPreview & {
      error?: { message?: string };
    };
    if (response.ok) setExecutionPreview(body);
    else
      setError(
        body.error?.message ?? (isChinese ? "生成确认预览失败。" : "Execution preview failed."),
      );
    setBusy(false);
  }

  async function confirmExecutionBatch() {
    if (!executionPreview?.ready || !confirmed) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/generation-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        engineVersion: "CAPABILITY_V3",
        generationPlanId: executionPreview.generationPlanId,
        shotIds: executionPreview.selectedShotIds,
        planDigest: executionPreview.planDigest,
        previewHash: executionPreview.previewHash,
        costPolicyDigest: executionPreview.costPolicyDigest,
        maximumCalls: executionPreview.maximumCalls,
        maximumAiQaCalls: executionPreview.maximumAiQaCalls,
        maximumCostMicros: executionPreview.maximumCostMicros,
        confirmed: true,
        noRetry: true,
        noFallback: true,
        expiresInSeconds: 300,
      }),
    });
    const body = (await response.json()) as CapabilityBatch & { error?: { message?: string } };
    if (response.ok) setBatch(body);
    else
      setError(
        body.error?.message ??
          (isChinese ? "批次确认失败，未创建任何任务。" : "Batch confirmation failed."),
      );
    setBusy(false);
  }

  return (
    <section
      className="storyboardPanel workflowPlanningPanel"
      aria-label={isChinese ? "逐镜头生成准备" : "Per-Shot generation preparation"}
    >
      <div>
        <p className="eyebrow">
          {isChinese ? "零调用 · 无中间审批" : "Zero calls · no intermediate approval"}
        </p>
        <h2>{isChinese ? "只准备每个镜头真正需要的内容" : "Prepare only what each Shot needs"}</h2>
        <p>
          {isChinese
            ? "选择已保存的镜头后，系统会分别说明必需、可选和已省略的输入。规划会自动保存不可变生成规格，但不会授权或提交视频。"
            : "Select saved Shots to see required, optional, and omitted inputs independently. Planning automatically saves immutable generation specs but never authorizes or submits video."}
        </p>
      </div>
      <div className="workflowPreferenceGrid">
        {shots.map((shot) => (
          <div key={shot.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedShotIds.includes(shot.id)}
                onChange={(event) => {
                  setSelectedShotIds((current) =>
                    event.target.checked
                      ? [...current, shot.id]
                      : current.filter((shotId) => shotId !== shot.id),
                  );
                  setPreview(null);
                }}
              />
              {isChinese ? `镜头 ${shot.ordinal}` : `Shot ${shot.ordinal}`}
            </label>
            <select
              aria-label={isChinese ? `镜头 ${shot.ordinal} 比例` : `Shot ${shot.ordinal} ratio`}
              value={hailuoParameters[shot.id]?.aspectRatio ?? "adaptive"}
              onChange={(event) => {
                setHailuoParameters((current) => ({
                  ...current,
                  [shot.id]: {
                    aspectRatio: event.target.value,
                    resolution: current[shot.id]?.resolution ?? "768P",
                  },
                }));
                setPreview(null);
              }}
            >
              {["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"].map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
            <select
              aria-label={
                isChinese ? `镜头 ${shot.ordinal} 分辨率` : `Shot ${shot.ordinal} resolution`
              }
              value={hailuoParameters[shot.id]?.resolution ?? "768P"}
              onChange={(event) => {
                setHailuoParameters((current) => ({
                  ...current,
                  [shot.id]: {
                    aspectRatio: current[shot.id]?.aspectRatio ?? "adaptive",
                    resolution: event.target.value as "768P" | "2K",
                  },
                }));
                setPreview(null);
              }}
            >
              <option value="768P">768P</option>
              <option value="2K">2K</option>
            </select>
          </div>
        ))}
      </div>
      <button
        className="panelButton"
        disabled={busy || selectedShotIds.length === 0}
        onClick={() => void plan()}
      >
        {busy
          ? isChinese
            ? "正在逐镜头分析…"
            : "Analyzing each Shot…"
          : isChinese
            ? "生成逐镜头准备说明"
            : "Prepare selected Shots"}
      </button>
      {error && <p className="formError">{error}</p>}
      {preview && (
        <div className="workflowPlanningResults" aria-live="polite">
          <p>
            <strong>
              {isChinese ? "可用" : "Ready"}: {preview.counts.ready}
            </strong>{" "}
            · {isChinese ? "试运行" : "Trial"}: {preview.counts.trial} ·{" "}
            {isChinese ? "需补充" : "Blocked"}: {preview.counts.blocked}
          </p>
          <p className="noticePanel">
            {isChinese
              ? "这次规划没有外部调用，也没有生成授权。某个镜头缺少输入，不会阻止其他镜头继续准备。"
              : "This plan made no external calls and granted no generation authority. A missing input on one Shot does not block another Shot."}
          </p>
          {preview.shots.some(
            (shot) =>
              shot.implementationLifecycle === "TRIAL" &&
              shot.blockerCodes.includes("TRIAL_SCOPE_REQUIRED"),
          ) && (
            <section
              className="noticePanel"
              aria-label={
                isChinese ? "批准本次首次真实试运行范围" : "Approve first real trial scope"
              }
            >
              <h3>
                {isChinese ? "批准本次首次真实试运行范围" : "Approve this first real trial scope"}
              </h3>
              <p>
                {isChinese
                  ? "这里只允许所选镜头在当前分镜版本中使用下列精确试运行实现，有效 30 分钟。批准本身不会调用外部服务、不会把实现升级为可用，也不会授权或提交视频。"
                  : "This only lets the selected Shots use the exact trial implementation in this Storyboard version for 30 minutes. Approval makes no external call, does not promote the implementation, and does not authorize or submit video."}
              </p>
              <div className="workflowPreferenceGrid">
                {preview.shots
                  .filter(
                    (shot) =>
                      shot.implementationLifecycle === "TRIAL" &&
                      shot.blockerCodes.includes("TRIAL_SCOPE_REQUIRED"),
                  )
                  .map((shot) => (
                    <label key={shot.shotId}>
                      <input
                        type="checkbox"
                        checked={selectedTrialShotIds.includes(shot.shotId)}
                        onChange={(event) =>
                          setSelectedTrialShotIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, shot.shotId])]
                              : current.filter((shotId) => shotId !== shot.shotId),
                          )
                        }
                      />
                      {isChinese ? `镜头 ${shot.ordinal}` : `Shot ${shot.ordinal}`} ·{" "}
                      {shot.implementationRef.id} · v{shot.implementationRef.version}
                    </label>
                  ))}
              </div>
              <button
                className="primaryButton"
                disabled={busy || selectedTrialShotIds.length === 0}
                onClick={() => void approveTrialScope()}
              >
                {isChinese ? "批准本次首次真实试运行范围" : "Approve this first real trial scope"}
              </button>
              <p>
                {isChinese
                  ? "批准后请重新生成逐镜头说明，随后才可查看零调用生成预览。真实执行仍需新的动作时确认。"
                  : "After approval, replan before opening the zero-call execution preview. Real execution still needs a fresh action-time confirmation."}
              </p>
            </section>
          )}
          {trialScopeHistory.length > 0 && (
            <details
              className="noticePanel"
              open={trialScopeHistory.some((item) => item.status === "ACTIVE")}
            >
              <summary>
                {isChinese ? "首次真实试运行批准记录" : "First real trial approvals"}
              </summary>
              {trialScopeHistory.map((approval) => (
                <article key={approval.id} className="executionShot">
                  <p>
                    <strong>
                      {approval.status === "ACTIVE"
                        ? isChinese
                          ? "当前有效"
                          : "Active"
                        : approval.status === "EXPIRED"
                          ? isChinese
                            ? "已过期"
                            : "Expired"
                          : isChinese
                            ? "已撤销"
                            : "Revoked"}
                    </strong>{" "}
                    · {isChinese ? "有效至" : "expires"}{" "}
                    {new Date(approval.expiresAt).toLocaleString(isChinese ? "zh-CN" : "en")}
                  </p>
                  <ul>
                    {approval.items.map((item) => {
                      const shot = shots.find((candidate) => candidate.id === item.shotId);
                      return (
                        <li key={item.shotId}>
                          {isChinese
                            ? `镜头 ${shot?.ordinal ?? "?"}`
                            : `Shot ${shot?.ordinal ?? "?"}`}{" "}
                          · {item.implementationRef.id} v{item.implementationRef.version} ·{" "}
                          {item.providerRef.id} v{item.providerRef.version} · {item.modelRef.id} v
                          {item.modelRef.version} · {item.compilerRef.id} v
                          {item.compilerRef.version}
                        </li>
                      );
                    })}
                  </ul>
                  <details>
                    <summary>{isChinese ? "审计摘要" : "Audit digest"}</summary>
                    <p data-i18n-ignore="true">{approval.scopeDigest}</p>
                  </details>
                  {approval.status === "ACTIVE" && (
                    <button
                      className="panelButton"
                      disabled={busy}
                      onClick={() => void revokeTrialScope(approval.id)}
                    >
                      {isChinese ? "撤销此试运行范围" : "Revoke this trial scope"}
                    </button>
                  )}
                </article>
              ))}
            </details>
          )}
          {preview.shots.map((shot) => (
            <article className="executionShot" key={shot.generationSpecRef.id}>
              <h3>
                {isChinese ? "镜头" : "Shot"} {shot.ordinal} · {shot.planningOutcome}
              </h3>
              <p>
                {shot.implementationRef.id} · v{shot.implementationRef.version} ·{" "}
                {shot.implementationLifecycle}
              </p>
              {(["REQUIRED", "OPTIONAL", "OMITTED"] as const).map((necessity) => {
                const items = shot.requirements.filter((item) => item.necessity === necessity);
                if (items.length === 0) return null;
                const label = isChinese
                  ? { REQUIRED: "必需", OPTIONAL: "可选", OMITTED: "已省略" }[necessity]
                  : { REQUIRED: "Required", OPTIONAL: "Optional", OMITTED: "Omitted" }[necessity];
                return (
                  <div key={necessity} className="shotRequirements">
                    <strong>{label}</strong>
                    <ul>
                      {items.map((item) => (
                        <li key={item.purpose}>
                          <strong>{capabilityPurposeText(item.purpose, locale)}</strong>
                          {" — "}
                          {capabilityRequirementReasonText(item.reasonCode, locale)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {shot.blockerCodes.length > 0 && (
                <div className="formError">
                  <strong>{isChinese ? "继续前需要处理" : "Before continuing"}</strong>
                  <ul>
                    {shot.blockerCodes.map((code) => (
                      <li key={code}>{capabilityBlockerGuidanceText(code, locale)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <details>
                <summary>{isChinese ? "技术记录" : "Technical record"}</summary>
                <div data-i18n-ignore="true">
                  <p>GenerationSpec V3 · {shot.generationSpecRef.id} · immutable, unauthorized</p>
                  <p>
                    Requirement reason codes ·{" "}
                    {shot.requirements.map((item) => item.reasonCode).join(" · ")}
                  </p>
                  <p>Blocker codes · {shot.blockerCodes.join(" · ") || "NONE"}</p>
                  <p>ReferencePlan · {shot.referencePlanDigest ?? "NOT_MATERIALIZED"}</p>
                  <p>Materialized Graph · {shot.materializedGraphSha256 ?? "NOT_MATERIALIZED"}</p>
                  <p>Graph validation · {shot.graphValidationStatus ?? "NOT_VALIDATED"}</p>
                </div>
              </details>
            </article>
          ))}
          <section
            className="noticePanel"
            aria-label={isChinese ? "一次批次确认" : "One batch confirmation"}
          >
            <h3>{isChinese ? "选择本次要生成的镜头" : "Select Shots for this batch"}</h3>
            <p>
              {isChinese
                ? "阻塞镜头不会进入批次。确认只覆盖这里选择的精确镜头、版本、调用上限和费用策略。"
                : "Blocked Shots stay out. Confirmation covers only the exact selected Shots, versions, call caps, and cost policy."}
            </p>
            <div className="workflowPreferenceGrid">
              {preview.shots
                .filter((shot) => shot.planningOutcome !== "BLOCKED")
                .map((shot) => (
                  <label key={shot.shotId}>
                    <input
                      type="checkbox"
                      checked={selectedForExecution.includes(shot.shotId)}
                      onChange={(event) => {
                        setSelectedForExecution((current) =>
                          event.target.checked
                            ? [...new Set([...current, shot.shotId])]
                            : current.filter((shotId) => shotId !== shot.shotId),
                        );
                        setExecutionPreview(null);
                        setConfirmed(false);
                      }}
                    />
                    {isChinese ? `镜头 ${shot.ordinal}` : `Shot ${shot.ordinal}`} ·{" "}
                    {shot.implementationLifecycle === "TRIAL"
                      ? isChinese
                        ? "首次真实试运行"
                        : "First real trial"
                      : isChinese
                        ? "可用"
                        : "Ready"}
                  </label>
                ))}
            </div>
            <button
              className="panelButton"
              disabled={busy || selectedForExecution.length === 0 || Boolean(batch)}
              onClick={() => void prepareExecutionPreview()}
            >
              {isChinese ? "零调用生成预览" : "Zero-call execution preview"}
            </button>
            {executionPreview && (
              <div>
                <p>
                  {isChinese ? "视频调用上限" : "Video call cap"}: {executionPreview.maximumCalls} ·{" "}
                  {isChinese ? "AI 质检上限" : "AI QA ceiling"}: {executionPreview.maximumAiQaCalls}
                </p>
                <p>
                  {executionPreview.maximumCostMicros === null
                    ? `${isChinese ? "本地计算" : "Local compute"}: ${executionPreview.localComputeResources.join(", ") || "configured runtime"}`
                    : `${isChinese ? "费用上限" : "Cost ceiling"}: ${executionPreview.maximumCostMicros} ${executionPreview.currency ?? ""} micros`}
                </p>
                <p>
                  {isChinese
                    ? "只授权一次；失败或结果不确定都会消耗调用，不自动重试，也不切换模型或供应商。"
                    : "One bounded authorization only. Failed or ambiguous attempts consume the call; no retry or provider/model fallback."}
                </p>
                {!executionPreview.ready && (
                  <p className="formError">
                    {isChinese
                      ? "精确版本或费用事实已变化，请重新规划。"
                      : "An exact version or cost fact changed. Replan before confirming."}
                  </p>
                )}
                {executionPreview.submissionBlockers.includes("LIVE_DISABLED") && (
                  <p className="noticePanel">
                    {isChinese
                      ? "服务器 LIVE 开关当前关闭。可以检查预览，但不能创建或提交批次。"
                      : "The server LIVE switch is off. You can inspect this preview, but no Batch can be created or submitted."}
                  </p>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={
                      !executionPreview.ready ||
                      executionPreview.submissionBlockers.length > 0 ||
                      Boolean(batch)
                    }
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  {isChinese
                    ? "我确认以上精确镜头范围、调用上限、费用/资源策略和无重试规则"
                    : "I confirm this exact Shot scope, call cap, cost/resource policy, and no-retry rule"}
                </label>
                <button
                  className="primaryButton"
                  disabled={
                    busy ||
                    !executionPreview.ready ||
                    executionPreview.submissionBlockers.length > 0 ||
                    !confirmed ||
                    Boolean(batch)
                  }
                  onClick={() => void confirmExecutionBatch()}
                >
                  {isChinese ? "确认一次有界视频批次" : "Confirm one bounded video batch"}
                </button>
              </div>
            )}
            {batch && (
              <p className="successPanel">
                {isChinese ? "批次已原子创建" : "Batch created atomically"} · {batch.state} ·{" "}
                {isChinese ? "授权调用" : "authorized calls"} {batch.authorization.consumedCalls}/
                {batch.maximumCalls}
              </p>
            )}
          </section>
          {batch && (
            <CapabilityV3BatchReview
              batchId={batch.id}
              storyboardVersionId={storyboardVersionId}
              isChinese={isChinese}
            />
          )}
        </div>
      )}
    </section>
  );
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
  const [preview, setPreview] = useState<PlanningPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [repairs, setRepairs] = useState<Record<string, RepairPreview>>({});
  const [confirmed, setConfirmed] = useState(false);

  async function plan() {
    setBusy(true);
    setError("");
    setConfirmed(false);
    const shotPreferences = shots.map((shot) => ({
      shotKey: shot.shotKey,
      modelSelection: { mode: "AUTO" as const },
    }));
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
            ? "服务器会根据每个镜头的输入能力、实现生命周期、费用策略和阻塞原因确定精确版本。规划不会授权或提交视频。"
            : "The server resolves an exact version from each Shot's input capabilities, implementation lifecycle, cost policy, and blockers. Planning never authorizes or submits video."}
        </p>
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
