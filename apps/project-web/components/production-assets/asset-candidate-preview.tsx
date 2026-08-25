"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/language-provider";

interface SemanticAsset {
  id: string;
  name: string;
  type: string;
}
interface SourceAsset {
  id: string;
  displayName: string;
}
interface CandidateResult {
  policyVersion: "deterministic-assets-v1";
  inputHash: string;
  eligible: Array<{ projectAssetId: string; matchedRules: string[] }>;
  rejected: Array<{ projectAssetId: string; reasonCodes: string[] }>;
  gaps: string[];
  formalSelectionCreated: false;
}

function isCandidateResult(value: unknown): value is CandidateResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CandidateResult>;
  return (
    candidate.policyVersion === "deterministic-assets-v1" &&
    typeof candidate.inputHash === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.inputHash) &&
    Array.isArray(candidate.eligible) &&
    Array.isArray(candidate.rejected) &&
    Array.isArray(candidate.gaps) &&
    candidate.formalSelectionCreated === false
  );
}

export function AssetCandidatePreview({ projectId }: { projectId: string }) {
  const { locale, t } = useLanguage();
  const [assets, setAssets] = useState<SemanticAsset[]>([]);
  const [sourceAssetNames, setSourceAssetNames] = useState<Record<string, string>>({});
  const [assetId, setAssetId] = useState("");
  const [usage, setUsage] = useState("IDENTITY");
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [error, setError] = useState("");
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  useEffect(() => {
    void (async () => {
      const [semanticResponse, sourceResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/production-assets?limit=100`),
        fetch(`/api/projects/${projectId}/assets?limit=100`),
      ]);
      const semanticBody = (await semanticResponse.json()) as { assets?: SemanticAsset[] };
      const sourceBody = (await sourceResponse.json()) as { assets?: SourceAsset[] };
      setAssets(semanticBody.assets ?? []);
      setSourceAssetNames(
        Object.fromEntries((sourceBody.assets ?? []).map((asset) => [asset.id, asset.displayName])),
      );
    })();
  }, [projectId]);

  async function preview() {
    if (!assetId) return;
    setError("");
    setResult(null);
    try {
      const semantic = assets.find((asset) => asset.id === assetId)!;
      const response = await fetch(`/api/projects/${projectId}/asset-candidates/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractVersion: "asset-candidate-v1",
          projectId,
          requirementId: `manual-${assetId}`,
          assetType: semantic.type,
          productionAssetId: assetId,
          referenceUsages: [usage],
          viewpoints: [],
          shotScales: [],
          mediaCapability: { mediaType: "IMAGE", acceptedMimeTypes: [] },
          policy: { allowUnspecifiedViewpoint: true, allowUnspecifiedShotScale: true },
        }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        const failure = body as { error?: { message?: string } };
        throw new Error(failure.error?.message ?? "Candidate preview failed");
      }
      if (!isCandidateResult(body)) {
        throw new Error("Candidate preview returned an incomplete response");
      }
      setResult(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Candidate preview failed");
    }
  }
  return (
    <section className="phase2Section candidatePreview">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Storyboard preparation</p>
          <h2>Deterministic asset candidates</h2>
          <p>
            Checks the required identity, version, approval, reference usage and file readiness. It
            never selects or creates a Shot.
          </p>
        </div>
      </div>
      <div className="phase2Form inlineForm">
        <label>
          Creative identity
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">Choose a semantic asset</option>
            {assets.map((asset) => (
              <option value={asset.id} key={asset.id}>
                {asset.type} · {asset.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reference usage
          <select value={usage} onChange={(event) => setUsage(event.target.value)}>
            <option value="IDENTITY">Identity</option>
            <option value="FULL_BODY">Full body</option>
            <option value="OUTFIT_DETAIL">Outfit detail</option>
            <option value="PROP_DETAIL">Prop detail</option>
            <option value="SCENE_STYLE">Scene style</option>
          </select>
        </label>
        <button
          className="primaryButton"
          type="button"
          disabled={!assetId}
          onClick={() => void preview()}
        >
          Preview candidates
        </button>
      </div>
      {error && <p className="formError">{error}</p>}
      {result && (
        <div className="candidateResult">
          <div
            className={
              result.eligible.length === 0 ? "candidateConclusion blocked" : "candidateConclusion"
            }
          >
            <h3>
              {result.eligible.length === 0
                ? locale === "zh-CN"
                  ? "当前没有可用的候选素材"
                  : "No usable candidate is available"
                : locale === "zh-CN"
                  ? `已找到 ${result.eligible.length} 个可用候选素材`
                  : `${result.eligible.length} usable candidate${result.eligible.length === 1 ? "" : "s"} found`}
            </h3>
            {result.eligible.length === 0 ? (
              <>
                <p>
                  {locale === "zh-CN"
                    ? `${selectedAsset?.name ?? "所选素材"} 的当前活动版本没有同时满足“文件可用、绑定已批准、用途为「${t(usage)}」”的文件。`
                    : `${selectedAsset?.name ?? "The selected asset"} has no file on its active version that is ready, approved, and bound for “${t(usage)}”.`}
                </p>
                <p>
                  {locale === "zh-CN"
                    ? `请在上方「${selectedAsset?.name ?? "所选素材"}」卡片中编辑或新建草稿，绑定一个可用文件并将用途设为「${t(usage)}」，发布草稿后再重新预览。`
                    : `Edit or create a draft in the “${selectedAsset?.name ?? "selected asset"}” card above, bind a ready file for “${t(usage)}”, publish the draft, then preview again.`}
                </p>
                <a href="#semantic-catalog">
                  {locale === "zh-CN" ? "前往语义素材库处理" : "Go to the Semantic catalog"}
                </a>
              </>
            ) : (
              result.eligible.map((item) => (
                <div key={item.projectAssetId}>
                  <span>{locale === "zh-CN" ? "可用：" : "Eligible:"}</span>{" "}
                  {sourceAssetNames[item.projectAssetId] ?? item.projectAssetId}
                </div>
              ))
            )}
          </div>
          <details className="candidateDiagnostics">
            <summary>
              {locale === "zh-CN"
                ? `查看技术排除详情（${result.rejected.length}）`
                : `View technical exclusion details (${result.rejected.length})`}
            </summary>
            <p>
              {t("Input hash")} <code>{result.inputHash.slice(0, 12)}</code>
            </p>
            {result.rejected.map((item, index) => (
              <div key={`${item.projectAssetId}-${index}`}>
                <span>{locale === "zh-CN" ? "已排除：" : "Excluded:"}</span>{" "}
                {sourceAssetNames[item.projectAssetId] ?? item.projectAssetId} ·{" "}
                {item.reasonCodes.map((reason, reasonIndex) => (
                  <span key={reason}>
                    {reasonIndex > 0 ? ", " : ""}
                    <span>{t(reason)}</span>
                  </span>
                ))}
              </div>
            ))}
            {result.gaps.map((gap) => (
              <div key={gap}>
                <span>{locale === "zh-CN" ? "缺口：" : "Gap:"}</span> <span>{t(gap)}</span>
              </div>
            ))}
          </details>
          <small>No formal selection was created.</small>
        </div>
      )}
    </section>
  );
}
