"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoryboardShotView, StoryboardVersionView, StoryboardView } from "./types";

interface CandidatePreview {
  resultHash: string;
  gaps: Array<{ requirementId: string; code: string }>;
  results: Array<{
    requirementId: string;
    result: {
      eligible: Array<{ bindingId: string; projectAssetId: string }>;
      rejected: Array<{ bindingId: string; reasonCodes: string[] }>;
    };
  }>;
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
  const [compare, setCompare] = useState<
    [StoryboardVersionView | null, StoryboardVersionView | null]
  >([null, null]);
  const [preview, setPreview] = useState<CandidatePreview | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [storyboardResponse, versionsResponse] = await Promise.all([
      fetch(`/api/storyboards/${storyboardId}`),
      fetch(`/api/storyboards/${storyboardId}/versions`),
    ]);
    const body = (await storyboardResponse.json()) as StoryboardView & {
      error?: { message: string };
    };
    if (!storyboardResponse.ok)
      throw new Error(body.error?.message ?? "Storyboard could not be loaded");
    const versionBody = (await versionsResponse.json()) as {
      versions?: Array<StoryboardVersionView & { _count?: { shots: number } }>;
    };
    setStoryboard(body);
    setShots(body.headVersion?.shots ?? []);
    setVersions(versionBody.versions ?? []);
    setEtag(storyboardResponse.headers.get("etag") ?? `"storyboard-${body.rowVersion}"`);
  }, [storyboardId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Storyboard could not be loaded"),
    );
  }, [load]);

  const canApprove = useMemo(
    () => shots.length === 3 && shots.every((shot, index) => shot.ordinal === index + 1),
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

  async function save() {
    if (!storyboard) return;
    await request(
      `/api/storyboards/${storyboardId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "If-Match": etag },
        body: JSON.stringify({
          parentVersionId: storyboard.headVersionId,
          creativeBrief: storyboard.creativeBrief,
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
      "A new immutable version was saved.",
    );
  }

  async function previewAssets() {
    const response = await fetch(
      `/api/storyboard-versions/${storyboard?.headVersionId}/asset-candidates/preview`,
      { method: "POST" },
    );
    const body = (await response.json()) as CandidatePreview & { error?: { message: string } };
    if (!response.ok) return setError(body.error?.message ?? "Candidates could not be previewed");
    setPreview(body);
    setMessage("Candidate preview completed without creating a formal selection.");
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
          <p className="eyebrow">Three-shot draft · Fake Director · 0 external calls</p>
          <h1>{storyboard.title}</h1>
          <p>{storyboard.creativeBrief}</p>
        </div>
        <div className="storyboardActions">
          <button className="panelButton" disabled={busy} onClick={() => void generate()}>
            {storyboard.headVersion ? "New Fake proposal" : "Generate three shots"}
          </button>
          {storyboard.headVersion && (
            <button className="primaryButton" disabled={busy} onClick={() => void save()}>
              Save new version
            </button>
          )}
        </div>
      </header>
      {message && <p className="successPanel">{message}</p>}
      {error && <p className="formError">{error}</p>}
      <section className="shotGrid">
        {shots.map((shot, index) => (
          <article className="shotCard" key={shot.shotKey}>
            <div className="shotCardHeader">
              <span>Shot {index + 1}</span>
              <div>
                <button onClick={() => move(index, -1)}>↑</button>
                <button onClick={() => move(index, 1)}>↓</button>
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
                onChange={(event) =>
                  updateShot(index, "durationSeconds", Number(event.target.value))
                }
              />
            </label>
          </article>
        ))}
      </section>
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
          <button className="panelButton" onClick={() => void previewAssets()}>
            Preview asset candidates
          </button>
          {preview && (
            <div className="candidateResults">
              <p>
                {preview.gaps.length ? `${preview.gaps.length} blocking gaps` : "No candidate gaps"}
              </p>
              {preview.results.map((entry) => (
                <label key={entry.requirementId}>
                  Requirement {entry.requirementId.slice(0, 8)}
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
                        {candidate.projectAssetId.slice(0, 8)}
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
              disabled={!preview || preview.gaps.length > 0}
              onClick={() => void freezeManifest()}
            >
              Freeze asset manifest
            </button>
            <button
              className="primaryButton"
              disabled={!canApprove || !storyboard.headVersion.manifest}
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
            <button className="primaryButton" disabled={busy} onClick={() => void createShotPlan()}>
              Open Shot Plan
            </button>
          )}
        </section>
      )}
    </main>
  );
}
