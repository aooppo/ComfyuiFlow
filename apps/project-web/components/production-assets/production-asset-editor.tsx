"use client";

import { useState } from "react";

const types = ["CHARACTER", "OUTFIT", "PROP", "SCENE", "VOICE", "LORA", "OTHER"] as const;

export function ProductionAssetEditor({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [type, setType] = useState<(typeof types)[number]>("CHARACTER");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/production-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Asset could not be created");
      setName("");
      setDescription("");
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Asset could not be created");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="phase2Form"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <label>
        Semantic type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as (typeof types)[number])}
        >
          {types.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {error && <p className="formError">{error}</p>}
      <button className="primaryButton" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create draft semantic asset"}
      </button>
    </form>
  );
}
