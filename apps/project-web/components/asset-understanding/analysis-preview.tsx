"use client";

export function AnalysisPreview({
  preview,
  acknowledged,
  onAcknowledged,
  onConfirm,
}: {
  preview: {
    assets: Array<{ slot: string; displayName: string }>;
    maxCalls: 1;
    externalCalls: 0;
    expiresAt: string;
    provider: { providerId: string; modelId: string };
  };
  acknowledged: boolean;
  onAcknowledged: (next: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="candidateResult">
      <p>
        <strong>Preview only:</strong> {preview.externalCalls} calls made; confirmation allows at
        most {preview.maxCalls} attempt.
      </p>
      <p>
        Provider: {preview.provider.providerId} / {preview.provider.modelId}; expires{" "}
        {new Date(preview.expiresAt).toLocaleString()}.
      </p>
      <ul>
        {preview.assets.map((asset) => (
          <li key={asset.slot}>{asset.displayName}</li>
        ))}
      </ul>
      <label className="acknowledge">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledged(event.target.checked)}
        />{" "}
        I understand this confirmation authorizes one provider attempt for these selected images.
      </label>
      <button className="primaryButton" type="button" disabled={!acknowledged} onClick={onConfirm}>
        Queue one controlled attempt
      </button>
    </div>
  );
}
