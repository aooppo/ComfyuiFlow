"use client";

import { useCallback, useEffect, useState } from "react";
import { AssetImporter } from "./asset-importer";
import { AssetLibrary } from "./asset-library";
import { ProjectHeader } from "./project-header";
import { ProductionAssetLibrary } from "./production-assets/production-asset-library";
import { AssetCandidatePreview } from "./production-assets/asset-candidate-preview";
import { AnalysisSelection } from "./asset-understanding/analysis-selection";
import { CharacterStateEditor } from "./character-states/character-state-editor";
import type { ProjectView } from "./types";

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const body = (await response.json()) as ProjectView & { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Project could not be loaded");
      setProject(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project could not be loaded");
    }
  }, [projectId]);

  useEffect(() => void load(), [load]);

  if (error)
    return (
      <div className="pageFrame">
        <div className="errorPanel">
          <h1>We couldn’t open this project</h1>
          <p>{error}</p>
          <a href="/">Return to the project library</a>
        </div>
      </div>
    );
  if (!project)
    return (
      <div className="pageFrame">
        <div className="emptyPanel">Opening your project…</div>
      </div>
    );

  return (
    <div className="pageFrame projectPage">
      <ProjectHeader project={project} onChange={setProject} />
      <a className="storyboardEntry" href={`/projects/${project.id}/storyboards`}>
        <span>
          <strong>Plan a three-shot storyboard</strong>
          <small>
            Fake Director, immutable versions, and explainable asset gaps · 0 external calls
          </small>
        </span>
        <b>Open storyboards →</b>
      </a>
      {project.status === "ACTIVE" ? (
        <AssetImporter
          projectId={project.id}
          onComplete={() => setRevision((value) => value + 1)}
        />
      ) : (
        <div className="noticePanel">
          This project is archived. Restore it to change source assets.
        </div>
      )}
      <AssetLibrary
        projectId={project.id}
        revision={revision}
        readOnly={project.status !== "ACTIVE"}
      />
      <ProductionAssetLibrary projectId={project.id} readOnly={project.status !== "ACTIVE"} />
      <CharacterStateEditor projectId={project.id} readOnly={project.status !== "ACTIVE"} />
      <AssetCandidatePreview projectId={project.id} />
      {project.status === "ACTIVE" && <AnalysisSelection projectId={project.id} />}
    </div>
  );
}
