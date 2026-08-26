"use client";

interface BatchConsumption {
  operation: string;
}

interface BatchJob {
  id: string;
  status: string;
  safeResultCode: string;
  generationBatchTarget: { ordinal: number };
}

interface WorkflowBatch {
  status: string;
  authorization?: {
    consumptions: BatchConsumption[];
    maximumGenerationCalls: number;
    maximumAiQaCalls: number;
  } | null;
  jobs: BatchJob[];
}

export function GenerationBatchPanel({
  batch,
  isChinese,
  onRefresh,
}: {
  batch: WorkflowBatch;
  isChinese: boolean;
  onRefresh: () => void;
}) {
  const generationCalls =
    batch.authorization?.consumptions.filter((item) => item.operation === "GENERATION_SUBMIT")
      .length ?? 0;
  const qaCalls =
    batch.authorization?.consumptions.filter((item) => item.operation === "AI_QA_REVIEW").length ??
    0;
  return (
    <section
      className="batchProgress workflowBatchProgress"
      aria-label={isChinese ? "跨 Shot 批次进度" : "Cross-Shot batch progress"}
    >
      <div className="batchHeading">
        <div>
          <p className="eyebrow">{isChinese ? "依赖感知执行" : "Dependency-aware execution"}</p>
          <h3>
            {isChinese ? "批次进度" : "Batch progress"} · {batch.status}
          </h3>
        </div>
        <button className="panelButton" onClick={onRefresh}>
          {isChinese ? "刷新" : "Refresh"}
        </button>
      </div>
      <p>
        {isChinese ? "视频调用" : "Video calls"}: {generationCalls}/
        {batch.authorization?.maximumGenerationCalls ?? 0} ·{" "}
        {isChinese ? "AI 质检调用" : "AI QA calls"}: {qaCalls}/
        {batch.authorization?.maximumAiQaCalls ?? 0}
      </p>
      {batch.jobs.map((job) => (
        <article className="executionShot" key={job.id}>
          <h3>
            Shot {job.generationBatchTarget.ordinal} · {job.status}
          </h3>
          <p>{job.safeResultCode}</p>
          <details>
            <summary>{isChinese ? "技术证据" : "Technical evidence"}</summary>
            <p>
              {isChinese
                ? "任务证据已保留；界面不显示端点、路径或供应商任务编号。"
                : "Task evidence is retained; endpoints, paths, and provider task IDs are hidden."}
            </p>
          </details>
        </article>
      ))}
    </section>
  );
}
