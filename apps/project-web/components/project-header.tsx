"use client";

import { useState } from "react";
import { useLanguage } from "./i18n/language-provider";

interface Project {
  id: string;
  name: string;
  brief: string | null;
  targetAspectRatio: string;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
}

export function ProjectHeader({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [brief, setBrief] = useState(project.brief ?? "");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openEditor() {
    setName(project.name);
    setBrief(project.brief ?? "");
    setError("");
    setEditing(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, brief }),
      });
      const body = (await response.json()) as Project & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? t("Project could not be updated"));
      onChange(body);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Project could not be updated"));
    } finally {
      setBusy(false);
    }
  }

  async function changeLifecycle() {
    const action = project.status === "ACTIVE" ? "archive" : "restore";
    if (action === "archive" && !confirmingArchive) {
      setConfirmingArchive(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/${action}`, { method: "POST" });
      const body = (await response.json()) as Project & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? t("Project action failed"));
      onChange(body);
      if (action === "archive") window.location.assign("/");
      else setConfirmingArchive(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Project action failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="projectHeader">
      <a className="backLink" href="/">
        ← Project library
      </a>
      <div className="projectTitleRow">
        <div>
          <span className="ratioChip">
            {project.targetAspectRatio
              .replaceAll("_", ":")
              .replace("PORTRAIT:", "Portrait ")
              .replace("LANDSCAPE:", "Landscape ")
              .replace("SQUARE:", "Square ")}
          </span>
          <h1>{project.name}</h1>
          <p>{project.brief || "Add a creative brief to keep the work focused."}</p>
        </div>
        <div className="headerActions">
          <button disabled={busy} onClick={openEditor}>
            {t("Edit details")}
          </button>
          <button className="dangerGhost" disabled={busy} onClick={() => void changeLifecycle()}>
            {project.status === "ACTIVE" ? "Archive" : "Restore"}
          </button>
        </div>
      </div>
      {editing && (
        <form className="projectInlineForm" onSubmit={(event) => void save(event)}>
          <h2>{t("Edit project details")}</h2>
          <label>
            {t("Project name")}
            <input
              autoFocus
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {t("Creative brief")}
            <textarea
              maxLength={4000}
              rows={5}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
            />
          </label>
          {error && <p className="formError">{error}</p>}
          <div className="storyboardActions">
            <button className="primaryButton" disabled={busy || !name.trim()} type="submit">
              {busy ? t("Saving…") : t("Save changes")}
            </button>
            <button className="panelButton" type="button" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      )}
      {confirmingArchive && project.status === "ACTIVE" && (
        <div className="projectArchiveConfirm" role="alert">
          <p>{t("Archive this project? All source files and project details will be kept.")}</p>
          {error && <p className="formError">{error}</p>}
          <div className="storyboardActions">
            <button
              className="dangerTextButton"
              disabled={busy}
              onClick={() => void changeLifecycle()}
            >
              {busy ? t("Archiving…") : t("Confirm archive")}
            </button>
            <button className="panelButton" onClick={() => setConfirmingArchive(false)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
