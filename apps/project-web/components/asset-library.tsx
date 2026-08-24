"use client";

import { useCallback, useEffect, useState } from "react";
import { AssetPreview } from "./asset-preview";
import type { AssetView } from "./types";
import { roleLabel, roleOptions } from "./types";

export function AssetLibrary({
  projectId,
  revision,
  readOnly,
}: {
  projectId: string;
  revision: number;
  readOnly: boolean;
}) {
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [mediaType, setMediaType] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AssetView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (mediaType) query.set("mediaType", mediaType);
      if (role) query.set("role", role);
      const response = await fetch(`/api/projects/${projectId}/assets?${query}`);
      const body = (await response.json()) as { assets?: AssetView[]; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Assets could not be loaded");
      setAssets(body.assets ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Assets could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [mediaType, projectId, revision, role]);

  useEffect(() => void load(), [load]);

  async function edit(asset: AssetView) {
    const displayName = window.prompt("Asset name", asset.displayName)?.trim();
    if (!displayName) return;
    const notes = window.prompt("Notes", asset.notes ?? "");
    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, notes }),
    });
    if (response.ok) void load();
  }

  async function remove(asset: AssetView) {
    if (
      !window.confirm(
        `Remove “${asset.displayName}” from this project? The verified original and history will be kept.`,
      )
    )
      return;
    const response = await fetch(`/api/assets/${asset.id}/remove`, { method: "POST" });
    if (response.ok) {
      setSelected(null);
      void load();
    }
  }

  return (
    <section className="assetSection" aria-live="polite">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Source library</p>
          <h2>Project assets</h2>
          <p>
            {loading
              ? "Loading…"
              : `${assets.length} matching ${assets.length === 1 ? "asset" : "assets"}`}
          </p>
        </div>
        <div className="filterRow">
          <label>
            Media
            <select value={mediaType} onChange={(event) => setMediaType(event.target.value)}>
              <option value="">All media</option>
              <option value="IMAGE">Images</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
            </select>
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              {roleOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && (
        <div className="errorPanel">
          <p>{error}</p>
          <button onClick={() => void load()}>Try again</button>
        </div>
      )}
      {!loading && !error && assets.length === 0 ? (
        <div className="emptyPanel">
          <span className="emptyGlyph">◎</span>
          <h3>No matching assets</h3>
          <p>
            {mediaType || role
              ? "Try a different filter."
              : "Add original images, video, or audio above."}
          </p>
        </div>
      ) : (
        <div className="assetGrid">
          {assets.map((asset) => (
            <article className="assetCard" key={asset.id}>
              <button
                className="assetThumb"
                onClick={() => setSelected(asset)}
                aria-label={`Preview ${asset.displayName}`}
              >
                {asset.mediaType === "IMAGE" ? (
                  <img src={`/api/assets/${asset.id}/content`} alt="" loading="lazy" />
                ) : (
                  <span className="mediaGlyph">{asset.mediaType === "VIDEO" ? "▶" : "♫"}</span>
                )}
                <span className="mediaChip">{asset.mediaType.toLowerCase()}</span>
              </button>
              <div className="assetBody">
                <p className="assetRole">{roleLabel(asset.role)}</p>
                <h3>{asset.displayName}</h3>
                <p>{asset.originalFilename}</p>
                <div className="cardActions">
                  <button onClick={() => setSelected(asset)}>Preview</button>
                  {!readOnly && (
                    <>
                      <button onClick={() => void edit(asset)}>Edit</button>
                      <button className="dangerText" onClick={() => void remove(asset)}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {selected && <AssetPreview asset={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
