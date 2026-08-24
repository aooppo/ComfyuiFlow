"use client";

import { useRef, useState } from "react";
import { roleOptions } from "./types";

interface ImportResult {
  filename: string;
  outcome: "IMPORTED" | "DUPLICATE" | "REJECTED" | "FAILED";
  code: string;
}

export function AssetImporter({
  projectId,
  onComplete,
}: {
  projectId: string;
  onComplete: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState("SCENE");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  function select(next: FileList | null) {
    setFiles(Array.from(next ?? []).slice(0, 20));
    setResults([]);
  }

  async function upload() {
    if (files.length === 0) return;
    setBusy(true);
    const form = new FormData();
    form.append("role", role);
    for (const file of files) form.append("files", file, file.name);
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/import`, {
        method: "POST",
        headers: { "X-Asset-Role": role },
        body: form,
      });
      const body = (await response.json()) as {
        results?: ImportResult[];
        error?: { message: string };
      };
      if (!response.ok) throw new Error(body.error?.message ?? "Import could not be completed");
      setResults(body.results ?? []);
      if (body.results?.some((result) => result.outcome === "IMPORTED")) onComplete();
      setFiles([]);
      if (input.current) input.current.value = "";
    } catch (reason) {
      setResults([
        {
          filename: "Import",
          outcome: "FAILED",
          code: reason instanceof Error ? reason.message : "Import failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="importPanel" aria-labelledby="import-title">
      <div className="importCopy">
        <p className="eyebrow">Source intake</p>
        <h2 id="import-title">Add original assets</h2>
        <p>
          Files stay local. Their bytes are preserved and verified before they enter your library.
        </p>
      </div>
      <div className="importControls">
        <label>
          Creative role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {roleOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`dropZone ${dragging ? "isDragging" : ""}`}
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            select(event.dataTransfer.files);
          }}
        >
          <span className="dropIcon">＋</span>
          <strong>
            {files.length
              ? `${files.length} file${files.length === 1 ? "" : "s"} ready`
              : "Choose or drop files"}
          </strong>
          <small>Images, MP4/WebM, and common audio · up to 20 at once</small>
        </button>
        <input
          ref={input}
          hidden
          multiple
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime,audio/*"
          onChange={(event) => select(event.target.files)}
        />
        <button
          className="primaryButton"
          type="button"
          disabled={busy || files.length === 0}
          onClick={() => void upload()}
        >
          {busy ? "Preserving originals…" : "Import selected files"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="importResults" aria-live="polite">
          {results.map((result, index) => (
            <div
              className={`resultLine ${result.outcome.toLowerCase()}`}
              key={`${result.filename}-${index}`}
            >
              <strong>{result.filename}</strong>
              <span>
                {result.outcome === "IMPORTED"
                  ? "Imported"
                  : result.outcome === "DUPLICATE"
                    ? "Already in this project"
                    : result.code.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
