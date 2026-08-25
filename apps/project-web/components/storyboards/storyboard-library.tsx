"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoryboardListItem } from "./types";

export function StoryboardLibrary({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<StoryboardListItem[]>([]);
  const [title, setTitle] = useState("");
  const [creativeBrief, setCreativeBrief] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/storyboards`);
    const body = (await response.json()) as {
      storyboards?: StoryboardListItem[];
      error?: { message: string };
    };
    if (!response.ok) throw new Error(body.error?.message ?? "Storyboards could not be loaded");
    setItems(body.storyboards ?? []);
  }, [projectId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Storyboards could not be loaded"),
    );
  }, [load]);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/storyboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, creativeBrief }),
      });
      const body = (await response.json()) as { id?: string; error?: { message: string } };
      if (!response.ok || !body.id)
        throw new Error(body.error?.message ?? "Storyboard could not be created");
      window.location.href = `/projects/${projectId}/storyboards/${body.id}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Storyboard could not be created");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pageFrame storyboardPage">
      <a className="backLink" href={`/projects/${projectId}`}>
        ← Back to project assets
      </a>
      <header className="storyboardHero">
        <div>
          <p className="eyebrow">Creative planning · zero external calls</p>
          <h1>Storyboards</h1>
          <p>
            Create a three-shot draft, preserve every version, and resolve approved assets later.
          </p>
        </div>
      </header>
      <section className="createCard storyboardCreate">
        <h2>Start a storyboard</h2>
        <label>
          Title
          <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Creative brief
          <textarea
            value={creativeBrief}
            maxLength={4000}
            onChange={(event) => setCreativeBrief(event.target.value)}
          />
        </label>
        {error && <p className="formError">{error}</p>}
        <button
          className="primaryButton"
          disabled={busy || !title.trim() || !creativeBrief.trim()}
          onClick={() => void create()}
        >
          {busy ? "Creating…" : "Create storyboard"}
        </button>
      </section>
      <section className="storyboardGrid">
        {items.map((item) => (
          <a
            className="storyboardCard"
            href={`/projects/${projectId}/storyboards/${item.id}`}
            key={item.id}
          >
            <p className="eyebrow">{item.approvedVersionId ? "Owner approved" : "Draft"}</p>
            <h2>{item.title}</h2>
            <p>{item.creativeBrief}</p>
            <span>
              {item.headVersion
                ? `Version ${item.headVersion.versionNumber} · ${item.headVersion.shots.length} shots`
                : "No proposal yet"}
            </span>
          </a>
        ))}
      </section>
    </main>
  );
}
