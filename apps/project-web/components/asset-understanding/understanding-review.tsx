"use client";

import { useCallback, useEffect, useState } from "react";

interface Revision {
  id: string;
  ordinal: number;
  authorType: string;
  facts: unknown;
  createdAt: string;
  decision: string | null;
}

interface DraftTarget {
  id: string;
  label: string;
}

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

function idempotencyKey() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

export function UnderstandingReview({
  assetId,
  projectId,
}: {
  assetId: string;
  projectId: string;
}) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [approved, setApproved] = useState<Revision | null>(null);
  const [draftTargets, setDraftTargets] = useState<DraftTarget[]>([]);
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [correctionJson, setCorrectionJson] = useState("");
  const [applicationRevisionId, setApplicationRevisionId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<
    "PRODUCTION_ASSET_DRAFT" | "ASSET_VERSION_FILE_DRAFT"
  >("PRODUCTION_ASSET_DRAFT");
  const [targetId, setTargetId] = useState("");
  const [mappingText, setMappingText] = useState("summary:summary");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [historyResponse, targetResponse] = await Promise.all([
        fetch(`/api/project-assets/${assetId}/understanding`),
        fetch(`/api/projects/${projectId}/production-assets?limit=100`),
      ]);
      const historyBody = (await historyResponse.json()) as {
        revisions?: Revision[];
        approved?: Revision | null;
        error?: { message: string };
      };
      const targetBody = (await targetResponse.json()) as {
        assets?: Array<{
          name: string;
          versions?: Array<{ id: string; versionNumber: number; status: string }>;
        }>;
        error?: { message: string };
      };
      if (!historyResponse.ok)
        throw new Error(historyBody.error?.message ?? "History could not be loaded");
      if (!targetResponse.ok)
        throw new Error(targetBody.error?.message ?? "Draft targets could not be loaded");
      setRevisions(historyBody.revisions ?? []);
      setApproved(historyBody.approved ?? null);
      setDraftTargets(
        (targetBody.assets ?? []).flatMap((asset) =>
          (asset.versions ?? [])
            .filter((version) => version.status === "DRAFT")
            .map((version) => ({
              id: version.id,
              label: `${asset.name} · v${version.versionNumber}`,
            })),
        ),
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "History could not be loaded");
    }
  }, [assetId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(revisionId: string, decision: "ACCEPTED" | "REJECTED") {
    const key = idempotencyKey();
    const response = await fetch(`/api/understanding-revisions/${revisionId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ decision, idempotencyKey: key }),
    });
    if (!response.ok) {
      setMessage(await responseMessage(response, "The review decision could not be saved"));
      return;
    }
    setMessage(
      decision === "ACCEPTED"
        ? "Revision accepted as the approved projection."
        : "Revision rejected; machine evidence remains unchanged.",
    );
    void load();
  }

  function beginCorrection(revision: Revision) {
    setEditingRevisionId(revision.id);
    setCorrectionJson(JSON.stringify(revision.facts, null, 2));
    setMessage(
      "Edit the structured facts below. Saving creates a new OWNER revision and leaves the source revision unchanged.",
    );
  }

  async function saveCorrection() {
    if (!editingRevisionId) return;
    let facts: unknown;
    try {
      facts = JSON.parse(correctionJson);
    } catch {
      setMessage("Correction must be valid JSON before it can be saved.");
      return;
    }
    const key = idempotencyKey();
    const response = await fetch(`/api/understanding-revisions/${editingRevisionId}/corrections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ facts, acceptCorrection: true, idempotencyKey: key }),
    });
    if (!response.ok) {
      setMessage(await responseMessage(response, "The owner correction could not be saved"));
      return;
    }
    setEditingRevisionId(null);
    setMessage("Owner correction saved and accepted as a new revision.");
    void load();
  }

  async function applyRevision() {
    if (!applicationRevisionId || !targetId.trim()) return;
    const fieldMappings = mappingText
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const [sourceField, targetField] = value.split(":").map((part) => part.trim());
        return { sourceField, targetField };
      })
      .filter((mapping) => mapping.sourceField && mapping.targetField);
    if (fieldMappings.length === 0) {
      setMessage("Add at least one field mapping in source:target form.");
      return;
    }
    const key = idempotencyKey();
    const response = await fetch(
      `/api/understanding-revisions/${applicationRevisionId}/applications`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          targetType,
          targetId: targetId.trim(),
          fieldMappings,
          idempotencyKey: key,
        }),
      },
    );
    if (!response.ok) {
      setMessage(await responseMessage(response, "Approved facts could not be applied"));
      return;
    }
    setApplicationRevisionId(null);
    setMessage(
      "Approved facts were explicitly applied to the selected draft target with provenance.",
    );
  }

  if (!revisions.length && !error) return null;
  return (
    <section className="understandingHistory">
      <h3>Understanding review</h3>
      <figure>
        <img
          src={`/api/assets/${assetId}/content`}
          alt="Original source used for this understanding review"
        />
        <figcaption>
          Verified original · compare every observation against this source before approval.
        </figcaption>
      </figure>
      {approved ? (
        <p className="candidateResult">
          <strong>Approved projection:</strong> owner-approved revision #{approved.ordinal}.
          Provider success alone never approves facts.
        </p>
      ) : (
        <p className="warning">
          No approved projection. Machine output cannot affect semantic assets until an owner
          accepts or corrects it.
        </p>
      )}
      {error && <p className="formError">{error}</p>}
      {message && (
        <p className="candidateResult" role="status">
          {message}
        </p>
      )}
      {revisions.map((revision) => (
        <article key={revision.id}>
          <p>
            <strong>#{revision.ordinal}</strong> · {revision.authorType.toLowerCase()} ·{" "}
            {revision.decision ?? "pending review"}
          </p>
          <pre>{JSON.stringify(revision.facts, null, 2)}</pre>
          <div className="cardActions">
            {!revision.decision && (
              <>
                <button onClick={() => void decide(revision.id, "ACCEPTED")}>Accept</button>
                <button className="dangerText" onClick={() => void decide(revision.id, "REJECTED")}>
                  Reject
                </button>
              </>
            )}
            <button onClick={() => beginCorrection(revision)}>Correct as owner</button>
            {revision.decision === "ACCEPTED" && (
              <button
                onClick={() => {
                  setApplicationRevisionId(revision.id);
                  setTargetId("");
                }}
              >
                Apply to draft…
              </button>
            )}
          </div>
          {editingRevisionId === revision.id && (
            <div className="phase2Form">
              <label>
                Owner-corrected structured facts
                <textarea
                  rows={16}
                  value={correctionJson}
                  onChange={(event) => setCorrectionJson(event.target.value)}
                />
              </label>
              <div className="cardActions">
                <button className="primaryButton" onClick={() => void saveCorrection()}>
                  Save and accept correction
                </button>
                <button onClick={() => setEditingRevisionId(null)}>Cancel</button>
              </div>
            </div>
          )}
          {applicationRevisionId === revision.id && (
            <div className="phase2Form">
              <label>
                Draft target type
                <select
                  value={targetType}
                  onChange={(event) => {
                    setTargetType(event.target.value as typeof targetType);
                    setTargetId("");
                  }}
                >
                  <option value="PRODUCTION_ASSET_DRAFT">Production asset draft</option>
                  <option value="ASSET_VERSION_FILE_DRAFT">Draft file binding</option>
                </select>
              </label>
              <label>
                Explicit target
                {targetType === "PRODUCTION_ASSET_DRAFT" ? (
                  <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                    <option value="">Choose a draft version</option>
                    {draftTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={targetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    placeholder="Draft file-binding UUID"
                  />
                )}
              </label>
              <label>
                Field mappings
                <textarea
                  rows={3}
                  value={mappingText}
                  onChange={(event) => setMappingText(event.target.value)}
                  placeholder="summary:summary"
                />
              </label>
              <p>
                Mappings are explicit and only update the selected DRAFT. Existing human fields
                remain visible for review.
              </p>
              <div className="cardActions">
                <button
                  className="primaryButton"
                  disabled={!targetId.trim()}
                  onClick={() => void applyRevision()}
                >
                  Apply approved facts
                </button>
                <button onClick={() => setApplicationRevisionId(null)}>Cancel</button>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
