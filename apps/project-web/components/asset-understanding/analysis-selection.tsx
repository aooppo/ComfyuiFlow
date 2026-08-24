"use client";

import { useEffect, useState } from "react";
import { AnalysisPreview } from "./analysis-preview";
import { AnalysisRun } from "./analysis-run";

interface Asset {
  id: string;
  displayName: string;
  mediaType: string;
  status: string;
}
interface Preview {
  manifestHash: string;
  assets: Array<{ slot: string; assetId: string; displayName: string }>;
  maxCalls: 1;
  externalCalls: 0;
  expiresAt: string;
  provider: { providerId: string; modelId: string };
}
interface Run {
  id: string;
  status: string;
  externalAttempts: number;
  resultCode: string | null;
}

export function AnalysisSelection({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const response = await fetch(
        `/api/projects/${projectId}/assets?status=READY&mediaType=IMAGE&limit=100`,
      );
      const body = (await response.json()) as { assets?: Asset[] };
      setAssets(body.assets ?? []);
    })();
  }, [projectId]);
  function toggle(id: string) {
    setSelected((value) =>
      value.includes(id)
        ? value.filter((item) => item !== id)
        : value.length < 9
          ? [...value, id]
          : value,
    );
  }
  async function createPreview() {
    setError("");
    setRun(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/asset-analyses/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds: selected,
          providerId: "fake",
          modelId: "asset-understanding-fake-v1",
        }),
      });
      const body = (await response.json()) as Preview & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Preview could not be created");
      setPreview(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Preview could not be created");
    }
  }
  async function confirm() {
    if (!preview || !acknowledged) return;
    setError("");
    try {
      const idempotencyKey = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const response = await fetch(`/api/projects/${projectId}/asset-analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          manifestHash: preview.manifestHash,
          acknowledgeExternalImageUpload: true,
          idempotencyKey,
        }),
      });
      const body = (await response.json()) as Run & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Analysis could not be queued");
      setRun(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analysis could not be queued");
    }
  }
  return (
    <section className="phase2Section">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Controlled understanding</p>
          <h2>Reviewable image observations</h2>
          <p>
            Preview makes zero external calls. Confirm consumes a single-use grant; Fake is selected
            by default and real image upload is disabled unless the server’s LIVE gate is explicitly
            enabled.
          </p>
        </div>
      </div>
      <div className="assetChecklist">
        {assets.map((asset) => (
          <label key={asset.id}>
            <input
              type="checkbox"
              checked={selected.includes(asset.id)}
              onChange={() => toggle(asset.id)}
            />{" "}
            {asset.displayName}
          </label>
        ))}
      </div>
      <button
        className="primaryButton"
        type="button"
        disabled={!selected.length}
        onClick={() => void createPreview()}
      >
        Preview {selected.length || ""} image{selected.length === 1 ? "" : "s"}
      </button>
      {error && <p className="formError">{error}</p>}
      {preview && (
        <AnalysisPreview
          preview={preview}
          acknowledged={acknowledged}
          onAcknowledged={setAcknowledged}
          onConfirm={confirm}
        />
      )}
      {run && <AnalysisRun run={run} />}
    </section>
  );
}
