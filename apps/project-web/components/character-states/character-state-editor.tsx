"use client";

import { useEffect, useState } from "react";

interface Asset {
  id: string;
  name: string;
  type: string;
  characterProfileId: string | null;
  versions?: Array<{ id: string; versionNumber: number; status: string }>;
}

export function CharacterStateEditor({
  projectId,
  readOnly,
}: {
  projectId: string;
  readOnly: boolean;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [characterAssetId, setCharacterAssetId] = useState("");
  const [stateName, setStateName] = useState("Daily");
  const [stateKey, setStateKey] = useState("daily");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/projects/${projectId}/production-assets?limit=100`);
      const body = (await response.json()) as { assets?: Asset[] };
      setAssets(body.assets ?? []);
    })();
  }, [projectId]);
  async function createState() {
    const character = assets.find((asset) => asset.id === characterAssetId);
    const sourceVersion = character?.versions?.[0];
    if (!character?.characterProfileId || !sourceVersion) return;
    setMessage("");
    const versionResponse = await fetch(
      `/api/character-profiles/${character.characterProfileId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionAssetVersionId: sourceVersion.id }),
      },
    );
    const version = (await versionResponse.json()) as { id?: string; error?: { message: string } };
    if (!versionResponse.ok || !version.id) {
      setMessage(version.error?.message ?? "Character version could not be created");
      return;
    }
    const stateResponse = await fetch(`/api/character-versions/${version.id}/states`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stateKey, name: stateName }),
    });
    const state = (await stateResponse.json()) as { id?: string; error?: { message: string } };
    if (!stateResponse.ok || !state.id) {
      setMessage(state.error?.message ?? "State could not be created");
      return;
    }
    setMessage(
      `Draft state created. Add Outfit, Hair, Makeup, or Accessory components via the state API, then publish ${state.id}. Props intentionally belong to a future Shot binding.`,
    );
  }
  const characters = assets.filter((asset) => asset.type === "CHARACTER");
  return (
    <section className="phase2Section">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Character composition</p>
          <h2>Character versions and named states</h2>
          <p>
            A Character is stable identity. A state composes independently-versioned Outfit, Hair,
            Makeup and Accessory assets; ordinary hand props remain Shot-level.
          </p>
        </div>
      </div>
      {!readOnly && (
        <div className="phase2Form inlineForm">
          <label>
            Character
            <select
              value={characterAssetId}
              onChange={(event) => setCharacterAssetId(event.target.value)}
            >
              <option value="">Choose a Character</option>
              {characters.map((asset) => (
                <option value={asset.id} key={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            State key
            <input
              value={stateKey}
              onChange={(event) =>
                setStateKey(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
            />
          </label>
          <label>
            State name
            <input value={stateName} onChange={(event) => setStateName(event.target.value)} />
          </label>
          <button
            className="primaryButton"
            type="button"
            disabled={!characterAssetId || !stateName || !stateKey}
            onClick={() => void createState()}
          >
            Create state draft
          </button>
        </div>
      )}
      {message && <p className="candidateResult">{message}</p>}
    </section>
  );
}
