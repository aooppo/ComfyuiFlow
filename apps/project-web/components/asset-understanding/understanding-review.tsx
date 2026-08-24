"use client";

import { useEffect, useState } from "react";

interface Revision {
  id: string;
  ordinal: number;
  authorType: string;
  facts: unknown;
  createdAt: string;
  decision: string | null;
}

export function UnderstandingReview({ assetId }: { assetId: string }) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      const response = await fetch(`/api/project-assets/${assetId}/understanding`);
      const body = (await response.json()) as {
        revisions?: Revision[];
        error?: { message: string };
      };
      if (!response.ok) throw new Error(body.error?.message ?? "History could not be loaded");
      setRevisions(body.revisions ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "History could not be loaded");
    }
  }
  useEffect(() => {
    void load();
  }, [assetId]);
  async function decide(revisionId: string, decision: "ACCEPTED" | "REJECTED") {
    const key = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const response = await fetch(`/api/understanding-revisions/${revisionId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ decision, idempotencyKey: key }),
    });
    if (response.ok) void load();
  }
  if (!revisions.length && !error) return null;
  return (
    <section className="understandingHistory">
      <h3>Understanding history</h3>
      {error && <p className="formError">{error}</p>}
      {revisions.map((revision) => (
        <article key={revision.id}>
          <p>
            <strong>#{revision.ordinal}</strong> · {revision.authorType.toLowerCase()} ·{" "}
            {revision.decision ?? "pending review"}
          </p>
          <pre>{JSON.stringify(revision.facts, null, 2)}</pre>
          {!revision.decision && (
            <div className="cardActions">
              <button onClick={() => void decide(revision.id, "ACCEPTED")}>Accept</button>
              <button className="dangerText" onClick={() => void decide(revision.id, "REJECTED")}>
                Reject
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
