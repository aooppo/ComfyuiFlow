"use client";

import { useState } from "react";

interface OwnerReviewItem {
  generationSpecId: string;
  ordinal: number;
  technicalStatus: string;
  artifactId: string | null;
  aiQaStatus: string | null;
  continuationDecision: string | null;
  humanDecision: string | null;
}

interface OwnerReviewBatch {
  finalOwnerReview?: { ready: boolean; items: OwnerReviewItem[] } | null;
}

export function FinalOwnerReviewPanel({
  batch,
  isChinese,
  onDecision,
}: {
  batch: OwnerReviewBatch;
  isChinese: boolean;
  onDecision: (artifactId: string, decision: "PASS" | "FAIL", notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = batch.finalOwnerReview;
  if (!review) return null;
  return (
    <section
      className="assemblyWorkspace finalOwnerReview"
      aria-label={isChinese ? "最终负责人审核" : "Final owner review"}
    >
      <div>
        <p className="eyebrow">{isChinese ? "一次集中审核" : "One unified review"}</p>
        <h3>{isChinese ? "最终负责人审核" : "Final owner review"}</h3>
        <p>
          {isChinese
            ? "AI 质检只决定是否安全续跑，不会替你生成负责人 PASS。每个 Shot 仍需明确通过或不通过。"
            : "AI QA only controls safe continuation. It never fabricates Owner PASS; every Shot still needs an explicit decision."}
        </p>
      </div>
      {!review.ready && (
        <p className="noticePanel">
          {isChinese
            ? "仍在等待所有 Shot 的技术有效结果。"
            : "Waiting for technically valid results for every Shot."}
        </p>
      )}
      {review.items.map((item) => (
        <article className="executionShot" key={item.generationSpecId}>
          <h3>
            Shot {item.ordinal} · {item.technicalStatus}
          </h3>
          {item.artifactId && (
            <video
              controls
              preload="metadata"
              src={`/api/generated-artifacts/${item.artifactId}/content`}
            />
          )}
          <p>
            {isChinese ? "AI 建议" : "AI advisory"}:{" "}
            {item.aiQaStatus ?? (isChinese ? "未完成" : "pending")} ·{" "}
            {isChinese ? "续跑决定" : "Continuation"}:{" "}
            {item.continuationDecision ?? (isChinese ? "等待" : "pending")}
          </p>
          {item.humanDecision ? (
            <p className="successPanel">
              {isChinese ? "负责人决定" : "Owner decision"}: {item.humanDecision}
            </p>
          ) : item.artifactId ? (
            <div>
              <label>
                {isChinese
                  ? "不通过原因与下一次要求"
                  : "Failure reason and next-attempt requirements"}
                <textarea
                  rows={3}
                  value={notes[item.artifactId ?? ""] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.artifactId ?? ""]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="storyboardActions">
                <button
                  className="primaryButton"
                  onClick={() =>
                    void onDecision(
                      item.artifactId ?? "",
                      "PASS",
                      notes[item.artifactId ?? ""] ?? "",
                    )
                  }
                >
                  {isChinese ? "负责人通过" : "Owner PASS"}
                </button>
                <button
                  className="dangerTextButton"
                  disabled={!notes[item.artifactId ?? ""]?.trim()}
                  onClick={() =>
                    void onDecision(
                      item.artifactId ?? "",
                      "FAIL",
                      notes[item.artifactId ?? ""] ?? "",
                    )
                  }
                >
                  {isChinese ? "负责人不通过" : "Owner FAIL"}
                </button>
              </div>
            </div>
          ) : null}
          <details>
            <summary>{isChinese ? "技术证据" : "Technical evidence"}</summary>
            <p>
              {isChinese
                ? "技术状态、AI 建议和续跑决定均为独立证据；负责人决定不会被自动填写。"
                : "Technical status, AI advisory, and continuation are separate evidence. Owner decisions are never auto-filled."}
            </p>
          </details>
        </article>
      ))}
    </section>
  );
}
