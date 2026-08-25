"use client";
import { useState } from "react";

interface DirectorPreview {
  previewHash: string;
  providerId: string;
  modelId: string;
  scopeHash: string;
  maxShotCount: number;
  maxExternalCalls: number;
  externalCalls: number;
  maxCostUsd: number;
  priceExpiresAt: string;
  references: Array<{ assetVersionFileId: string; displayName: string }>;
  recommended: Array<{ assetVersionFileId: string; displayName: string }>;
  unselected: Array<{ assetVersionFileId: string; displayName: string }>;
  rejected: Array<{ assetVersionFileId: string; reason: string }>;
}
interface ProposalShot {
  shotKey: string;
  ordinal: number;
  title: string;
  creativeDescription: string;
  startState: string;
  action: string;
  endState: string;
  camera: string;
  composition: string;
  continuityRequirements: string[];
  durationSeconds: number;
  referenceAliases: string[];
}
interface DirectorProposal {
  id: string;
  narrativeSummary: string;
  normalizedProposalJson: { narrativeSummary: string; shots: ProposalShot[] };
  references: Array<{ alias: string; displayName: string }>;
}

export function StoryboardDirectorPanel({
  storyboardId,
  etag,
  disabled,
  onAdopted,
}: {
  storyboardId: string;
  etag: string;
  disabled: boolean;
  onAdopted: () => Promise<void>;
}) {
  const [profileId, setProfileId] = useState("fake-storyboard-v2");
  const [maxShotCount, setMaxShotCount] = useState(3);
  const [preview, setPreview] = useState<DirectorPreview | null>(null);
  const [proposal, setProposal] = useState<DirectorProposal | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectionMatchesPreview =
    Boolean(preview) &&
    selectedReferenceIds.join(",") ===
      preview!.references.map((reference) => reference.assetVersionFileId).join(",");
  async function call<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok)
      throw new Error((body as { error?: { message?: string } }).error?.message ?? "操作失败");
    return body as T;
  }
  async function doPreview() {
    setBusy(true);
    setMessage("");
    setConfirmed(false);
    try {
      const value = await call<DirectorPreview>(
        `/api/storyboards/${storyboardId}/director-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            maxShotCount,
            ...(selectedReferenceIds.length
              ? { selectedAssetVersionFileIds: selectedReferenceIds }
              : {}),
          }),
        },
      );
      setPreview(value);
      setSelectedReferenceIds(value.references.map((reference) => reference.assetVersionFileId));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "预览失败");
    } finally {
      setBusy(false);
    }
  }
  async function queue() {
    if (!preview) return;
    setBusy(true);
    try {
      const run = await call<{ id: string }>(`/api/storyboards/${storyboardId}/director-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "If-Match": etag },
        body: JSON.stringify({
          profileId,
          maxShotCount,
          selectedAssetVersionFileIds: preview.references.map(
            (reference) => reference.assetVersionFileId,
          ),
          previewHash: preview.previewHash,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setMessage(`已排队：${run.id}。Worker 将只尝试一次。`);
      await pollRun(run.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "排队失败");
    } finally {
      setBusy(false);
    }
  }
  async function pollRun(runId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const run = await call<{ status: string; proposal?: { id: string } }>(
        `/api/storyboard-director-runs/${runId}`,
      );
      if (run.status === "COMPLETED" && run.proposal) {
        setProposal(
          await call<DirectorProposal>(`/api/storyboard-director-proposals/${run.proposal.id}`),
        );
        setMessage("提案已完成；当前分镜和审批尚未改变。");
        return;
      }
      if (["FAILED", "AMBIGUOUS"].includes(run.status)) {
        setMessage(
          run.status === "AMBIGUOUS"
            ? "结果状态不确定，授权已消费且不会重试。"
            : "提案失败，授权已消费且不会重试。",
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setMessage("提案仍在排队，可稍后刷新；系统不会自动重试。");
  }
  function toggleSelectedReference(id: string, checked: boolean) {
    setSelectedReferenceIds((current) =>
      checked
        ? [...new Set([...current, id])].slice(0, 9)
        : current.filter((value) => value !== id),
    );
    setConfirmed(false);
  }
  async function loadProposals() {
    setBusy(true);
    try {
      const list = await call<Array<{ id: string }>>(
        `/api/storyboards/${storyboardId}/director-proposals`,
      );
      if (!list[0]) throw new Error("尚无已完成提案，请等待 Worker");
      setProposal(await call<DirectorProposal>(`/api/storyboard-director-proposals/${list[0].id}`));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "读取失败");
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    if (!proposal) return;
    await call(`/api/storyboard-director-proposals/${proposal.id}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), note: "用户拒绝此提案" }),
    });
    setMessage("已拒绝；当前分镜未改变。");
  }
  async function adopt() {
    if (!proposal) return;
    const value = proposal.normalizedProposalJson;
    await call(`/api/storyboard-director-proposals/${proposal.id}/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "If-Match": etag },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        narrativeSummary: value.narrativeSummary,
        shots: value.shots,
      }),
    });
    setMessage("已采用为新版本；原有历史已保留。");
    await onAdopted();
  }
  function editShot(index: number, field: "title" | "creativeDescription", value: string) {
    setProposal((current) =>
      current
        ? {
            ...current,
            normalizedProposalJson: {
              ...current.normalizedProposalJson,
              shots: current.normalizedProposalJson.shots.map((shot, shotIndex) =>
                shotIndex === index ? { ...shot, [field]: value } : shot,
              ),
            },
          }
        : current,
    );
  }
  function toggleReference(index: number, alias: string, checked: boolean) {
    setProposal((current) =>
      current
        ? {
            ...current,
            normalizedProposalJson: {
              ...current.normalizedProposalJson,
              shots: current.normalizedProposalJson.shots.map((shot, shotIndex) =>
                shotIndex === index
                  ? {
                      ...shot,
                      referenceAliases: checked
                        ? [...new Set([...shot.referenceAliases, alias])]
                        : shot.referenceAliases.filter((value) => value !== alias),
                    }
                  : shot,
              ),
            },
          }
        : current,
    );
  }
  return (
    <section className="storyboardSection">
      <h2>AI 导演提案</h2>
      <p>先生成独立提案，只有明确采用后才会创建新分镜版本。</p>
      <div className="storyboardActions">
        <label>
          Provider{" "}
          <select
            value={profileId}
            onChange={(e) => {
              setProfileId(e.target.value);
              setPreview(null);
            }}
          >
            <option value="fake-storyboard-v2">Fake（零调用）</option>
            <option value="codexmanager-terra">CodexManager Local · gpt-5.6-terra</option>
            <option value="openai-terra">OpenAI · gpt-5.6-terra</option>
          </select>
        </label>
        <label>
          最多镜头{" "}
          <input
            type="number"
            min={1}
            max={20}
            value={maxShotCount}
            onChange={(e) => setMaxShotCount(Number(e.target.value))}
          />
        </label>
        <button disabled={busy || disabled} onClick={() => void doPreview()}>
          零调用预览
        </button>
      </div>
      {preview && (
        <div className="noticePanel">
          <p>
            已确认参考图 {preview.references.length} 张；最多 {preview.maxShotCount}{" "}
            镜；最多外部调用 {preview.maxExternalCalls} 次；自动重试 0；当前预览外部调用{" "}
            {preview.externalCalls}。
          </p>
          <p>
            单次成本上限 USD {preview.maxCostUsd}；价格有效至{" "}
            {new Date(preview.priceExpiresAt).toLocaleString("zh-CN")}。
          </p>
          <fieldset>
            <legend>确认本次参考图（1–9 张）</legend>
            {[...preview.recommended, ...preview.unselected]
              .filter(
                (reference, index, values) =>
                  values.findIndex(
                    (item) => item.assetVersionFileId === reference.assetVersionFileId,
                  ) === index,
              )
              .map((reference) => (
                <label key={reference.assetVersionFileId}>
                  <input
                    type="checkbox"
                    checked={selectedReferenceIds.includes(reference.assetVersionFileId)}
                    onChange={(event) =>
                      toggleSelectedReference(reference.assetVersionFileId, event.target.checked)
                    }
                  />
                  {reference.displayName}
                </label>
              ))}
            {!selectionMatchesPreview && (
              <button onClick={() => void doPreview()}>按选择更新预览</button>
            )}
          </fieldset>
          {preview.rejected.length > 0 && (
            <details>
              <summary>查看未采用素材及原因（{preview.rejected.length}）</summary>
              <ul>
                {preview.rejected.map((reference) => (
                  <li key={reference.assetVersionFileId}>{reference.reason}</li>
                ))}
              </ul>
            </details>
          )}
          <details>
            <summary>技术与上传范围</summary>
            <code>
              {preview.providerId} / {preview.modelId} / {preview.scopeHash}
            </code>
          </details>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!selectionMatchesPreview}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            我确认素材将上传给所选 Provider，且授权最多一次调用。
          </label>
          <button
            disabled={busy || !confirmed || !selectionMatchesPreview}
            onClick={() => void queue()}
          >
            确认并排队
          </button>
        </div>
      )}
      <button disabled={busy} onClick={() => void loadProposals()}>
        刷新已完成提案
      </button>
      {proposal && (
        <div className="shotCard">
          <h3>{proposal.narrativeSummary}</h3>
          <p>下方是可编辑提案；页面后半部分保留当前版本，便于并排核对内容。</p>
          {proposal.normalizedProposalJson.shots.map((shot, index) => (
            <article key={shot.shotKey}>
              <label>
                镜头 {shot.ordinal} 标题
                <input
                  value={shot.title}
                  onChange={(event) => editShot(index, "title", event.target.value)}
                />
              </label>
              <label>
                创意描述
                <textarea
                  value={shot.creativeDescription}
                  onChange={(event) => editShot(index, "creativeDescription", event.target.value)}
                />
              </label>
              <fieldset>
                <legend>本镜使用的确认参考（至少一张）</legend>
                {proposal.references.map((reference) => (
                  <label key={reference.alias}>
                    <input
                      type="checkbox"
                      checked={shot.referenceAliases.includes(reference.alias)}
                      onChange={(event) =>
                        toggleReference(index, reference.alias, event.target.checked)
                      }
                    />
                    {reference.displayName}
                  </label>
                ))}
              </fieldset>
            </article>
          ))}
          <div className="storyboardActions">
            <button onClick={() => void reject()}>拒绝提案</button>
            <button className="primaryButton" onClick={() => void adopt()}>
              采用为新版本
            </button>
          </div>
        </div>
      )}
      {message && <p className="noticePanel">{message}</p>}
    </section>
  );
}
