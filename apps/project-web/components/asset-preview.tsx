"use client";

import type { AssetView } from "./types";
import { roleLabel } from "./types";
import { UnderstandingReview } from "./asset-understanding/understanding-review";

function bytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetPreview({ asset, onClose }: { asset: AssetView; onClose: () => void }) {
  const source = `/api/assets/${asset.id}/content`;
  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="previewDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <button className="closeButton" onClick={onClose} aria-label="Close preview">
          ×
        </button>
        <div className="previewMedia">
          {asset.mediaType === "IMAGE" ? (
            <img src={source} alt={asset.displayName} />
          ) : asset.mediaType === "VIDEO" ? (
            <video src={source} controls />
          ) : (
            <div className="audioStage">
              <span>♫</span>
              <audio src={source} controls />
            </div>
          )}
        </div>
        <div className="previewFacts">
          <p className="eyebrow">
            {asset.mediaType.toLowerCase()} · {roleLabel(asset.role)}
          </p>
          <h2 id="preview-title">{asset.displayName}</h2>
          {asset.notes && <p>{asset.notes}</p>}
          <dl>
            <div>
              <dt>Original</dt>
              <dd>{asset.originalFilename}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{bytes(asset.byteSize)}</dd>
            </div>
            {asset.width && asset.height && (
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {asset.width} × {asset.height}
                </dd>
              </div>
            )}
            {asset.durationMs !== null && (
              <div>
                <dt>Duration</dt>
                <dd>{(asset.durationMs / 1000).toFixed(2)} seconds</dd>
              </div>
            )}
            <div>
              <dt>Integrity</dt>
              <dd className="hash">{asset.sha256}</dd>
            </div>
            <div>
              <dt>Imported</dt>
              <dd>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(asset.createdAt))}
              </dd>
            </div>
          </dl>
          {asset.inspectionWarning && (
            <p className="warning">
              Some media details were unavailable, but the original file is preserved.
            </p>
          )}
          <UnderstandingReview assetId={asset.id} />
        </div>
      </section>
    </div>
  );
}
