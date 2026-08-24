"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductionAssetEditor } from "./production-asset-editor";

interface ProductionAssetView {
  id: string;
  type: string;
  name: string;
  status: string;
  currentVersionId: string | null;
  versions?: Array<{ id: string; versionNumber: number; status: string; displayName: string }>;
}

export function ProductionAssetLibrary({
  projectId,
  readOnly,
}: {
  projectId: string;
  readOnly: boolean;
}) {
  const [assets, setAssets] = useState<ProductionAssetView[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/production-assets`);
      const body = (await response.json()) as {
        assets?: ProductionAssetView[];
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(body.error?.message ?? "Semantic assets could not be loaded");
      setAssets(body.assets ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Semantic assets could not be loaded");
    }
  }, [projectId, revision]);
  useEffect(() => {
    void load();
  }, [load]);

  async function publish(versionId: string) {
    const response = await fetch(`/api/production-asset-versions/${versionId}/publish`, {
      method: "POST",
    });
    if (response.ok) setRevision((value) => value + 1);
  }
  async function createVersion(assetId: string) {
    const response = await fetch(`/api/production-assets/${assetId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.ok) setRevision((value) => value + 1);
  }

  return (
    <section className="phase2Section">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Semantic catalog</p>
          <h2>Characters, outfits, props and more</h2>
          <p>
            File assets are evidence; semantic assets are reusable creative identities and version
            history.
          </p>
        </div>
      </div>
      {!readOnly && (
        <ProductionAssetEditor
          projectId={projectId}
          onCreated={() => setRevision((value) => value + 1)}
        />
      )}
      {error && <p className="formError">{error}</p>}
      <div className="semanticGrid">
        {assets.map((asset) => (
          <article className="semanticCard" key={asset.id}>
            <p className="assetRole">{asset.type}</p>
            <h3>{asset.name}</h3>
            <p>{asset.currentVersionId ? "Active version available" : "Draft only"}</p>
            <div className="versionList">
              {asset.versions?.map((version) => (
                <div key={version.id}>
                  <span>
                    v{version.versionNumber} · {version.status}
                  </span>
                  {version.status === "DRAFT" && !readOnly && (
                    <button className="panelButton" onClick={() => void publish(version.id)}>
                      Publish
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <button className="panelButton" onClick={() => void createVersion(asset.id)}>
                New draft version
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
