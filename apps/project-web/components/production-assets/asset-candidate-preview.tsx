"use client";

import { useEffect, useState } from "react";

interface SemanticAsset {
  id: string;
  name: string;
  type: string;
}
interface CandidateResult {
  eligible: Array<{ projectAssetId: string; displayName: string; reasons: string[] }>;
  rejected: Array<{ projectAssetId?: string; reasons: string[] }>;
  gaps: string[];
  resultHash: string;
  formalSelectionCreated: false;
}

export function AssetCandidatePreview({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<SemanticAsset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [usage, setUsage] = useState("IDENTITY");
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/projects/${projectId}/production-assets?limit=100`);
      const body = (await response.json()) as { assets?: SemanticAsset[] };
      setAssets(body.assets ?? []);
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
      const body = (await response.json()) as CandidateResult & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Candidate preview failed");
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
          <p>
            <strong>{result.eligible.length}</strong> eligible ·{" "}
            <strong>{result.rejected.length}</strong> excluded ·{" "}
            <code>{result.resultHash.slice(0, 12)}</code>
          </p>
          {result.eligible.map((item) => (
            <div key={item.projectAssetId}>Eligible: {item.displayName}</div>
          ))}
          {result.rejected.map((item, index) => (
            <div key={`${item.projectAssetId}-${index}`}>Excluded: {item.reasons.join(", ")}</div>
          ))}
          {result.gaps.map((gap) => (
            <div key={gap}>Gap: {gap}</div>
          ))}
          <small>No formal selection was created.</small>
        </div>
      )}
    </section>
  );
}
