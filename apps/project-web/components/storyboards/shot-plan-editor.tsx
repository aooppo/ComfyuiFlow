"use client";

import { useCallback, useEffect, useState } from "react";

interface ReferenceView {
  requirementId: string;
  productionAssetVersionId: string;
  characterStateVersionId: string | null;
  assetVersionFileId: string;
  projectAssetId: string;
  expectedSha256: string;
  referenceUsage: string;
}

interface SpecView {
  id: string;
  storyboardShotId: string;
  shotKey: string;
  ordinal: number;
  startState: string;
  action: string;
  endState: string;
  camera: string;
  composition: string;
  continuityRequirements: string[];
  durationSeconds: number;
  positivePrompt: string;
  capabilityRequirements: Record<string, unknown>;
  inputHash: string;
  referencesHash: string;
  outputHash: string;
  references: ReferenceView[];
}

interface VersionView {
  id: string;
  versionNumber: number;
  parentVersionId: string | null;
  source: "DETERMINISTIC_PLANNER" | "OWNER";
  plannerVersion: string;
  contractVersion: string;
  inputHash: string;
  referencesHash: string;
  outputHash: string;
  specs: SpecView[];
}

interface PlanView {
  id: string;
  projectId: string;
  storyboardId: string;
  storyboardVersionId: string;
  manifestId: string;
  rowVersion: number;
  headVersionId: string;
  approvedVersionId: string | null;
  headVersion: VersionView;
  generationAuthorized: false;
}

function contractSpec(plan: PlanView, spec: SpecView) {
  return {
    schemaVersion: "generation-spec-v1",
    plannerVersion: "deterministic-shot-planner-v1",
    projectId: plan.projectId,
    storyboardId: plan.storyboardId,
    storyboardVersionId: plan.storyboardVersionId,
    manifestId: plan.manifestId,
    storyboardShotId: spec.storyboardShotId,
    shotKey: spec.shotKey,
    ordinal: spec.ordinal,
    startState: spec.startState,
    action: spec.action,
    endState: spec.endState,
    camera: spec.camera,
    composition: spec.composition,
    continuityRequirements: spec.continuityRequirements,
    durationSeconds: spec.durationSeconds,
    positivePrompt: spec.positivePrompt,
    references: spec.references.map((reference) => ({
      requirementId: reference.requirementId,
      productionAssetVersionId: reference.productionAssetVersionId,
      characterStateVersionId: reference.characterStateVersionId,
      assetVersionFileId: reference.assetVersionFileId,
      projectAssetId: reference.projectAssetId,
      sha256: reference.expectedSha256,
      referenceUsage: reference.referenceUsage,
    })),
    capabilityRequirements: spec.capabilityRequirements,
    inputHash: spec.inputHash,
    referencesHash: spec.referencesHash,
    outputHash: spec.outputHash,
  };
}

