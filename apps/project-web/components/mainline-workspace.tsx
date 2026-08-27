"use client";

import { useEffect, useState } from "react";
import { CapabilityPublicationPanel } from "./capability-publication-panel";

type Capability = { ref: string; version: string; runtimeRef: { id: string; version: string } };

export function MainlineWorkspace({ projectId }: { projectId?: string }) {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [message, setMessage] = useState("Loading registered capabilities…");

  useEffect(() => {
    void fetch("/api/capabilities", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Capability registry is unavailable");
        const body = (await response.json()) as { capabilities: Capability[] };
        setCapabilities(body.capabilities);
        setMessage(
          body.capabilities.length
            ? "Select a capability to begin zero-call planning."
            : "No capability is registered.",
        );
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Unable to load capabilities"),
      );
  }, []);

  return (
    <main className="mainline-workspace">
      <h1>Capability generation</h1>
      <p>{message}</p>
      <section aria-label="Frozen planning">
        <h2>Frozen planning</h2>
        <p>
          Planning records exact implementation, runtime, adapter, graph digest, and references. It
          does not start a worker or external call.
        </p>
        <label>
          Capability
          <select disabled={capabilities.length === 0} defaultValue="">
            <option value="" disabled>
              Select a registered capability
            </option>
            {capabilities.map((capability) => (
              <option
                key={`${capability.ref}:${capability.version}`}
                value={`${capability.ref}:${capability.version}`}
              >
                {capability.ref} · {capability.version}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section aria-label="Formal batch review">
        <h2>Formal batch review</h2>
        <p>
          Review limits, price and expiry facts, artifact evidence, advisory AI quality, Owner
          decision, retry preview, and assembly here. An exact LIVE preview requires a separate
          action-time confirmation.
        </p>
        {projectId ? <p>Project: {projectId}</p> : null}
      </section>
      <CapabilityPublicationPanel />
    </main>
  );
}
