"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoryboardShotView, StoryboardVersionView, StoryboardView } from "./types";

interface CandidatePreview {
  resultHash: string;
  gaps: Array<{ requirementId: string; code: string }>;
  results: Array<{
    requirementId: string;
    requirementKey: string;
    shotOrdinal: number;
    assetType: string;
    referenceUsages: string[];
    result: {
      eligible: Array<{
        bindingId: string;
        projectAssetId: string;
        assetName?: string;
        fileName?: string;
        referenceUsage?: string;
        viewpoint?: string;
        shotScale?: string;
      }>;
      rejected: Array<{ bindingId: string; reasonCodes: string[] }>;
    };
  }>;
}

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
  const [preview, setPreview] = useState<CandidatePreview | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
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

  const canApprove = useMemo(
    () =>
      shots.length >= 1 &&
      shots.length <= 20 &&
      shots.every((shot, index) => shot.ordinal === index + 1),
    [shots],
  );
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

  async function generate() {
    await request(
      `/api/storyboards/${storyboardId}/generate`,
      { method: "POST", headers: { "If-Match": etag } },
      "A deterministic three-shot proposal was added. External calls: 0.",
    );
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

  async function previewAssets() {
    if (!storyboard?.headVersionId || requirementCount === 0) {
      setPreview(null);
      setError("");
      setMessage(
        "This version has no structured asset requirements, so there are no candidates to preview. Save a new version with project asset requirements first.",
      );
      return;
    }
    const response = await fetch(
      `/api/storyboard-versions/${storyboard?.headVersionId}/asset-candidates/preview`,
      { method: "POST" },
    );
    const body = (await response.json()) as CandidatePreview & { error?: { message: string } };
    if (!response.ok) return setError(body.error?.message ?? "Candidates could not be previewed");
    setPreview(body);
    setSelections((current) =>
      Object.fromEntries(
        body.results.flatMap((entry) => {
          const selected = current[entry.requirementId] ?? entry.result.eligible[0]?.bindingId;
          return selected ? [[entry.requirementId, selected]] : [];
        }),
      ),
    );
    setMessage(
      body.results.length === 0
        ? "This version has no structured asset requirements, so there are no candidates to preview."
        : "Candidate preview completed. The highest-ranked eligible candidate for each requirement was preselected as an editable recommendation; no formal selection was created.",
    );
  }

  async function freezeManifest() {
    if (!storyboard?.headVersionId || !preview) return;
    await request(
      `/api/storyboard-versions/${storyboard.headVersionId}/asset-resolution-manifests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateResultHash: preview.resultHash,
          selections: preview.results.map((entry) => ({
            requirementId: entry.requirementId,
            assetVersionFileIds: selections[entry.requirementId]
              ? [selections[entry.requirementId]]
              : [],
          })),
        }),
      },
      "The exact asset versions were frozen in a resolution manifest.",
    );
  }

  async function decide(decision: "APPROVED" | "REVOKED") {
    if (!storyboard?.headVersionId) return;
    const versionId =
      decision === "APPROVED" ? storyboard.headVersionId : storyboard.approvedVersionId;
    if (!versionId) return;
    await request(
      `/api/storyboard-versions/${versionId}/decisions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "If-Match": etag,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ decision }),
      },
      decision === "APPROVED"
        ? "Storyboard approved. Video generation is still not authorized."
        : "Approval revoked. Historical decisions remain unchanged.",
    );
  }

  async function createShotPlan() {
    if (!storyboard?.approvedVersionId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/storyboard-versions/${storyboard.approvedVersionId}/generation-plans`,
        { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      const body = (await response.json()) as { id?: string; error?: { message: string } };
      if (!response.ok || !body.id)
        throw new Error(body.error?.message ?? "Shot plan could not be created");
      window.location.assign(`/projects/${projectId}/storyboards/${storyboardId}/plans/${body.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Shot plan could not be created");
      setBusy(false);
    }
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
          <p className="eyebrow">
            Flexible shot draft · Fake Director starts with 3 · 0 external calls
          </p>
          <h1>{storyboard.title}</h1>
          <p>{storyboard.creativeBrief}</p>
        </div>
        <div className="storyboardActions">
          <button
            className="panelButton"
            disabled={busy || storyboard.status === "ARCHIVED"}
            onClick={() => void generate()}
          >
            {storyboard.headVersion ? "New Fake proposal" : "Generate three shots"}
          </button>
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
      {storyboard.status === "ARCHIVED" && (
        <p className="noticePanel">
          This storyboard is archived and remains read-only until restored.
        </p>
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
      {storyboard.headVersion && (
        <section className="storyboardPanel">
          <h2>Asset resolution and owner decision</h2>
          <p>
            Preview is always read-only. Formal binding and approval stay closed until Phase 2
            verification passes.
          </p>
          {!storyboard.formalAssetBindingEnabled && (
            <p className="noticePanel">
              Formal asset binding is closed because the recorded Phase 2 Gate is not complete.
            </p>
          )}
          <button
            className="panelButton"
            disabled={busy || storyboard.status === "ARCHIVED"}
            onClick={() => void previewAssets()}
          >
            Preview asset candidates
          </button>
          {preview && (
            <div className="candidateResults">
              <p>
                {preview.results.length === 0
                  ? "No structured asset requirements were found for this version."
                  : preview.gaps.length
                    ? `${preview.gaps.length} blocking gaps`
                    : "All structured asset requirements have eligible candidates"}
              </p>
              {preview.results.map((entry) => (
                <label key={entry.requirementId}>
                  {formatRequirement(entry.requirementKey)} · Shot {entry.shotOrdinal}
                  {entry.result.eligible.length > 0 && (
                    <small className="recommendationNote">
                      Recommended from the structured shot requirement · editable
                    </small>
                  )}
                  <select
                    value={selections[entry.requirementId] ?? ""}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [entry.requirementId]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select eligible asset</option>
                    {entry.result.eligible.map((candidate) => (
                      <option key={candidate.bindingId} value={candidate.bindingId}>
                        {formatCandidate(candidate)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="storyboardActions">
            <button
              className="panelButton"
              disabled={
                busy ||
                !preview ||
                preview.results.length === 0 ||
                preview.gaps.length > 0 ||
                !storyboard.formalAssetBindingEnabled ||
                storyboard.status === "ARCHIVED"
              }
              onClick={() => void freezeManifest()}
            >
              Freeze asset manifest
            </button>
            <button
              className="primaryButton"
              disabled={
                busy ||
                !canApprove ||
                !storyboard.headVersion.manifest ||
                !storyboard.formalAssetBindingEnabled ||
                storyboard.status === "ARCHIVED"
              }
              onClick={() => void decide("APPROVED")}
            >
              Approve storyboard
            </button>
            {storyboard.approvedVersionId && (
              <button className="panelButton" onClick={() => void decide("REVOKED")}>
                Revoke approval
              </button>
            )}
          </div>
          <p className="noticePanel">
            Storyboard approval never authorizes external AI or video generation.
          </p>
          {storyboard.approvedVersionId && (
            <section className="shotPlanNavigation" aria-label="Shot Plan navigation">
              <div>
                <h3>下一步：全片一致性</h3>
                <p>先确认场景、人物、产品、道具和镜头交界状态，再进入付费生成。</p>
              </div>
              <a
                className="primaryButton"
                href={`/projects/${projectId}/storyboards/${storyboardId}/continuity`}
              >
                设置全片一致性
              </a>
              {generationPlans.length > 0 ? (
                <>
                  <a
                    className="primaryButton"
                    href={`/projects/${projectId}/storyboards/${storyboardId}/plans/${generationPlans[0]!.id}`}
                  >
                    打开最新 Shot Plan
                  </a>
                  <details className="shotPlanHistory">
                    <summary>历史 Shot Plan（{generationPlans.length}）</summary>
                    <ul>
                      {generationPlans.map((plan) => (
                        <li key={plan.id}>
                          <a
                            href={`/projects/${projectId}/storyboards/${storyboardId}/plans/${plan.id}`}
                          >
                            {new Date(plan.createdAt).toLocaleString()} · 计划 v
                            {plan.headVersion?.versionNumber ?? 0} · {plan.generationBatchCount}{" "}
                            个批次
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <p className="noticePanel">尚未创建 Shot Plan。</p>
              )}
              <button className="panelButton" disabled={busy} onClick={() => void createShotPlan()}>
                新建 Shot Plan
              </button>
            </section>
          )}
        </section>
      )}
    </main>
  );
}

function formatRequirement(requirementKey: string) {
  const match = /^shot-\d+-([^-]+)-(.+)$/.exec(requirementKey);
  if (!match) return requirementKey;
  return `@${match[2]!.replaceAll("-", " ")} · ${match[1]!.toUpperCase()}`;
}

function formatCandidate(
  candidate: CandidatePreview["results"][number]["result"]["eligible"][number],
) {
  const primary = candidate.assetName ?? candidate.fileName ?? "Eligible asset";
  const file =
    candidate.fileName && candidate.fileName !== primary ? ` · ${candidate.fileName}` : "";
  const details = [candidate.referenceUsage, candidate.viewpoint, candidate.shotScale]
    .filter(Boolean)
    .join(" · ");
  return `${primary}${file}${details ? ` · ${details}` : ""}`;
}
