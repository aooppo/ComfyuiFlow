"use client";

export function AnalysisRun({
  run,
}: {
  run: { id: string; status: string; externalAttempts: number; resultCode: string | null };
}) {
  return (
    <div className="candidateResult">
      <p>
        Run <code>{run.id}</code>
      </p>
      <p>
        Status: <strong>{run.status}</strong>; recorded attempts: {run.externalAttempts}
      </p>
      {run.resultCode && <p>Safe result: {run.resultCode}</p>}
      <small>The Worker is single-concurrency and never retries automatically.</small>
    </div>
  );
}
