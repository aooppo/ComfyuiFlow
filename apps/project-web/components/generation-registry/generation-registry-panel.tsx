"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../i18n/language-provider";

type Candidate = {
  candidateKey: string;
  version: string;
  sourceDigest: string;
  nodeIdentifier: string;
  status: string;
  normalizedJson: {
    runtimeRef: { id: string; version: string };
    dynamicGroups: Array<{ modality: string; prefix: string; min: number; max: number }>;
  };
};
type Implementation = {
  implementationKey: string;
  version: string;
  runtimeKey: string;
  runtimeVersion: string;
  providerKey: string;
  providerVersion: string;
  modelKey: string;
  modelVersion: string;
  adapterKey: string;
  adapterVersion: string;
  compilerKey: string;
  compilerVersion: string;
  costPolicyJson: { kind?: string };
  lifecycle: string;
};

export function GenerationRegistryPanel() {
  const { locale } = useLanguage();
  const zh = locale === "zh-CN";
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [implementations, setImplementations] = useState<Implementation[]>([]);
  const [nodeClasses, setNodeClasses] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [selectedImplementation, setSelectedImplementation] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [candidateResponse, implementationResponse] = await Promise.all([
      fetch("/api/generation-registry/discovery-candidates", { cache: "no-store" }),
      fetch("/api/generation-registry/implementations", { cache: "no-store" }),
    ]);
    const candidateBody = await candidateResponse.json();
    const implementationBody = await implementationResponse.json();
    if (!candidateResponse.ok || !implementationResponse.ok) {
      setMessage(
        zh
          ? "Registry 操作员功能尚未由服务器开启。"
          : "Registry operator access is not enabled by the server.",
      );
      return;
    }
    setCandidates(candidateBody.candidates ?? []);
    setImplementations(implementationBody.implementations ?? []);
  }, [zh]);

  useEffect(() => void load(), [load]);

  async function discover() {
    const response = await fetch("/api/generation-registry/discovery-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runtimeRef: { id: "runtime.local-comfyui", version: "1.0.0" },
        nodeClasses: nodeClasses
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setMessage(
      response.ok
        ? zh
          ? "发现完成：只保存候选，不会注册实现或提交生成。"
          : "Discovery completed: candidates only; no implementation or generation was submitted."
        : zh
          ? "发现失败；没有生成调用。"
          : "Discovery failed; no generation call was made.",
    );
    if (response.ok) await load();
  }

  async function publish() {
    const candidate = candidates.find(
      (item) => `${item.candidateKey}@${item.version}` === selectedCandidate,
    );
    const implementation = implementations.find(
      (item) => `${item.implementationKey}@${item.version}` === selectedImplementation,
    );
    if (!candidate || !implementation) return;
    const response = await fetch("/api/generation-registry/implementations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PUBLISH",
        publication: {
          id: `publication.${crypto.randomUUID()}`,
          version: "1.0.0",
          candidateRef: { id: candidate.candidateKey, version: candidate.version },
          sourceDigest: candidate.sourceDigest,
          providerRef: { id: implementation.providerKey, version: implementation.providerVersion },
          modelRef: { id: implementation.modelKey, version: implementation.modelVersion },
          adapterRef: { id: implementation.adapterKey, version: implementation.adapterVersion },
          compilerRef: { id: implementation.compilerKey, version: implementation.compilerVersion },
          implementationRef: {
            id: implementation.implementationKey,
            version: implementation.version,
          },
          costPolicy: implementation.costPolicyJson,
          reviewerRef: "operator.local",
          reviewedAt: new Date().toISOString(),
        },
      }),
    });
    const body = await response.json();
    setMessage(
      response.ok
        ? zh
          ? "已发布不可变 TRIAL 实现；尚未成为 READY。"
          : "Immutable TRIAL implementation published; it is not READY yet."
        : (body.error?.code ?? (zh ? "发布失败。" : "Publication failed.")),
    );
    if (response.ok) await load();
  }

  return (
    <section className="storyboardPanel">
      <p className="eyebrow">{zh ? "操作员 · 零生成调用" : "Operator · zero generation calls"}</p>
      <h1>{zh ? "能力 Registry 审核" : "Capability Registry review"}</h1>
      <p>
        {zh
          ? "运行时、Provider、模型、传输适配器、编译器和费用是六个独立身份。发现只产生候选；人工发布后仅进入 TRIAL。"
          : "Runtime, Provider, model, transport adapter, compiler, and cost are six separate identities. Discovery creates candidates only; reviewed publication enters TRIAL."}
      </p>
      <div className="noticePanel">
        <strong>FIRST REAL TRIAL</strong>
        <p>
          {zh
            ? "本页面不能发起真实试运行。真实调用需要另行展示确切版本、价格、1 次调用上限、有效期和不重试规则，并取得当时的新确认。"
            : "This page cannot start a real trial. A real call needs a separate action-time confirmation showing exact versions, price, one-call cap, expiry, and no-retry policy."}
        </p>
      </div>
      <label>
        {zh ? "ComfyUI 节点类（逗号分隔）" : "ComfyUI node classes (comma-separated)"}
        <input value={nodeClasses} onChange={(event) => setNodeClasses(event.target.value)} />
      </label>
      <button
        className="panelButton"
        disabled={!nodeClasses.trim()}
        onClick={() => void discover()}
      >
        {zh ? "只读发现" : "Read-only discovery"}
      </button>
      <h2>{zh ? "待审核候选" : "Candidates awaiting review"}</h2>
      <select
        value={selectedCandidate}
        onChange={(event) => setSelectedCandidate(event.target.value)}
      >
        <option value="">{zh ? "选择 DISCOVERED 候选" : "Select a DISCOVERED candidate"}</option>
        {candidates.map((candidate) => (
          <option
            key={`${candidate.candidateKey}@${candidate.version}`}
            value={`${candidate.candidateKey}@${candidate.version}`}
          >
            {candidate.nodeIdentifier} · {candidate.status} · {candidate.version}
          </option>
        ))}
      </select>
      {selectedCandidate && (
        <pre data-i18n-ignore="true">
          {JSON.stringify(
            candidates.find((item) => `${item.candidateKey}@${item.version}` === selectedCandidate)
              ?.normalizedJson.dynamicGroups ?? [],
            null,
            2,
          )}
        </pre>
      )}
      <h2>{zh ? "审核后的精确实现组合" : "Reviewed exact implementation composition"}</h2>
      <select
        value={selectedImplementation}
        onChange={(event) => setSelectedImplementation(event.target.value)}
      >
        <option value="">
          {zh
            ? "选择预登记的 DISCOVERED 实现"
            : "Select a pre-registered DISCOVERED implementation"}
        </option>
        {implementations
          .filter((item) => item.lifecycle === "DISCOVERED")
          .map((item) => (
            <option
              key={`${item.implementationKey}@${item.version}`}
              value={`${item.implementationKey}@${item.version}`}
            >
              {item.implementationKey} · {item.providerKey} · {item.modelKey} · {item.adapterKey} ·{" "}
              {item.compilerKey} · {item.costPolicyJson.kind}
            </option>
          ))}
      </select>
      <button
        className="panelButton"
        disabled={!selectedCandidate || !selectedImplementation}
        onClick={() => void publish()}
      >
        {zh ? "审核并发布为 TRIAL" : "Review and publish as TRIAL"}
      </button>
      {message && <p className="noticePanel">{message}</p>}
    </section>
  );
}
