"use client";

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

  async function edit() {
    const name = window.prompt(t("Project name"), project.name)?.trim();
    if (!name) return;
    const brief = window.prompt(t("Creative brief"), project.brief ?? "");
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brief }),
    });
    if (response.ok) onChange((await response.json()) as Project);
  }

  async function changeLifecycle() {
    const action = project.status === "ACTIVE" ? "archive" : "restore";
    if (
      action === "archive" &&
      !window.confirm(t("Archive this project? All source files and project details will be kept."))
    )
      return;
    const response = await fetch(`/api/projects/${project.id}/${action}`, { method: "POST" });
    if (!response.ok) return;
    const changed = (await response.json()) as Project;
    onChange(changed);
    if (action === "archive") window.location.assign("/");
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
          <button onClick={() => void edit()}>Edit details</button>
          <button className="dangerGhost" onClick={() => void changeLifecycle()}>
            {project.status === "ACTIVE" ? "Archive" : "Restore"}
          </button>
        </div>
      </div>
    </header>
  );
}
