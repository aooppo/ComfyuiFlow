"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductionAssetEditor } from "./production-asset-editor";

interface ProductionAssetVersionView {
  id: string;
  versionNumber: number;
  status: string;
  displayName: string;
}

interface ProductionAssetVersionDetail extends ProductionAssetVersionView {
  description: string | null;
  sourceType: string;
  publishedAt: string | null;
  files: Array<{
    id: string;
    displayName: string;
    referenceUsage: string;
    viewpoint: string;
    shotScale: string;
    approvalStatus: string;
    isPreferred: boolean;
    status: string;
  }>;
  relations: Array<{
    id: string;
    direction: "OUTGOING" | "INCOMING";
    relationType: string;
    status: string;
    relatedAssetType: string;
    relatedAssetName: string;
    relatedVersionNumber: number;
  }>;
}

interface ProductionAssetView {
  id: string;
  type: string;
  name: string;
  currentVersionId: string | null;
  rowVersion: number;
  versions?: ProductionAssetVersionView[];
}

interface ReadyProjectAsset {
  id: string;
  displayName: string;
  detectedMimeType: string;
}

const referenceUsages = [
  "IDENTITY",
  "FACE",
  "FULL_BODY",
  "OUTFIT_DETAIL",
  "PROP_DETAIL",
  "SCENE_STYLE",
  "POSE",
  "CONTROL",
  "TRAINING_SOURCE",
] as const;
const viewpoints = [
  "FRONT",
  "FRONT_THREE_QUARTER",
  "SIDE",
  "REAR_THREE_QUARTER",
  "REAR",
  "TOP",
  "LOW",
  "DETAIL",
  "UNSPECIFIED",
] as const;
const shotScales = [
  "EXTREME_CLOSE_UP",
  "CLOSE_UP",
  "MEDIUM_CLOSE_UP",
  "MEDIUM",
  "MEDIUM_FULL",
  "FULL",
  "WIDE",
  "EXTREME_WIDE",
  "UNSPECIFIED",
] as const;
const relationTypes = [
  "DEFAULT_VOICE",
  "IDENTITY_LORA",
  "REQUIRES",
  "COMPATIBLE_WITH",
  "PART_OF",
  "DERIVED_FROM",
] as const;

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

