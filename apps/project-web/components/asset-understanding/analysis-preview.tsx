"use client";

import { useLanguage } from "../i18n/language-provider";

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
  const { locale } = useLanguage();
  return (
    <div className="candidateResult">
      <p>
        <strong>{locale === "zh-CN" ? "仅预览：" : "Preview only:"}</strong>{" "}
        {locale === "zh-CN"
          ? `已产生 ${preview.externalCalls} 次外部调用；确认后最多执行 ${preview.maxCalls} 次尝试。`
          : `${preview.externalCalls} calls made; confirmation allows at most ${preview.maxCalls} attempt.`}
      </p>
      <p>
        {locale === "zh-CN" ? "提供方：" : "Provider:"} {preview.provider.providerId} /{" "}
        {preview.provider.modelId}；{locale === "zh-CN" ? "授权过期时间：" : "expires "}
        {new Date(preview.expiresAt).toLocaleString()}。
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
