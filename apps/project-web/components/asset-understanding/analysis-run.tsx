"use client";

import { useLanguage } from "../i18n/language-provider";

export function AnalysisRun({
  run,
}: {
  run: { id: string; status: string; externalAttempts: number; resultCode: string | null };
}) {
  const { locale, t } = useLanguage();
  return (
    <div className="candidateResult">
      <p>
        {locale === "zh-CN" ? "任务" : "Run"} <code>{run.id}</code>
      </p>
      <p>
        {locale === "zh-CN" ? "状态：" : "Status:"} <strong>{t(run.status)}</strong>
        {locale === "zh-CN" ? "；已记录尝试：" : "; recorded attempts: "}
        {run.externalAttempts}
      </p>
      {run.status === "QUEUED" && run.externalAttempts === 0 && (
        <p>
          {locale === "zh-CN"
            ? "任务已进入队列，但尚未被 Worker 领取。"
            : "The task is queued but has not been claimed by a Worker."}
        </p>
      )}
      {run.resultCode && (
        <p>
          {locale === "zh-CN" ? "安全结果：" : "Safe result:"} {run.resultCode}
        </p>
      )}
      <small>The Worker is single-concurrency and never retries automatically.</small>
    </div>
  );
}
