"use client";

import { useCallback, useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  brief: string | null;
  targetAspectRatio: string;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
}

const ratios = [
  ["PORTRAIT_9_16", "Portrait 9:16"],
  ["LANDSCAPE_16_9", "Landscape 16:9"],
  ["SQUARE_1_1", "Square 1:1"],
  ["PORTRAIT_4_5", "Portrait 4:5"],
] as const;

export function ProjectLibrary() {
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects?status=${status}`);
      const body = (await response.json()) as { projects?: Project[]; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Projects could not be loaded");
      setProjects(body.projects ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Projects could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => void load(), [load]);

  async function createProject(form: FormData) {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          brief: form.get("brief"),
          targetAspectRatio: form.get("targetAspectRatio"),
        }),
      });
      const body = (await response.json()) as Project & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Project could not be created");
      window.location.assign(`/projects/${body.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project could not be created");
      setCreating(false);
    }
  }

  return (
    <div className="pageFrame">
      <section className="hero">
        <div>
          <p className="eyebrow">Project library</p>
          <h1>
            Make every source
            <br />
            easy to find.
          </h1>
          <p className="heroCopy">
            Create a project, preserve the original files, and organize the visual world before
            directing a single shot.
          </p>
        </div>
        <form className="createCard" action={createProject}>
          <h2>New project</h2>
          <label>
            Project name
            <input name="name" required maxLength={120} placeholder="Coffee table campaign" />
          </label>
          <label>
            Creative brief
            <textarea name="brief" maxLength={4000} placeholder="What are you making?" />
          </label>
          <label>
            Target format
            <select name="targetAspectRatio" defaultValue="PORTRAIT_9_16">
              {ratios.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="primaryButton" disabled={creating}>
            {creating ? "Creating…" : "Create project"}
          </button>
        </form>
      </section>

      <section className="librarySection" aria-live="polite">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{status === "ACTIVE" ? "Active projects" : "Archived projects"}</h2>
          </div>
          <div className="segmented" aria-label="Project status">
            <button aria-pressed={status === "ACTIVE"} onClick={() => setStatus("ACTIVE")}>
              Active
            </button>
            <button aria-pressed={status === "ARCHIVED"} onClick={() => setStatus("ARCHIVED")}>
              Archived
            </button>
          </div>
        </div>
        {error && (
          <div className="errorPanel">
            <p>{error}</p>
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="emptyPanel">Loading your workspace…</div>
        ) : projects.length === 0 ? (
          <div className="emptyPanel">
            <span className="emptyGlyph">✦</span>
            <h3>{status === "ACTIVE" ? "Your first project starts here" : "Nothing archived"}</h3>
            <p>
              {status === "ACTIVE"
                ? "Use the project form above to create a home for your source material."
                : "Archived projects remain safely available for restoration."}
            </p>
          </div>
        ) : (
          <div className="projectGrid">
            {projects.map((project) => (
              <a className="projectCard" href={`/projects/${project.id}`} key={project.id}>
                <span className="ratioChip">
                  {ratios.find(([value]) => value === project.targetAspectRatio)?.[1]}
                </span>
                <h3>{project.name}</h3>
                <p>{project.brief || "No creative brief yet."}</p>
                <span className="updated">
                  Updated{" "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                    new Date(project.updatedAt),
                  )}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
