"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/language-provider";

interface AssetVersion {
  id: string;
  versionNumber: number;
  status: string;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  characterProfileId: string | null;
  versions?: AssetVersion[];
}

interface DraftState {
  id: string;
  stateKey: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  components: string[];
}

const slotTypes = ["OUTFIT", "HAIR", "MAKEUP", "ACCESSORY"] as const;

async function errorMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

function StateComposer({
  state,
  assets,
  onStateChanged,
  onMessage,
}: {
  state: DraftState;
  assets: Asset[];
  onStateChanged: (state: DraftState) => void;
  onMessage: (message: string) => void;
}) {
  const { locale, t } = useLanguage();
  const [slotType, setSlotType] = useState<(typeof slotTypes)[number]>("OUTFIT");
  const [componentAssetVersionId, setComponentAssetVersionId] = useState("");
  const [slotKey, setSlotKey] = useState("primary");
  const [busy, setBusy] = useState(false);
  const componentVersions = useMemo(
    () =>
      assets
        .filter((asset) => asset.type === slotType)
        .flatMap((asset) =>
          (asset.versions ?? [])
            .filter((version) => version.status === "ACTIVE")
            .map((version) => ({
              id: version.id,
              label: `${asset.name} · v${version.versionNumber}`,
            })),
        ),
    [assets, slotType],
  );
  const componentAvailabilityHint =
    componentVersions.length === 0
      ? "No published versions are available for this component type. Create and publish one in the Semantic catalog first."
      : !componentAssetVersionId
        ? "Select a published component version to enable Add component."
        : "";
  const componentHintId = `component-availability-${state.id}`;

  async function bindComponent() {
    if (!componentAssetVersionId || state.status !== "DRAFT") return;
    setBusy(true);
    const selected = componentVersions.find((version) => version.id === componentAssetVersionId);
    const response = await fetch(`/api/character-state-versions/${state.id}/components`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotType,
        componentAssetVersionId,
        slotKey: slotKey.trim(),
        sortOrder: state.components.length,
        required: true,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      onMessage(await errorMessage(response, "The state component could not be added"));
      return;
    }
    onStateChanged({
      ...state,
      components: [
        ...state.components,
        `${slotType}: ${selected?.label ?? componentAssetVersionId}`,
      ],
    });
    setComponentAssetVersionId("");
    onMessage(
      "Component added to the draft state. Props remain Shot-level and cannot be selected here.",
    );
  }

  async function publishState() {
    setBusy(true);
    const response = await fetch(`/api/character-state-versions/${state.id}/publish`, {
      method: "POST",
    });
    setBusy(false);
    if (!response.ok) {
      onMessage(await errorMessage(response, "The state could not be published"));
      return;
    }
    onStateChanged({ ...state, status: "ACTIVE" });
    onMessage(
      `${state.name} is now ACTIVE and immutable. Create a new state version for future changes.`,
    );
  }

  return (
    <article className="semanticCard">
      <p className="assetRole">{state.stateKey}</p>
      <h3>{state.name}</h3>
      <p>
        {t(state.status)} · {state.components.length} {locale === "zh-CN" ? "个组件" : "components"}
      </p>
      {state.components.length > 0 && (
        <ul>
          {state.components.map((component) => (
            <li key={component}>
              {component.includes(": ")
                ? `${t(component.split(": ")[0] ?? "")}${locale === "zh-CN" ? "：" : ": "}${component.split(": ").slice(1).join(": ")}`
                : component}
            </li>
          ))}
        </ul>
      )}
      {state.status === "DRAFT" && (
        <div className="phase2Form">
          <label>
            Component slot
            <select
              value={slotType}
              onChange={(event) => {
                setSlotType(event.target.value as (typeof slotTypes)[number]);
                setComponentAssetVersionId("");
              }}
            >
              {slotTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Published component version
            <select
              aria-describedby={componentAvailabilityHint ? componentHintId : undefined}
              value={componentAssetVersionId}
              onChange={(event) => setComponentAssetVersionId(event.target.value)}
            >
              <option value="">Choose a published version</option>
              {componentVersions.map((version) => (
                <option value={version.id} key={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Slot label
            <input
              value={slotKey}
              onChange={(event) => setSlotKey(event.target.value)}
              maxLength={80}
            />
          </label>
          {componentAvailabilityHint && (
            <p className="formHint" id={componentHintId} role="status">
              {componentAvailabilityHint}
              {componentVersions.length === 0 && (
                <>
                  {" "}
                  <a href="#semantic-catalog">Go to the Semantic catalog</a>
                </>
              )}
            </p>
          )}
          <div className="cardActions">
            <button
              type="button"
              aria-describedby={componentAvailabilityHint ? componentHintId : undefined}
              disabled={busy || !componentAssetVersionId}
              title={componentAvailabilityHint || undefined}
              onClick={() => void bindComponent()}
            >
              Add component
            </button>
            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => void publishState()}
            >
              Publish state
            </button>
          </div>
        </div>
      )}
    </article>
  );
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
  const [states, setStates] = useState<DraftState[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/projects/${projectId}/production-assets?limit=100`);
      const body = (await response.json()) as { assets?: Asset[]; error?: { message?: string } };
      if (!response.ok) {
        setMessage(body.error?.message ?? "Semantic assets could not be loaded");
        return;
      }
      const nextAssets = body.assets ?? [];
      setAssets(nextAssets);
      const profiles = nextAssets
        .filter((asset) => asset.type === "CHARACTER" && asset.characterProfileId)
        .map(async (asset) => {
          const profileResponse = await fetch(
            `/api/character-profiles/${asset.characterProfileId}/versions`,
          );
          const profileBody = (await profileResponse.json()) as {
            versions?: Array<{
              stateVersions: Array<{
                id: string;
                stateKey: string;
                name: string;
                status: "DRAFT" | "ACTIVE" | "RETIRED";
                components: Array<{
                  slotType: string;
                  componentAssetVersion: {
                    versionNumber: number;
                    productionAsset: { name: string };
                  };
                }>;
              }>;
            }>;
          };
          return (profileBody.versions ?? []).flatMap((version) =>
            version.stateVersions.map((state) => ({
              id: state.id,
              stateKey: state.stateKey,
              name: state.name,
              status: state.status,
              components: state.components.map(
                (component) =>
                  `${component.slotType}: ${component.componentAssetVersion.productionAsset.name} · v${component.componentAssetVersion.versionNumber}`,
              ),
            })),
          );
        });
      setStates((await Promise.all(profiles)).flat());
    })();
  }, [projectId]);

  async function createState() {
    const character = assets.find((asset) => asset.id === characterAssetId);
    const sourceVersion =
      character?.versions?.find((version) => version.status === "ACTIVE") ??
      character?.versions?.[0];
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
    setStates((value) => [
      ...value,
      { id: state.id!, stateKey, name: stateName, status: "DRAFT", components: [] },
    ]);
    setMessage(
      "Draft state created. Add independently published Outfit, Hair, Makeup, or Accessory versions, then publish it.",
    );
  }

  function replaceState(next: DraftState) {
    setStates((value) => value.map((state) => (state.id === next.id ? next : state)));
  }

  const characters = assets.filter((asset) => asset.type === "CHARACTER");
  return (
    <section className="phase2Section">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Character composition</p>
          <h2>Character versions and named states</h2>
          <p>
            A Character is stable identity. States compose Outfit, Hair, Makeup and Accessory
            versions; ordinary props remain Shot-level.
          </p>
          <p className="sectionGuidance">
            A named state is optional for general candidate preview. Publish it only when a Shot
            must lock this exact outfit, hair, makeup, or accessory combination; draft states cannot
            be used for formal Storyboard binding or approval.
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
      {message && (
        <p className="candidateResult" role="status">
          {message}
        </p>
      )}
      {states.length > 0 && (
        <div className="semanticGrid">
          {states.map((state) => (
            <StateComposer
              key={state.id}
              state={state}
              assets={assets}
              onStateChanged={replaceState}
              onMessage={setMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}