export function ShotPlanEditor({
  projectId,
  storyboardId,
  planId,
}: {
  projectId: string;
  storyboardId: string;
  planId: string;
}) {
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [specs, setSpecs] = useState<SpecView[]>([]);
  const [versions, setVersions] = useState<Array<Omit<VersionView, "specs">>>([]);
  const [comparison, setComparison] = useState<[VersionView | null, VersionView | null]>([
    null,
    null,
  ]);
  const [etag, setEtag] = useState("");
  const [blockers, setBlockers] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [planResponse, versionsResponse] = await Promise.all([
      fetch(`/api/generation-plans/${planId}`),
      fetch(`/api/generation-plans/${planId}/versions`),
    ]);
    const body = (await planResponse.json()) as PlanView & { error?: { message: string } };
    if (!planResponse.ok) throw new Error(body.error?.message ?? "Shot plan could not be loaded");
    const history = (await versionsResponse.json()) as {
      versions: Array<Omit<VersionView, "specs">>;
    };
    setPlan(body);
    setSpecs(body.headVersion.specs);
    setVersions(history.versions ?? []);
    setEtag(planResponse.headers.get("etag") ?? `"generation-plan-${body.rowVersion}"`);
  }, [planId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Shot plan could not be loaded"),
    );
  }, [load]);

  async function save() {
    if (!plan) return;
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/generation-plans/${plan.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "If-Match": etag },
      body: JSON.stringify({
        parentVersionId: plan.headVersionId,
        specs: specs.map((spec) => contractSpec(plan, spec)),
      }),
    });
    const body = (await response.json()) as { error?: { message: string; code: string } };
    if (!response.ok) {
      if (body.error?.code === "PLAN_VERSION_CONFLICT") await load();
      setError(body.error?.message ?? "Shot plan could not be saved");
    } else {
      setMessage("A new immutable owner version was saved.");
      await load();
    }
    setBusy(false);
  }

  async function preflight() {
    if (!plan) return;
    const response = await fetch(`/api/generation-plan-versions/${plan.headVersionId}/preflight`, {
      method: "POST",
    });
    const body = (await response.json()) as {
      ready?: boolean;
      blockers?: string[];
      error?: { message: string };
    };
    if (!response.ok) return setError(body.error?.message ?? "Preflight could not be completed");
    setBlockers(body.blockers ?? []);
    setMessage(
      body.ready
        ? "Preflight passed. This still does not authorize generation."
        : "Preflight found blocking issues.",
    );
  }

  async function decide(decision: "APPROVED" | "REVOKED") {
    if (!plan) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/generation-plan-versions/${plan.headVersionId}/decisions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "If-Match": etag,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ decision }),
    });
    const body = (await response.json()) as { error?: { message: string } };
    if (!response.ok) setError(body.error?.message ?? "Decision could not be recorded");
    else {
      setMessage(
        decision === "APPROVED"
          ? "Shot Plan approved. Generation remains unauthorized."
          : "Shot Plan approval revoked.",
      );
      await load();
    }
    setBusy(false);
  }

  async function compare(slot: 0 | 1, versionId: string) {
    const response = await fetch(`/api/generation-plan-versions/${versionId}`);
    if (!response.ok) return;
    const version = (await response.json()) as VersionView;
    setComparison((current) => (slot === 0 ? [version, current[1]] : [current[0], version]));
  }

  if (!plan)
    return (
      <main className="pageFrame">
        <p>{error || "Opening Shot Plan…"}</p>
      </main>
    );
  return (
    <main className="pageFrame storyboardPage">
      <a className="backLink" href={`/projects/${projectId}/storyboards/${storyboardId}`}>
        ← Storyboard
      </a>
      <header className="storyboardHero">
        <div>
          <p className="eyebrow">GenerationSpec v1 · deterministic planner · external calls 0</p>
          <h1>Shot Plan</h1>
          <p>
            Storyboard approval: confirmed · Shot Plan approval:{" "}
            {plan.approvedVersionId ? "confirmed" : "pending"}
          </p>
        </div>
      </header>
      <p className="noticePanel">
        <strong>Generation is not authorized.</strong> This Phase only prepares reviewable,
        provider-neutral specifications.
      </p>
      {message && <p className="successPanel">{message}</p>}
      {error && <p className="formError">{error}</p>}
      <section className="shotGrid">
        {specs.map((spec, index) => (
          <article className="shotCard" key={spec.shotKey}>
            <div className="shotCardHeader">
              <span>Shot {spec.ordinal}</span>
              <span>v{plan.headVersion.versionNumber}</span>
            </div>
            <label>
              Positive prompt
              <textarea
                value={spec.positivePrompt}
                onChange={(event) =>
                  setSpecs((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, positivePrompt: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <p>
              <strong>Continuity</strong>
              <br />
              {spec.continuityRequirements.join(" · ") || "None"}
            </p>
            <p>
              <strong>Capabilities</strong>
              <br />
              {String(spec.capabilityRequirements.mode)} ·{" "}
              {String(spec.capabilityRequirements.aspectRatio)} · {spec.durationSeconds}s · audio:
              no
            </p>
            <details>
              <summary>Exact references ({spec.references.length})</summary>
              {spec.references.map((reference) => (
                <p key={`${reference.requirementId}:${reference.assetVersionFileId}`}>
                  {reference.referenceUsage} · asset {reference.projectAssetId.slice(0, 8)} ·
                  SHA-256 {reference.expectedSha256}
                </p>
              ))}
            </details>
          </article>
        ))}
      </section>
      <section className="storyboardPanel">
        <h2>Review and decision</h2>
        <div className="storyboardActions">
          <button className="primaryButton" disabled={busy} onClick={() => void save()}>
            Save new version
          </button>
          <button className="panelButton" onClick={() => void preflight()}>
            Run preflight
          </button>
          <button className="primaryButton" disabled={busy} onClick={() => void decide("APPROVED")}>
            Approve Shot Plan
          </button>
          {plan.approvedVersionId && (
            <button className="panelButton" onClick={() => void decide("REVOKED")}>
              Revoke approval
            </button>
          )}
        </div>
        {blockers.length > 0 && (
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="storyboardPanel">
        <h2>Version comparison</h2>
        <div className="comparisonSelectors">
          {[0, 1].map((slot) => (
            <select
              key={slot}
              defaultValue=""
              onChange={(event) => void compare(slot as 0 | 1, event.target.value)}
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
          {comparison.map((version, index) => (
            <div key={index}>
              {version ? (
                <>
                  {version.specs.map((spec) => (
                    <p key={spec.shotKey}>
                      <strong>Shot {spec.ordinal}</strong>
                      <br />
                      {spec.positivePrompt}
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
    </main>
  );
}
