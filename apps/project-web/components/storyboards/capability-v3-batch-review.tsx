"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ArtifactView {
  id: string;
  contentUrl: string;
  technicalStatus: string;
  technicalResultCode: string | null;
  aiQaStatus: string;
  ffprobe: {
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    codec: string;
  } | null;
  reviewFrames: Array<{ id: string; role: string; contentUrl: string }>;
  decisions: Array<{ id: string; decision: string; createdAt: string }>;
}

interface CapabilityBatchView {
  id: string;
  state: string;
  safeResultCode: string;
  maximumCalls: number;
  authorization: { consumedCalls: number; consumedAiQaCalls?: number; expiresAt: string };
  targets: Array<{
    id: string;
    ordinal: number;
    state: string;
    safeResultCode: string;
    providerCallCount: number;
    attempts: Array<{
      id: string;
      attemptNumber: number;
      state: string;
      safeResultCode: string | null;
      materializedGraphSha256: string;
      providerCallCount: number;
      artifact: { id: string } | null;
    }>;
  }>;
}

interface RetryPreview {
  id: string;
  previewDigest: string;
  maximumCostMicros: number | null;
  expectedCalls: 1;
  maximumCalls: 1;
}

export function CapabilityV3BatchReview({
  batchId,
  storyboardVersionId,
  isChinese,
}: {
  batchId: string;
  storyboardVersionId: string;
  isChinese: boolean;
}) {
  const [batch, setBatch] = useState<CapabilityBatchView | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, ArtifactView>>({});
  const [retry, setRetry] = useState<Record<string, RetryPreview>>({});
  const [retryConfirmed, setRetryConfirmed] = useState<Record<string, boolean>>({});
  const [assemblyId, setAssemblyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeBatchId, setActiveBatchId] = useState(batchId);
  const terminalRefresh = useRef<string | null>(null);
  const decisionKeys = useRef(new Map<string, string>());

  async function refresh() {
    const response = await fetch(`/api/generation-batches/${activeBatchId}`, { cache: "no-store" });
    if (!response.ok) return;
    const value = (await response.json()) as CapabilityBatchView;
    setBatch(value);
    const ids = value.targets.flatMap((target) =>
      target.attempts.flatMap((attempt) => (attempt.artifact ? [attempt.artifact.id] : [])),
    );
    const loaded = await Promise.all(
      ids.map(async (id) => {
        const artifactResponse = await fetch(`/api/capability-v3-artifacts/${id}`, {
          cache: "no-store",
        });
        return [
          id,
          artifactResponse.ok ? ((await artifactResponse.json()) as ArtifactView) : null,
        ] as const;
      }),
    );
    setArtifacts(
      Object.fromEntries(loaded.filter((entry) => entry[1] !== null)) as Record<
        string,
        ArtifactView
      >,
    );
  }

  useEffect(() => {
    void refresh();
    const active = new Set(["QUEUED", "RUNNING", "SUBMITTED", "RECONCILING"]);
    if (!batch || active.has(batch.state)) {
      const timer = window.setInterval(() => void refresh(), 3_000);
      return () => window.clearInterval(timer);
    }
    if (terminalRefresh.current !== activeBatchId) {
      terminalRefresh.current = activeBatchId;
      void refresh();
    }
  }, [activeBatchId, batch?.state]);

  const accepted = useMemo(
    () =>
      batch?.targets.every((target) => {
        const latest = target.attempts.at(-1)?.artifact;
        const artifact = latest ? artifacts[latest.id] : null;
        return artifact?.decisions.some((item) =>
          ["PASS", "RISK_ACCEPTED"].includes(item.decision),
        );
      }) ?? false,
    [batch, artifacts],
  );

  async function decide(artifactId: string, decision: "PASS" | "FAIL" | "RISK_ACCEPTED") {
    setError("");
    const keyName = `${artifactId}:${decision}`;
    const idempotencyKey = decisionKeys.current.get(keyName) ?? crypto.randomUUID();
    decisionKeys.current.set(keyName, idempotencyKey);
    const response = await fetch(`/api/capability-v3-artifacts/${artifactId}/owner-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "owner-decision-create-request-v3",
        decision,
        reasonCode: decision === "FAIL" ? "OWNER_REJECTED" : undefined,
        actorRef: "owner.local",
        idempotencyKey,
      }),
    });
    if (!response.ok) {
      setError(isChinese ? "负责人结论保存失败。" : "Owner decision could not be saved.");
      return;
    }
    if (decision === "FAIL") {
      const previewResponse = await fetch(
        `/api/capability-v3-artifacts/${artifactId}/retry-preview`,
        { method: "POST" },
      );
      if (previewResponse.ok) {
        const preview = (await previewResponse.json()) as RetryPreview;
        setRetry((current) => ({
          ...current,
          [artifactId]: preview,
        }));
      }
    }
    await refresh();
  }

  async function authorizeRetry(artifactId: string) {
    const preview = retry[artifactId];
    if (!preview || !retryConfirmed[artifactId]) return;
    const response = await fetch(`/api/capability-v3-retry-previews/${preview.id}/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "generation-retry-authorize-request-v3",
        previewDigest: preview.previewDigest,
        idempotencyKey: crypto.randomUUID(),
        expiresInSeconds: 300,
        confirmed: true,
      }),
    });
    if (!response.ok) {
      setError(isChinese ? "新重试授权未创建。" : "A new retry authorization was not created.");
      return;
    }
    const authorized = (await response.json()) as { batchId?: string };
    if (authorized.batchId) {
      terminalRefresh.current = null;
      setBatch(null);
      setArtifacts({});
      setActiveBatchId(authorized.batchId);
    }
    setRetry((current) => {
      const next = { ...current };
      delete next[artifactId];
      return next;
    });
  }

  async function assemble() {
    const response = await fetch(
      `/api/storyboard-versions/${storyboardVersionId}/capability-v3-assemblies`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), confirmed: true }),
      },
    );
    if (!response.ok) {
      setError(isChinese ? "合片失败或尚未满足负责人确认。" : "Assembly is not ready.");
      return;
    }
    const value = (await response.json()) as { id: string };
    setAssemblyId(value.id);
  }

  if (!batch) return <p>{isChinese ? "正在读取生成进度…" : "Loading generation progress…"}</p>;
  return (
    <section
      className="noticePanel"
      aria-label={isChinese ? "动态生成与审片" : "Dynamic generation review"}
    >
      <h3>{isChinese ? "动态生成与审片" : "Dynamic generation and review"}</h3>
      <p>
        {batch.state} · {isChinese ? "已消费视频调用" : "Consumed video calls"}{" "}
        {batch.authorization.consumedCalls}/{batch.maximumCalls}
      </p>
      {error && <p className="formError">{error}</p>}
      {batch.targets.map((target) => (
        <article className="executionShot" key={target.id}>
          <h3>
            Shot {target.ordinal} · {target.state}
          </h3>
          <p>{target.safeResultCode}</p>
          {target.attempts.map((attempt) => {
            const artifact = attempt.artifact ? artifacts[attempt.artifact.id] : null;
            return (
              <div key={attempt.id}>
                <p>
                  Attempt {attempt.attemptNumber} · {attempt.state} ·{" "}
                  {isChinese ? "视频调用" : "video calls"} {attempt.providerCallCount}
                </p>
                <details>
                  <summary>{isChinese ? "冻结执行证据" : "Frozen execution evidence"}</summary>
                  <p data-i18n-ignore="true">Graph SHA-256 · {attempt.materializedGraphSha256}</p>
                </details>
                {artifact && (
                  <div>
                    <video controls preload="metadata" src={artifact.contentUrl} />
                    <p>
                      {artifact.technicalStatus} · {artifact.technicalResultCode} · AI QA:{" "}
                      {artifact.aiQaStatus}
                    </p>
                    {artifact.aiQaStatus === "AI_QA_UNAVAILABLE" && (
                      <p>
                        {isChinese
                          ? "AI 检查不可用不阻塞负责人审片。"
                          : "AI QA unavailable does not block Owner review."}
                      </p>
                    )}
                    {artifact.ffprobe && (
                      <p>
                        {artifact.ffprobe.width}×{artifact.ffprobe.height} ·{" "}
                        {artifact.ffprobe.fps.toFixed(2)} fps ·{" "}
                        {artifact.ffprobe.durationSeconds.toFixed(2)}s · {artifact.ffprobe.codec}
                      </p>
                    )}
                    <div className="reviewFrameGrid">
                      {artifact.reviewFrames.map((frame) => (
                        <figure key={frame.id}>
                          <img src={frame.contentUrl} alt={`${frame.role} review frame`} />
                          <figcaption>{frame.role}</figcaption>
                        </figure>
                      ))}
                    </div>
                    <p>
                      {artifact.decisions.map((item) => item.decision).join(" · ") ||
                        (isChinese ? "等待负责人结论" : "Waiting for Owner decision")}
                    </p>
                    <div className="buttonRow">
                      <button
                        className="panelButton"
                        onClick={() => void decide(artifact.id, "PASS")}
                      >
                        PASS
                      </button>
                      <button
                        className="panelButton"
                        onClick={() => void decide(artifact.id, "FAIL")}
                      >
                        FAIL
                      </button>
                      <button
                        className="panelButton"
                        onClick={() => void decide(artifact.id, "RISK_ACCEPTED")}
                      >
                        RISK_ACCEPTED
                      </button>
                    </div>
                    {retry[artifact.id] && (
                      <div className="formError">
                        <strong>
                          {isChinese ? "一次重试付费授权" : "One-shot paid retry authorization"}
                        </strong>
                        <p>
                          1 {isChinese ? "次视频调用" : "video call"} ·{" "}
                          {isChinese ? "最高费用" : "maximum cost"}{" "}
                          {retry[artifact.id]?.maximumCostMicros === null
                            ? "N/A"
                            : `$${((retry[artifact.id]!.maximumCostMicros ?? 0) / 1_000_000).toFixed(2)}`}{" "}
                          · {isChinese ? "不自动重试" : "no automatic retry"}
                        </p>
                        <label>
                          <input
                            type="checkbox"
                            checked={retryConfirmed[artifact.id] ?? false}
                            onChange={(event) =>
                              setRetryConfirmed((current) => ({
                                ...current,
                                [artifact.id]: event.target.checked,
                              }))
                            }
                          />
                          {isChinese
                            ? "我确认创建一份新的、仅一次调用的重试授权"
                            : "I confirm a new one-call retry authorization"}
                        </label>
                        <button
                          className="primaryButton"
                          disabled={!retryConfirmed[artifact.id]}
                          onClick={() => void authorizeRetry(artifact.id)}
                        >
                          {isChinese ? "创建新重试授权" : "Create new retry authorization"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </article>
      ))}
      <button className="primaryButton" disabled={!accepted} onClick={() => void assemble()}>
        {isChinese ? "按负责人已接受版本合片" : "Assemble Owner-accepted versions"}
      </button>
      {assemblyId && (
        <p>
          <a href={`/api/capability-v3-assemblies/${assemblyId}/content?download=1`}>
            {isChinese ? "下载成片" : "Download final video"}
          </a>
        </p>
      )}
    </section>
  );
}