function DraftVersionActions({
  version,
  readyAssets,
  relationTargets,
  onChanged,
}: {
  version: ProductionAssetVersionView;
  readyAssets: ReadyProjectAsset[];
  relationTargets: Array<{ id: string; label: string }>;
  onChanged: (message: string) => void;
}) {
  const [projectAssetId, setProjectAssetId] = useState("");
  const [referenceUsage, setReferenceUsage] =
    useState<(typeof referenceUsages)[number]>("IDENTITY");
  const [viewpoint, setViewpoint] = useState<(typeof viewpoints)[number]>("UNSPECIFIED");
  const [shotScale, setShotScale] = useState<(typeof shotScales)[number]>("UNSPECIFIED");
  const [relationTargetId, setRelationTargetId] = useState("");
  const [relationType, setRelationType] = useState<(typeof relationTypes)[number]>("REQUIRES");
  const [busy, setBusy] = useState(false);

  async function bindFile() {
    if (!projectAssetId) return;
    setBusy(true);
    const response = await fetch(`/api/production-asset-versions/${version.id}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectAssetId,
        referenceUsage,
        viewpoint,
        shotScale,
        isPreferred: false,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      onChanged(await responseMessage(response, "The READY file could not be bound"));
      return;
    }
    setProjectAssetId("");
    onChanged("READY file purpose binding saved to this draft version.");
  }

  async function addRelation() {
    if (!relationTargetId) return;
    setBusy(true);
    const response = await fetch(`/api/production-asset-versions/${version.id}/relations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toAssetVersionId: relationTargetId, relationType }),
    });
    setBusy(false);
    if (!response.ok) {
      onChanged(await responseMessage(response, "The semantic relation could not be saved"));
      return;
    }
    setRelationTargetId("");
    onChanged("Semantic version relation saved.");
  }

  return (
    <div className="phase2Form">
      <p>
        <strong>Bind a verified source file</strong>
      </p>
      <label>
        READY file
        <select value={projectAssetId} onChange={(event) => setProjectAssetId(event.target.value)}>
          <option value="">Choose a READY file</option>
          {readyAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.displayName} · {asset.detectedMimeType}
            </option>
          ))}
        </select>
      </label>
      <label>
        Purpose
        <select
          value={referenceUsage}
          onChange={(event) =>
            setReferenceUsage(event.target.value as (typeof referenceUsages)[number])
          }
        >
          {referenceUsages.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Viewpoint
        <select
          value={viewpoint}
          onChange={(event) => setViewpoint(event.target.value as (typeof viewpoints)[number])}
        >
          {viewpoints.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Shot scale
        <select
          value={shotScale}
          onChange={(event) => setShotScale(event.target.value as (typeof shotScales)[number])}
        >
          {shotScales.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={busy || !projectAssetId} onClick={() => void bindFile()}>
        Bind file
      </button>
      <p>
        <strong>Relate another semantic version (optional)</strong>
        <small className="fieldGuidance">
          Leave this blank unless the current version depends on, is compatible with, or derives
          from another exact version. Add one relation at a time; multiple relations are allowed.
        </small>
      </p>
      <label>
        Target version (optional)
        <select
          value={relationTargetId}
          onChange={(event) => setRelationTargetId(event.target.value)}
        >
          <option value="">Choose another version</option>
          {relationTargets
            .filter((target) => target.id !== version.id)
            .map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
        </select>
      </label>
      <label>
        Relation
        <select
          value={relationType}
          onChange={(event) =>
            setRelationType(event.target.value as (typeof relationTypes)[number])
          }
        >
          {relationTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={busy || !relationTargetId} onClick={() => void addRelation()}>
        Add relation
      </button>
    </div>
  );
}

function CollapsibleDraftActions({
  version,
  readyAssets,
  relationTargets,
  onChanged,
  onPublish,
}: {
  version: ProductionAssetVersionView;
  readyAssets: ReadyProjectAsset[];
  relationTargets: Array<{ id: string; label: string }>;
  onChanged: (message: string) => void;
  onPublish: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="draftActions">
      <button
        className="versionTextButton"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Collapse draft" : "Edit draft"}
      </button>
      {expanded && (
        <>
          <DraftVersionActions
            version={version}
            readyAssets={readyAssets}
            relationTargets={relationTargets}
            onChanged={onChanged}
          />
          <button className="panelButton" type="button" onClick={() => void onPublish()}>
            Publish
          </button>
        </>
      )}
    </div>
  );
}

function VersionDetails({
  version,
  readOnly,
  onCreateDraftFrom,
}: {
  version: ProductionAssetVersionView;
  readOnly: boolean;
  onCreateDraftFrom: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ProductionAssetVersionDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (detail) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/production-asset-versions/${version.id}`);
    const body = (await response.json().catch(() => null)) as
      (ProductionAssetVersionDetail & { error?: { message?: string } }) | null;
    setBusy(false);
    if (!response.ok || !body) {
      setError(body?.error?.message ?? "Version details could not be loaded");
      return;
    }
    setDetail(body);
  }

  return (
    <div className="versionDetailsControl">
      <button
        className="versionTextButton"
        type="button"
        aria-expanded={expanded}
        onClick={() => void toggle()}
      >
        {expanded ? "Hide details" : "View details"}
      </button>
      {expanded && (
        <div className="versionDetails">
          {busy && <p>Loading version details…</p>}
          {error && <p className="formError">{error}</p>}
          {detail && (
            <>
              <p>
                <strong>Description:</strong> {detail.description || "No description"}
              </p>
              <p>
                <strong>Source:</strong> {detail.sourceType}
              </p>
              {detail.publishedAt && (
                <p>
                  <strong>Published at:</strong> {new Date(detail.publishedAt).toLocaleString()}
                </p>
              )}
              <strong>File bindings</strong>
              {detail.files.length === 0 ? (
                <p>No file bindings</p>
              ) : (
                <ul>
                  {detail.files.map((file) => (
                    <li key={file.id}>
                      {file.displayName} · {file.referenceUsage} · {file.viewpoint} ·{" "}
                      {file.shotScale}
                      {file.isPreferred ? " · Preferred" : ""} · {file.approvalStatus}
                    </li>
                  ))}
                </ul>
              )}
              <strong>Relations</strong>
              {detail.relations.length === 0 ? (
                <p>No relations</p>
              ) : (
                <ul>
                  {detail.relations.map((relation) => (
                    <li key={relation.id}>
                      {relation.direction} · {relation.relationType} · {relation.relatedAssetType} ·{" "}
                      {relation.relatedAssetName} v{relation.relatedVersionNumber}
                    </li>
                  ))}
                </ul>
              )}
              {version.status !== "DRAFT" && (
                <p className="immutableNote">
                  Published versions are immutable. Create a draft from this version to make
                  changes.
                </p>
              )}
              {!readOnly && version.status !== "DRAFT" && (
                <button
                  className="panelButton"
                  type="button"
                  onClick={() => void onCreateDraftFrom()}
                >
                  Create draft from this version
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ProductionAssetLibrary({
  projectId,
  readOnly,
}: {
  projectId: string;
  readOnly: boolean;
}) {
  const [assets, setAssets] = useState<ProductionAssetView[]>([]);
  const [readyAssets, setReadyAssets] = useState<ReadyProjectAsset[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    try {
      const [semanticResponse, filesResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/production-assets?limit=100`),
        fetch(`/api/projects/${projectId}/assets?status=READY&limit=100`),
      ]);
      const semanticBody = (await semanticResponse.json()) as {
        assets?: ProductionAssetView[];
        error?: { message: string };
      };
      const filesBody = (await filesResponse.json()) as {
        assets?: ReadyProjectAsset[];
        error?: { message: string };
      };
      if (!semanticResponse.ok)
        throw new Error(semanticBody.error?.message ?? "Semantic assets could not be loaded");
      if (!filesResponse.ok)
        throw new Error(filesBody.error?.message ?? "READY files could not be loaded");
      setAssets(semanticBody.assets ?? []);
      setReadyAssets(filesBody.assets ?? []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Semantic assets could not be loaded");
    }
  }, [projectId, revision]);
  useEffect(() => {
    void load();
  }, [load]);

  const relationTargets = useMemo(
    () =>
      assets.flatMap((asset) =>
        (asset.versions ?? []).map((version) => ({
          id: version.id,
          label: `${asset.name} · v${version.versionNumber} · ${version.status}`,
        })),
      ),
    [assets],
  );

  async function publish(asset: ProductionAssetView, versionId: string) {
    setMessage("");
    const response = await fetch(`/api/production-asset-versions/${versionId}/publish`, {
      method: "POST",
      headers: { "If-Match": `"${asset.rowVersion}"` },
    });
    if (!response.ok) {
      setMessage(
        `${await responseMessage(response, "Version could not be published")} Refresh before retrying; another edit may have changed this asset.`,
      );
      return;
    }
    setMessage("Version published. Any previous ACTIVE version is now historical.");
    setRevision((value) => value + 1);
  }

  async function createVersion(asset: ProductionAssetView, basedOnVersionId?: string) {
    setMessage("");
    const response = await fetch(`/api/production-assets/${asset.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "If-Match": `"${asset.rowVersion}"` },
      body: JSON.stringify(basedOnVersionId ? { basedOnVersionId } : {}),
    });
    if (!response.ok) {
      setMessage(
        `${await responseMessage(response, "Draft version could not be created")} Refresh before retrying; another edit may have changed this asset.`,
      );
      return;
    }
    setMessage(
      basedOnVersionId
        ? "A new editable draft was created from the selected historical version."
        : "A new draft version was created from the current version.",
    );
    setRevision((value) => value + 1);
  }

  return (
    <section className="phase2Section" id="semantic-catalog">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Semantic catalog</p>
          <h2>Characters, outfits, props and more</h2>
          <p>
            File assets are evidence; semantic assets are reusable creative identities and version
            history.
          </p>
        </div>
      </div>
      {!readOnly && (
        <ProductionAssetEditor
          projectId={projectId}
          onCreated={() => setRevision((value) => value + 1)}
        />
      )}
      {error && <p className="formError">{error}</p>}
      {message && (
        <p className="candidateResult" role="status">
          {message}
        </p>
      )}
      <div className="semanticGrid">
        {assets.map((asset) => (
          <article className="semanticCard" key={asset.id}>
            <p className="assetRole">{asset.type}</p>
            <h3>{asset.name}</h3>
            <p>
              {asset.currentVersionId ? "Active version available" : "Draft only"} · revision{" "}
              {asset.rowVersion}
            </p>
            <div className="versionList">
              {asset.versions?.map((version) => (
                <div className="versionEditor" key={version.id}>
                  <span>
                    v{version.versionNumber} · {version.status}
                  </span>
                  <VersionDetails
                    version={version}
                    readOnly={readOnly}
                    onCreateDraftFrom={() => createVersion(asset, version.id)}
                  />
                  {version.status === "DRAFT" && !readOnly && (
                    <CollapsibleDraftActions
                      version={version}
                      readyAssets={readyAssets}
                      relationTargets={relationTargets}
                      onChanged={setMessage}
                      onPublish={() => publish(asset, version.id)}
                    />
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <button className="panelButton" onClick={() => void createVersion(asset)}>
                New draft version
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
