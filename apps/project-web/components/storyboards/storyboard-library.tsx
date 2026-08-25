"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoryboardListItem } from "./types";

export function StoryboardLibrary({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<StoryboardListItem[]>([]);
  const [title, setTitle] = useState("");
  const [creativeBrief, setCreativeBrief] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/storyboards?status=${status}`);
    const body = (await response.json()) as {
      storyboards?: StoryboardListItem[];
      error?: { message: string };
    };
    if (!response.ok) throw new Error(body.error?.message ?? "Storyboards could not be loaded");
    setItems(body.storyboards ?? []);
  }, [projectId, status]);

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

  async function lifecycle(item: StoryboardListItem) {
    const hasHistory = Object.values(item._count).some((count) => count > 0);
    const action = item.status === "ARCHIVED" ? "restore" : hasHistory ? "archive" : "delete";
    const question =
      action === "delete"
        ? `Permanently delete “${item.title}”? This empty storyboard cannot be recovered.`
        : action === "archive"
          ? `Archive “${item.title}”? Its history will remain recoverable.`
          : `Restore “${item.title}” to the active list?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const path =
        action === "delete"
          ? `/api/storyboards/${item.id}`
          : `/api/storyboards/${item.id}/${action}`;
      const response = await fetch(path, {
        method: action === "delete" ? "DELETE" : "POST",
        headers: { "If-Match": `"storyboard-${item.rowVersion}"` },
      });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Storyboard action failed");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Storyboard action failed");
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
            Start with three shots, then add, remove, and reorder up to twenty while preserving
            every version.
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
      <div className="storyboardListTabs" role="tablist" aria-label="Storyboard status">
        <button
          className={status === "ACTIVE" ? "primaryButton" : "panelButton"}
          onClick={() => setStatus("ACTIVE")}
        >
          Active
        </button>
        <button
          className={status === "ARCHIVED" ? "primaryButton" : "panelButton"}
          onClick={() => setStatus("ARCHIVED")}
        >
          Archived
        </button>
      </div>
      <section className="storyboardGrid">
        {items.map((item) => (
          <article className="storyboardCard storyboardCardWithActions" key={item.id}>
            <a href={`/projects/${projectId}/storyboards/${item.id}`}>
              <p className="eyebrow">
                {item.status === "ARCHIVED"
                  ? "Archived"
                  : item.approvedVersionId
                    ? "Owner approved"
                    : "Draft"}
              </p>
              <h2>{item.title}</h2>
              <p>{item.creativeBrief}</p>
              <span>
                {item.headVersion
                  ? `Version ${item.headVersion.versionNumber} · ${item.headVersion.shots.length} shots`
                  : "No proposal yet"}
              </span>
            </a>
            <details className="storyboardCardMenu">
              <summary aria-label={`Actions for ${item.title}`}>Actions</summary>
              <div>
                <button
                  className={item.status === "ARCHIVED" ? "panelButton" : "dangerTextButton"}
                  disabled={busy}
                  onClick={() => void lifecycle(item)}
                >
                  {item.status === "ARCHIVED"
                    ? "Restore"
                    : Object.values(item._count).some((count) => count > 0)
                      ? "Archive"
                      : "Delete"}
                </button>
              </div>
            </details>
          </article>
        ))}
        {items.length === 0 && (
          <p className="noticePanel">
            {status === "ACTIVE" ? "No active storyboards." : "No archived storyboards."}
          </p>
        )}
      </section>
    </main>
  );
}
