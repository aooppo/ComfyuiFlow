"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/language-provider";

interface DirectorRunView {
  id: string;
  providerId: string;
  requestedModelId: string;
  resolvedModelId: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "AMBIGUOUS";
  safeResultCode: string;
  providerCallCount: number;
  maxShotCount: number | null;
  maxCostUsd: number | null;
  historical: boolean;
  proposal: { id: string; outputHash: string } | null;
  authorization: { maxCalls: number; consumedAt: string | null; expiresAt: string } | null;
}

interface DirectorProposalView {
  id: string;
  narrativeSummary: string;
  normalizedProposalJson: {
    narrativeSummary: string;
    shots: Array<{
      shotKey: string;
      ordinal: number;
      title: string;
      creativeDescription: string;
      startState: string;
      action: string;
      endState: string;
      camera: string;
      composition: string;
      continuityRequirements: string[];
      durationSeconds: number;
      referenceAliases: string[];
    }>;
  };
  decisions: Array<{ id: string; type: "ADOPTED" | "REJECTED" }>;
  historical: boolean;
}

export function StoryboardDirectorPanel({
  storyboardId,
  rowVersion,
  onChanged,
}: {
  storyboardId: string;
  rowVersion: number;
  onChanged: () => Promise<void>;
}) {
  const { locale } = useLanguage();
  const isChinese = locale === "zh-CN";
  const [runs, setRuns] = useState<DirectorRunView[]>([]);
  const [proposals, setProposals] = useState<DirectorProposalView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [runResponse, proposalResponse] = await Promise.all([
      fetch(`/api/storyboards/${storyboardId}/director-runs`, { cache: "no-store" }),
      fetch(`/api/storyboards/${storyboardId}/director-proposals`, { cache: "no-store" }),
    ]);
    if (!runResponse.ok || !proposalResponse.ok)
      throw new Error(
        isChinese ? "AI 分镜状态暂时无法读取" : "AI Storyboard status is unavailable",
      );
    setRuns((await runResponse.json()) as DirectorRunView[]);
    setProposals((await proposalResponse.json()) as DirectorProposalView[]);
  }, [isChinese, storyboardId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "AI Storyboard status is unavailable"),
    );
  }, [load]);

  const active = useMemo(
    () => runs.some((run) => run.status === "QUEUED" || run.status === "RUNNING"),
    [runs],
  );
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load().catch(() => undefined), 2_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  async function decide(proposal: DirectorProposalView, decision: "ADOPT" | "REJECT") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/storyboard-director-proposals/${proposal.id}/${decision === "ADOPT" ? "adopt" : "decisions"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(decision === "ADOPT" ? { "If-Match": `"storyboard-${rowVersion}"` } : {}),
          },
          body: JSON.stringify(
            decision === "ADOPT"
              ? {
                  idempotencyKey: crypto.randomUUID(),
                  narrativeSummary: proposal.normalizedProposalJson.narrativeSummary,
                  shots: proposal.normalizedProposalJson.shots,
                }
              : { idempotencyKey: crypto.randomUUID(), note: "Owner rejected the AI proposal." },
          ),
        },
      );
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "AI proposal decision failed");
      await Promise.all([load(), onChanged()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI proposal decision failed");
    } finally {
      setBusy(false);
    }
  }

  const currentRuns = runs.filter((run) => !run.historical);
  const currentProposals = proposals.filter((proposal) => !proposal.historical);
  const historicalCount = runs.length - currentRuns.length;
  if (runs.length === 0 && proposals.length === 0) return null;

  return (
    <section className="storyboardPanel" aria-live="polite">
      <h2>{isChinese ? "AI 分镜脚本" : "AI Storyboard script"}</h2>
      {error && <p className="formError">{error}</p>}
      {currentRuns.map((run) => (
        <article className="noticePanel" key={run.id}>
          <p>
            <strong>CodexManager Local · {run.resolvedModelId ?? run.requestedModelId}</strong>
          </p>
          <p>
            {isChinese ? "状态" : "Status"}: {run.status} · {isChinese ? "调用" : "calls"}{" "}
            {run.providerCallCount}/{run.authorization?.maxCalls ?? 1} ·{" "}
            {isChinese ? "最多镜头" : "max shots"} {run.maxShotCount ?? 3}
          </p>
          {run.maxCostUsd !== null && (
            <p>
              {isChinese ? "费用上限" : "Cost ceiling"}: US${run.maxCostUsd.toFixed(2)} ·{" "}
              {isChinese ? "失败不重试" : "no retry on failure"}
            </p>
          )}
          {(run.status === "QUEUED" || run.status === "RUNNING") && (
            <p>
              {isChinese
                ? "常驻 Worker 正在生成提案，请稍候。"
                : "The resident Worker is generating the proposal."}
            </p>
          )}
          {(run.status === "FAILED" || run.status === "AMBIGUOUS") && (
            <p className="formError">
              {run.safeResultCode} ·{" "}
              {isChinese
                ? "不会自动重试，请重新明确授权。"
                : "No automatic retry; a new explicit authorization is required."}
            </p>
          )}
        </article>
      ))}
      {currentProposals.map((proposal) => (
        <article className="executionShot" key={proposal.id}>
          <h3>{isChinese ? "AI 提案" : "AI proposal"}</h3>
          <p>{proposal.narrativeSummary}</p>
          <ol>
            {proposal.normalizedProposalJson.shots.map((shot) => (
              <li key={shot.shotKey}>
                <strong>{shot.title}</strong> — {shot.action}
              </li>
            ))}
          </ol>
          {proposal.decisions.length === 0 ? (
            <div className="storyboardActions">
              <button
                className="primaryButton"
                disabled={busy}
                onClick={() => void decide(proposal, "ADOPT")}
              >
                {isChinese ? "采用为新版本" : "Adopt as new version"}
              </button>
              <button
                className="dangerTextButton"
                disabled={busy}
                onClick={() => void decide(proposal, "REJECT")}
              >
                {isChinese ? "拒绝提案" : "Reject proposal"}
              </button>
            </div>
          ) : (
            <p>{isChinese ? "负责人已处理此提案。" : "The Owner has decided this proposal."}</p>
          )}
        </article>
      ))}
      {historicalCount > 0 && (
        <details>
          <summary>
            {isChinese
              ? `历史 Fake 记录（只读 · ${historicalCount}）`
              : `Historical Fake records (read-only · ${historicalCount})`}
          </summary>
          <p>
            {isChinese
              ? "这些记录仅作为审计证据，不能采用、拒绝或再次运行。"
              : "These records remain audit evidence and cannot be adopted, rejected, or rerun."}
          </p>
        </details>
      )}
    </section>
  );
}
