"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoryboardShotView, StoryboardVersionView, StoryboardView } from "./types";
import { useLanguage } from "../i18n/language-provider";
import { CapabilityWorkflowPlanningPanel } from "./workflow-planning-panel";
import { StoryboardDirectorPanel } from "./storyboard-director-panel";

interface GenerationPlanSummary {
  id: string;
  storyboardVersionId: string;
  createdAt: string;
  updatedAt: string;
  headVersion: { versionNumber: number } | null;
  approvedVersion: { versionNumber: number } | null;
  generationBatchCount: number;
}

export function StoryboardEditor({
  projectId,
  storyboardId,
}: {
  projectId: string;
  storyboardId: string;
}) {
  const { locale } = useLanguage();
  const isChinese = locale === "zh-CN";
  const [storyboard, setStoryboard] = useState<StoryboardView | null>(null);
  const [etag, setEtag] = useState('"storyboard-0"');
  const [shots, setShots] = useState<StoryboardShotView[]>([]);
  const [versions, setVersions] = useState<
    Array<StoryboardVersionView & { _count?: { shots: number } }>
  >([]);
  const [generationPlans, setGenerationPlans] = useState<GenerationPlanSummary[]>([]);
  const [compare, setCompare] = useState<
    [StoryboardVersionView | null, StoryboardVersionView | null]
  >([null, null]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [storyboardResponse, versionsResponse, plansResponse] = await Promise.all([
      fetch(`/api/storyboards/${storyboardId}`),
      fetch(`/api/storyboards/${storyboardId}/versions`),
      fetch(`/api/storyboards/${storyboardId}/generation-plans`),
    ]);
    const body = (await storyboardResponse.json()) as StoryboardView & {
      error?: { message: string };
    };
    if (!storyboardResponse.ok)
      throw new Error(body.error?.message ?? "Storyboard could not be loaded");
    const versionBody = (await versionsResponse.json()) as {
      versions?: Array<StoryboardVersionView & { _count?: { shots: number } }>;
    };
    const plansBody = (await plansResponse.json()) as {
      plans?: GenerationPlanSummary[];
      error?: { message: string };
    };
    if (!plansResponse.ok)
      throw new Error(plansBody.error?.message ?? "Shot plans could not be loaded");
    setStoryboard(body);
    setShots(body.headVersion?.shots ?? []);
    setVersions(versionBody.versions ?? []);
    setGenerationPlans(plansBody.plans ?? []);
    setEtag(storyboardResponse.headers.get("etag") ?? `"storyboard-${body.rowVersion}"`);
  }, [storyboardId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Storyboard could not be loaded"),
    );
  }, [load]);

  const requirementCount = useMemo(
    () => shots.reduce((total, shot) => total + shot.requirements.length, 0),
    [shots],
  );

  async function request(path: string, options: RequestInit, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, options);
      const body = (await response.json()) as { error?: { code: string; message: string } };
      if (!response.ok) {
        if (body.error?.code === "VERSION_CONFLICT") await load();
        throw new Error(body.error?.message ?? "The request could not be completed");
      }
      setMessage(success);
      await load();
      return body;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be completed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(includeProjectAssetRequirements = false) {
    if (!storyboard) return;
    await request(
      `/api/storyboards/${storyboardId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "If-Match": etag },
        body: JSON.stringify({
          parentVersionId: storyboard.headVersionId,
          creativeBrief: storyboard.creativeBrief,
          includeProjectAssetRequirements,
          shots: shots.map((shot, index) => ({
            schemaVersion: "shot-draft-v1",
            shotKey: shot.shotKey,
            ordinal: index + 1,
            title: shot.title,
            creativeDescription: shot.creativeDescription,
            startState: shot.startState,
            action: shot.action,
            endState: shot.endState,
            camera: shot.camera,
            composition: shot.composition,
            continuityRequirements: shot.continuityRequirements,
            durationSeconds: shot.durationSeconds,
            assetRequirements: shot.requirements.map((requirement) => ({
              shotOrdinal: index + 1,
              requirementKey: requirement.requirementKey,
              contractVersion: requirement.contractVersion,
              candidateInput: requirement.inputJson,
            })),
          })),
        }),
      },
      includeProjectAssetRequirements
        ? "A new version was saved with the project’s structured asset requirements."
        : "A new immutable version was saved.",
    );
  }

  async function loadComparison(slot: 0 | 1, versionId: string) {
    const response = await fetch(`/api/storyboard-versions/${versionId}`);
    if (!response.ok) return;
    const version = (await response.json()) as StoryboardVersionView;
    setCompare((current) => (slot === 0 ? [version, current[1]] : [current[0], version]));
  }

  function updateShot(index: number, field: keyof StoryboardShotView, value: string | number) {
    setShots((current) =>
      current.map((shot, shotIndex) =>
        shotIndex === index ? ({ ...shot, [field]: value } as StoryboardShotView) : shot,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setShots((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((shot, shotIndex) => ({ ...shot, ordinal: shotIndex + 1 }));
    });
  }

  function addShot() {
    if (shots.length >= 20) return;
    const ordinal = shots.length + 1;
    setShots((current) => [
      ...current,
      {
        shotKey: crypto.randomUUID(),
        ordinal,
        title: `Shot ${ordinal}`,
        creativeDescription: "Describe this shot.",
        startState: "Describe the opening state.",
        action: "Describe the action.",
        endState: "Describe the ending state.",
        camera: "Describe shot size and camera movement.",
        composition: "Describe composition and focus.",
        continuityRequirements: [],
        durationSeconds: 3,
        requirements: [],
      },
    ]);
  }

  function removeShot(index: number) {
    setShots((current) =>
      current
        .filter((_, shotIndex) => shotIndex !== index)
        .map((shot, shotIndex) => ({ ...shot, ordinal: shotIndex + 1 })),
    );
  }

  if (!storyboard)
    return (
      <main className="pageFrame">
        <p>{error || "Opening storyboard…"}</p>
      </main>
    );

  return (
    <main className="pageFrame storyboardPage">
      <a className="backLink" href={`/projects/${projectId}/storyboards`}>
        ← All storyboards
      </a>
      <header className="storyboardHero">
        <div>
          <p className="eyebrow">Flexible shot draft · 1–20 editable shots</p>
          <h1>{storyboard.title}</h1>
          <p>{storyboard.creativeBrief}</p>
        </div>
        <div className="storyboardActions">
          {shots.length > 0 && (
            <button
              className="primaryButton"
              disabled={busy || shots.length === 0 || storyboard.status === "ARCHIVED"}
              onClick={() => void save()}
            >
              Save new version
            </button>
          )}
        </div>
      </header>
      {message && <p className="successPanel">{message}</p>}
      {error && <p className="formError">{error}</p>}
      <StoryboardDirectorPanel
        storyboardId={storyboardId}
        rowVersion={storyboard.rowVersion}
        onChanged={load}
      />
      {storyboard.status === "ARCHIVED" && (
        <p className="noticePanel">
          This storyboard is archived and remains read-only until restored.
        </p>
      )}
      {storyboard.headVersion && storyboard.status === "ACTIVE" && (
        <CapabilityWorkflowPlanningPanel
          projectId={projectId}
          storyboardVersionId={storyboard.headVersion.id}
          storyboardRevisionVersion={storyboard.headVersion.contentHash}
          shots={storyboard.headVersion.shots.flatMap((shot) =>
            shot.id ? [{ id: shot.id, shotKey: shot.shotKey, ordinal: shot.ordinal }] : [],
          )}
          isChinese={isChinese}
        />
      )}
      <div className="storyboardActions shotStructureActions">
        <button
          className="panelButton"
          disabled={busy || shots.length >= 20 || storyboard.status === "ARCHIVED"}
          onClick={addShot}
        >
          Add shot
        </button>
        <span>{shots.length} / 20 shots</span>
      </div>
      <section className="shotGrid">
        {shots.map((shot, index) => (
          <article className="shotCard" key={shot.shotKey}>
            <div className="shotCardHeader">
              <span>Shot {index + 1}</span>
              <div>
                <button
                  disabled={index === 0 || storyboard.status === "ARCHIVED"}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  disabled={index === shots.length - 1 || storyboard.status === "ARCHIVED"}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  className="dangerTextButton"
                  disabled={storyboard.status === "ARCHIVED"}
                  onClick={() => removeShot(index)}
                >
                  Remove
                </button>
              </div>
            </div>
            {(
              [
                "title",
                "creativeDescription",
                "startState",
                "action",
                "endState",
                "camera",
                "composition",
              ] as const
            ).map((field) => (
              <label key={field}>
                {field.replaceAll(/([A-Z])/g, " $1")}
                <textarea
                  value={String(shot[field])}
                  disabled={storyboard.status === "ARCHIVED"}
                  onChange={(event) => updateShot(index, field, event.target.value)}
                />
              </label>
            ))}
            <label>
              Duration seconds
              <input
                type="number"
                min="0.1"
                max="30"
                step="0.1"
                value={shot.durationSeconds}
                disabled={storyboard.status === "ARCHIVED"}
                onChange={(event) =>
                  updateShot(index, "durationSeconds", Number(event.target.value))
                }
              />
            </label>
            <div className="shotRequirements" aria-label={`Shot ${index + 1} asset requirements`}>
              <strong>Structured asset requirements</strong>
              {shot.requirements.length ? (
                <ul>
                  {shot.requirements.map((requirement) => (
                    <li key={requirement.id}>{formatRequirement(requirement.requirementKey)}</li>
                  ))}
                </ul>
              ) : (
                <p>No structured asset requirements on this version.</p>
              )}
            </div>
          </article>
        ))}
      </section>
      {storyboard.headVersion && requirementCount === 0 && (
        <section className="noticePanel">
          <p>
            This version has no structured asset requirements. Your shot text can stay unchanged;
            save a new version to add the project’s published semantic assets as requirements.
          </p>
          <button className="panelButton" disabled={busy} onClick={() => void save(true)}>
            Save with project asset requirements
          </button>
        </section>
      )}
      <section className="storyboardPanel">
        <h2>Version history and comparison</h2>
        <div className="comparisonSelectors">
          {[0, 1].map((slot) => (
            <select
              key={slot}
              defaultValue=""
              onChange={(event) => void loadComparison(slot as 0 | 1, event.target.value)}
            >
              <option value="" disabled>
                Select version
              </option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber} · {version.source}
                </option>
              ))}
            </select>
          ))}
        </div>
        <div className="comparisonGrid">
          {compare.map((version, index) => (
            <div key={index}>
              {version ? (
                <>
                  <h3>Version {version.versionNumber}</h3>
                  {version.shots.map((shot) => (
                    <p key={shot.shotKey}>
                      <strong>
                        {shot.ordinal}. {shot.title}
                      </strong>
                      <br />
                      {shot.action}
                    </p>
                  ))}
                </>
              ) : (
                <p>Select a version.</p>
              )}
            </div>
          ))}
        </div>
      </section>
      {generationPlans.length > 0 && (
        <details className="storyboardPanel shotPlanHistory">
          <summary>历史 Shot Plan（只读 · {generationPlans.length}）</summary>
          <p>旧计划、批次、素材清单和审批记录继续保留，但不再作为当前生成入口。</p>
          <ul>
            {generationPlans.map((plan) => (
              <li key={plan.id}>
                <a href={`/projects/${projectId}/storyboards/${storyboardId}/plans/${plan.id}`}>
                  {new Date(plan.createdAt).toLocaleString()} · 计划 v
                  {plan.headVersion?.versionNumber ?? 0} · {plan.generationBatchCount} 个批次
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}

function formatRequirement(requirementKey: string) {
  const match = /^shot-\d+-([^-]+)-(.+)$/.exec(requirementKey);
  if (!match) return requirementKey;
  return `@${match[2]!.replaceAll("-", " ")} · ${match[1]!.toUpperCase()}`;
}
