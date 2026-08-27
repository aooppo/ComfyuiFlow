"use client";

import { useState } from "react";

const template = {
  schemaVersion: 1,
  packId: "minimax-h3-reference-video",
  packVersion: "1.0.0",
  runtimeTargetRef: { id: "runtime.comfy-partner", version: "1.0.0" },
  model: { id: "model.minimax-h3", version: "1.0.0", availabilityKey: "minimax-h3-partner" },
  compilerProfile: "h3-reference-video-v1",
  compilerBinding: {
    modelNode: {
      classType: "MinimaxHailuo03ReferenceNode",
      promptInput: "model.prompt",
      durationSecondsInput: "model.duration",
      ratioInput: "model.ratio",
    },
    outputNode: { classType: "SaveVideo", videoInput: "video", outputMediaKey: "videos" },
  },
  allowedIntentModes: ["reference-video"],
  parameterEnvelope: {
    images: { min: 1, max: 9 },
    durationSeconds: [4, 15],
    ratios: ["16:9"],
    resolutions: ["2K"],
  },
  requiredNodes: ["LoadImage", "MinimaxHailuo03ReferenceNode", "SaveVideo"],
};

export function CapabilityPublicationPanel() {
  const [token, setToken] = useState("");
  const [actorRef, setActorRef] = useState("local-admin");
  const [manifest, setManifest] = useState(() => JSON.stringify(template, null, 2));
  const [message, setMessage] = useState("先检查并补全摘要；确认内容后再导入为 TRIAL。");

  async function request(method: "POST" | "PUT", body: unknown) {
    const response = await fetch("/api/admin/capability-packs", {
      method,
      headers: {
        "content-type": "application/json",
        "x-capability-publication-token": token,
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as {
      code?: string;
      manifest?: unknown;
      receiptId?: string;
    };
    if (!response.ok) throw new Error(result.code ?? "请求未完成");
    return result;
  }

  async function canonicalize() {
    try {
      const result = await request("PUT", JSON.parse(manifest));
      setManifest(JSON.stringify(result.manifest, null, 2));
      setMessage("摘要已由服务端按规范生成。请复核模型、运行目标、节点白名单和参数范围。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "能力包格式无效");
    }
  }

  async function publish() {
    try {
      const result = await request("POST", { actorRef, manifest: JSON.parse(manifest) });
      setMessage(`已写入不可变 TRIAL 收据：${result.receiptId ?? "已完成"}。没有发起生成。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入被拒绝");
    }
  }

  return (
    <section aria-label="Capability Pack 导入">
      <h2>导入新能力</h2>
      <p>
        这里不是逐图审批。它只把经过审核的能力包登记为 TRIAL；每个 Shot
        的图仍由服务端编译、冻结和零调用校验。
      </p>
      <label>
        本地管理员口令
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        操作人标识
        <input value={actorRef} onChange={(event) => setActorRef(event.target.value)} />
      </label>
      <label>
        Capability Pack JSON
        <textarea
          value={manifest}
          onChange={(event) => setManifest(event.target.value)}
          rows={24}
          spellCheck={false}
        />
      </label>
      <p>{message}</p>
      <button type="button" onClick={() => void canonicalize()}>
        检查并生成摘要
      </button>
      <button type="button" onClick={() => void publish()}>
        导入为 TRIAL（不生成）
      </button>
    </section>
  );
}
