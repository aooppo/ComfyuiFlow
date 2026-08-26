"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/language-provider";
import { FinalOwnerReviewPanel } from "./final-owner-review-panel";
import { GenerationBatchPanel } from "./generation-batch-panel";
import { WorkflowPlanningPanel } from "./workflow-planning-panel";

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

interface ExecutionPreview {
  generationPlanVersionId: string;
  retryOfJobId: string | null;
  retryRequirements: string | null;
  previewHash: string;
  ready: boolean;
  maximumGenerationCalls: number;
  maximumAiQaCalls: number;
  aiQaProviderId: string;
  aiQaModelId: string;
  continuityProfileVersionId: string | null;
  keyframePlanVersionId: string | null;
  continuityScopeHash: string | null;
  provider: {
    profileId: "fake-video-v1" | "minimax-h3-4s-v1";
    providerId: string;
    modelId: string;
    workflowId: string;
    workflowVersion: string;
    workflowSha256: string;
    costEstimateUsd: number | null;
    videoControlTier: "ORDINARY_REFERENCE" | "LOCKED_START" | "LOCKED_START_END";
  };
  shots: Array<{
    generationSpecId: string;
    ordinal: number;
    compatible: boolean;
    blockers: string[];
    promptSummary: string;
    slots: Array<{
      role: string;
      projectAssetId: string;
      displayName: string;
      sha256: string;
      sourceKind?: "PROJECT_ASSET" | "KEYFRAME_ARTIFACT";
      keyframeArtifactId?: string;
    }>;
    continuity: null | {
      startBoundaryHash: string;
      endBoundaryHash: string;
      startKeyframeArtifactId: string;
      startKeyframeHash: string;
      endKeyframeArtifactId: string;
      endKeyframeHash: string;
      endKeyframeSoftTarget: boolean;
      warnings: string[];
    };
  }>;
}

interface ContinuitySummary {
  profile: null | {
    headVersion: {
      id: string;
      keyframePlans: Array<{ id: string; status: string; createdAt: string }>;
    };
  };
}

interface BatchView {
  id: string;
  engineVersion?: "LEGACY_V1" | "WORKFLOW_AGENT_V1";
  status: string;
  createdAt: string;
  providerProfileId: "fake-video-v1" | "minimax-h3-4s-v1" | null;
  rowVersion: number;
  jobs: Array<{
    id: string;
    status: string;
    safeResultCode: string;
    generationBatchTarget: { generationSpecId: string; ordinal: number };
    artifacts: Array<{
      id: string;
      technicalChecks: Array<{
        status: string;
        width: number;
        height: number;
        durationSeconds: number;
      }>;
      reviewFrames: Array<{ role: string }>;
      aiQaRuns: Array<{
        status: string;
        result: null | { overallStatus: string; summary: string };
      }>;
      humanQaDecisions: Array<{ decision: string; notes: string | null }>;
    }>;
  }>;
  authorization: {
    maximumGenerationCalls: number;
    maximumAiQaCalls: number;
    consumptions: Array<{ operation: string }>;
  } | null;
  finalOwnerReview?: {
    schemaVersion: "final-owner-review-v1";
    ready: boolean;
    ownerDecisionRequired: boolean;
    items: Array<{
      ordinal: number;
      generationSpecId: string;
      artifactId: string | null;
      technicalStatus: string;
      aiQaStatus: string | null;
      continuationDecision: string | null;
      humanDecision: string | null;
      ownerDecisionRequired: boolean;
    }>;
  };
}

interface AssemblySourceView {
  ordinal: number;
  generationSpecId: string;
  artifactId: string;
  sha256: string;
  byteSize: number;
  detectedMimeType: string;
}

interface PlanAssemblyView {
  id: string;
  sourceSetHash: string;
  sha256: string;
  byteSize: number;
  detectedMimeType: string;
  container: string;
  videoCodec: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  hasAudio: boolean;
  assemblerVersion: string;
  createdAt: string;
  stale: boolean;
  contentUrl: string;
  downloadUrl: string;
  sources: AssemblySourceView[];
}

interface PlanAssemblyState {
  eligible: boolean;
  approvedVersionId: string;
  missingOrdinals: number[];
  sourceSetHash: string | null;
  sources: AssemblySourceView[];
  currentAssembly: PlanAssemblyView | null;
  assemblies: PlanAssemblyView[];
}

interface PlanDraftState {
  eligible: boolean;
  missingOrdinals: number[];
  sourceSetHash: string | null;
  warnings: Array<{ ordinal: number; warning: string }>;
  currentDraft: null | {
    id: string;
    contentUrl: string;
    downloadUrl: string;
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    createdAt: string;
    warnings: Array<{ ordinal: number; warning: string }>;
  };
  history: Array<{ id: string; stale: boolean; createdAt: string; contentUrl: string }>;
}

const activeBatchStatuses = new Set(["QUEUED", "RUNNING", "PAUSED", "AWAITING_HUMAN_QA"]);

function batchBlocksNewConfirmation(batch: BatchView | null) {
  if (!batch) return false;
  if (["QUEUED", "RUNNING", "AWAITING_HUMAN_QA"].includes(batch.status)) return true;
  if (batch.status !== "PAUSED") return false;
  return (
    (batch.authorization?.consumptions.length ?? 0) > 0 ||
    batch.jobs.some((job) => job.status !== "QUEUED")
  );
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
  const { locale, t } = useLanguage();
  const isChinese = locale === "zh-CN";
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
  const [selectedForGeneration, setSelectedForGeneration] = useState<string[]>([]);
  const [providerProfile, setProviderProfile] = useState<"fake-video-v1" | "minimax-h3-4s-v1">(
    "fake-video-v1",
  );
  const [executionPreview, setExecutionPreview] = useState<ExecutionPreview | null>(null);
  const [batch, setBatch] = useState<BatchView | null>(null);
  const [batchHistory, setBatchHistory] = useState<BatchView[]>([]);
  const [retryOfJobId, setRetryOfJobId] = useState<string | null>(null);
  const [retryRequirements, setRetryRequirements] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [assemblyState, setAssemblyState] = useState<PlanAssemblyState | null>(null);
  const [draftState, setDraftState] = useState<PlanDraftState | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [approvedKeyframePlanId, setApprovedKeyframePlanId] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<"workflow-agent-v1" | "legacy-v1">(
    "workflow-agent-v1",
  );
  const retryPanelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const [planResponse, versionsResponse, continuityResponse, readinessResponse] =
      await Promise.all([
        fetch(`/api/generation-plans/${planId}`),
        fetch(`/api/generation-plans/${planId}/versions`),
        fetch(`/api/storyboards/${storyboardId}/continuity`),
        fetch(`/api/projects/${projectId}/generation-readiness`),
      ]);
    const body = (await planResponse.json()) as PlanView & { error?: { message: string } };
    if (!planResponse.ok) throw new Error(body.error?.message ?? "Shot plan could not be loaded");
    const history = (await versionsResponse.json()) as {
      versions: Array<Omit<VersionView, "specs">>;
    };
    setPlan(body);
    setSpecs(body.headVersion.specs);
    setSelectedForGeneration((current) =>
      current.length ? current : body.headVersion.specs.map((spec) => spec.id),
    );
    setVersions(history.versions ?? []);
    if (readinessResponse.ok) {
      const readiness = (await readinessResponse.json()) as {
        engineMode: "workflow-agent-v1" | "legacy-v1";
      };
      setEngineMode(readiness.engineMode);
    } else setEngineMode("workflow-agent-v1");
    if (continuityResponse.ok) {
      const continuity = (await continuityResponse.json()) as ContinuitySummary;
      setApprovedKeyframePlanId(
        continuity.profile?.headVersion.keyframePlans.find((item) => item.status === "APPROVED")
          ?.id ?? null,
      );
    } else {
      setApprovedKeyframePlanId(null);
    }
    setEtag(planResponse.headers.get("etag") ?? `"generation-plan-${body.rowVersion}"`);
    if (body.approvedVersionId) {
      const [batchResponse, assemblyResponse, draftResponse] = await Promise.all([
        fetch(
          `/api/generation-batches?generationPlanVersionId=${encodeURIComponent(body.approvedVersionId)}`,
        ),
        fetch(`/api/generation-plans/${planId}/assemblies`),
        fetch(`/api/generation-plans/${planId}/drafts`),
      ]);
      if (batchResponse.ok) {
        const loaded = (await batchResponse.json()) as {
          batch: BatchView | null;
          batches?: BatchView[];
        };
        setBatch(loaded.batch);
        setBatchHistory(loaded.batches ?? (loaded.batch ? [loaded.batch] : []));
        if (loaded.batch) {
          if (loaded.batch.providerProfileId) setProviderProfile(loaded.batch.providerProfileId);
          if (batchBlocksNewConfirmation(loaded.batch)) {
            setSelectedForGeneration(
              loaded.batch.jobs.map((job) => job.generationBatchTarget.generationSpecId),
            );
          }
        }
      }
      if (assemblyResponse.ok) {
        setAssemblyState((await assemblyResponse.json()) as PlanAssemblyState);
      }
      if (draftResponse.ok) setDraftState((await draftResponse.json()) as PlanDraftState);
    } else {
      setBatch(null);
      setBatchHistory([]);
      setAssemblyState(null);
      setDraftState(null);
    }
  }, [planId, projectId, storyboardId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Shot plan could not be loaded"),
    );
  }, [load]);

  useEffect(() => {
    if (!batch || !activeBatchStatuses.has(batch.status)) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/generation-batches/${batch.id}`)
        .then(async (response) => {
          if (response.ok) {
            const refreshed = (await response.json()) as BatchView;
            setBatch(refreshed);
            setBatchHistory((current) =>
              current.map((item) => (item.id === refreshed.id ? refreshed : item)),
            );
          }
        })
        .catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [batch?.id, batch?.status]);

  useEffect(() => {
    if (!retryOfJobId) return;
    const frame = window.requestAnimationFrame(() => {
      retryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [retryOfJobId]);

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

  async function previewExecution(
    retryJobId: string | null = retryOfJobId,
    requestedSpecIds = selectedForGeneration,
    requestedRetryRequirements = retryJobId ? retryRequirements.trim() : "",
  ) {
    if (!plan?.approvedVersionId || requestedSpecIds.length === 0) return;
    if (retryJobId && !requestedRetryRequirements) {
      setError(
        isChinese
          ? "请先填写失败原因与本次重试要求。"
          : "Describe the failure and requirements for this retry first.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/generation-plan-versions/${plan.approvedVersionId}/execution-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerProfileId: providerProfile,
          generationSpecIds: requestedSpecIds,
          ...(approvedKeyframePlanId
            ? {
                keyframePlanVersionId: approvedKeyframePlanId,
                requiredVideoControlTier: "ORDINARY_REFERENCE",
              }
            : {}),
          ...(retryJobId
            ? {
                retryOfJobId: retryJobId,
                retryRequirements: requestedRetryRequirements,
              }
            : {}),
        }),
      },
    );
    const body = (await response.json()) as ExecutionPreview & { error?: { message: string } };
    if (!response.ok) setError(body.error?.message ?? "Generation preview could not be prepared");
    else {
      setExecutionPreview(body);
      setRetryOfJobId(body.retryOfJobId);
      setRetryRequirements(body.retryRequirements ?? "");
      setSelectedForGeneration(
        body.shots.filter((shot) => shot.compatible).map((shot) => shot.generationSpecId),
      );
      setMessage(
        isChinese
          ? "零调用执行预览已准备完成。请在确认前检查确切范围。"
          : "Zero-call execution preview is ready. Review the exact scope before confirming.",
      );
    }
    setBusy(false);
  }

  async function authorizeBatch() {
    if (!executionPreview?.ready || batchBlocksNewConfirmation(batch)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/generation-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        generationPlanVersionId: executionPreview.generationPlanVersionId,
        providerProfileId: executionPreview.provider.profileId,
        generationSpecIds: executionPreview.shots.map((shot) => shot.generationSpecId),
        previewHash: executionPreview.previewHash,
        confirmed: true,
        expiresInSeconds: 300,
        ...(executionPreview.keyframePlanVersionId
          ? {
              keyframePlanVersionId: executionPreview.keyframePlanVersionId,
              requiredVideoControlTier: "ORDINARY_REFERENCE",
            }
          : {}),
        ...(executionPreview.retryOfJobId
          ? {
              retryOfJobId: executionPreview.retryOfJobId,
              retryRequirements: executionPreview.retryRequirements,
            }
          : {}),
      }),
    });
    const body = (await response.json()) as BatchView & { error?: { message: string } };
    if (!response.ok) setError(body.error?.message ?? "Generation batch could not be authorized");
    else {
      setBatch(body);
      setBatchHistory((current) => [body, ...current.filter((item) => item.id !== body.id)]);
      setMessage(
        isChinese
          ? "批次已授权并进入队列。每项权限会在对应的单次调用前消耗。"
          : "Batch authorized and queued. Each permission is consumed before its one call.",
      );
    }
    setBusy(false);
  }

  async function refreshBatch() {
    if (!batch) return;
    const response = await fetch(`/api/generation-batches/${batch.id}`);
    if (response.ok) {
      const refreshed = (await response.json()) as BatchView;
      setBatch(refreshed);
      setBatchHistory((current) =>
        current.map((item) => (item.id === refreshed.id ? refreshed : item)),
      );
    }
  }

  async function refreshAssembly() {
    const response = await fetch(`/api/generation-plans/${planId}/assemblies`);
    if (!response.ok) return;
    setAssemblyState((await response.json()) as PlanAssemblyState);
  }

  async function refreshDraft() {
    const response = await fetch(`/api/generation-plans/${planId}/drafts`);
    if (response.ok) setDraftState((await response.json()) as PlanDraftState);
  }

  async function createDraft() {
    if (!draftState?.eligible || !draftState.sourceSetHash) return;
    setDrafting(true);
    setError("");
    const response = await fetch(`/api/generation-plans/${planId}/drafts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ expectedSourceSetHash: draftState.sourceSetHash }),
    });
    const body = (await response.json()) as {
      state?: PlanDraftState;
      error?: { message: string };
    };
    if (!response.ok) {
      setError(body.error?.message ?? "整片草稿创建失败。");
      await refreshDraft();
    } else {
      if (body.state) setDraftState(body.state);
      setMessage("带告警的整片草稿已在本地创建；它不是最终成片，也没有改变人工 PASS。");
    }
    setDrafting(false);
  }

  async function createAssembly() {
    if (!assemblyState?.eligible || !assemblyState.sourceSetHash) return;
    setAssembling(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/generation-plans/${planId}/assemblies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ expectedSourceSetHash: assemblyState.sourceSetHash }),
    });
    const body = (await response.json()) as {
      state?: PlanAssemblyState;
      error?: { message: string };
    };
    if (!response.ok) {
      setError(body.error?.message ?? (isChinese ? "合成预览创建失败。" : "Assembly failed."));
      await refreshAssembly();
    } else {
      if (body.state) setAssemblyState(body.state);
      setMessage(
        isChinese
          ? "合成预览已在本地创建并保存到当前 Shot Plan；未调用 H3 或 AI 质检。"
          : "The combined preview was created locally and saved to this Shot Plan. No H3 or AI QA call was made.",
      );
    }
    setAssembling(false);
  }

  async function decideArtifact(
    artifactId: string,
    decision: "PASS" | "FAIL",
    notesOverride?: string,
  ) {
    const notes = notesOverride?.trim() ?? reviewNotes[artifactId]?.trim() ?? "";
    if (decision === "FAIL" && !notes) {
      setError(
        isChinese
          ? "负责人不通过时，请填写失败原因与下一次重试要求。"
          : "Owner FAIL requires a reason and requirements for the next attempt.",
      );
      return;
    }
    const response = await fetch(`/api/generated-artifacts/${artifactId}/human-qa-decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ decision, ...(notes ? { notes } : {}) }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message: string } };
      setError(body.error?.message ?? "Human QA decision could not be recorded");
    } else {
      await Promise.all([refreshBatch(), refreshAssembly(), refreshDraft()]);
    }
  }

  async function controlJob(jobId: string, action: "cancel" | "reconcile") {
    if (!batch) return;
    const response = await fetch(`/api/generation-jobs/${jobId}/${action}`, {
      method: "POST",
      headers: action === "cancel" ? { "If-Match": `"generation-batch-${batch.rowVersion}"` } : {},
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message: string } };
      setError(body.error?.message ?? `Job ${action} could not be requested`);
    } else await refreshBatch();
  }

  async function prepareNewAttempt(
    job: BatchView["jobs"][number],
    historicalBaselineCreatedAt?: string,
  ) {
    const wasAlreadyPreparing = retryOfJobId === job.id;
    const ids = [job.generationBatchTarget.generationSpecId];
    const priorFailureNotes = job.artifacts
      .flatMap((artifact) => artifact.humanQaDecisions)
      .find((decision) => decision.decision === "FAIL")?.notes;
    const authorizationExpiredRequirements =
      job.safeResultCode === "CANCELLED_BEFORE_START"
        ? isChinese
          ? "上一批次授权在本分镜开始前已过期；该任务未提交给提供方，也未消耗本分镜的生成调用。沿用已批准的提示词与五张参考图，仅为这个分镜创建新的有界授权。"
          : "The prior batch authorization expired before this shot started. The task was not submitted to the provider and consumed no generation call for this shot. Reuse the approved prompt and five references, and create a new bounded authorization for this shot only."
        : "";
    setSelectedForGeneration(ids);
    setRetryOfJobId(job.id);
    const historicalBaselineRequirements = historicalBaselineCreatedAt
      ? isChinese
        ? `视觉基线：沿用 ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(historicalBaselineCreatedAt))} 这一历史视频的房间构图、沙发所在侧与位置、coffee table 的位置和尺度、人物自然比例及最终坐姿。硬性修正：Shot 3 开始时人物双手已经空出，全程不得拿起、触碰或再次放置酒杯；同一只酒杯必须静止留在 coffee table 上，杯中红酒的颜色和液位必须与 Shot 2 尾帧一致且全程清晰可见。不得把沙发移到画面左侧，不得移走 coffee table，不得让酒杯或红酒凭空消失。`
        : `Visual baseline: preserve this historical video's room composition, sofa side and position, coffee-table placement and scale, natural character proportions, and final seated pose. Required correction: Shot 3 starts with empty hands; the character never holds, touches, or places the glass. The same glass remains stationary on the coffee table with visible red wine matching Shot 2 in color and fill level throughout. Do not move the sofa to the left, remove the coffee table, or make the glass or wine disappear.`
      : "";
    setRetryRequirements(
      historicalBaselineRequirements || priorFailureNotes || authorizationExpiredRequirements,
    );
    setExecutionPreview(null);
    setError("");
    setMessage(
      isChinese
        ? "已进入重试准备模式。请先检查并修改失败原因与重试要求，再生成零调用预览。"
        : "Retry preparation is open. Review the failure and retry requirements before creating a zero-call preview.",
    );
    if (wasAlreadyPreparing)
      retryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderBatchPanel(displayBatch: BatchView, historical: boolean) {
    const createdAt = new Intl.DateTimeFormat(isChinese ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(displayBatch.createdAt));
    const generatedCalls =
      displayBatch.authorization?.consumptions.filter(
        (consumption) => consumption.operation === "GENERATION_SUBMIT",
      ).length ?? 0;
    const aiQaCalls =
      displayBatch.authorization?.consumptions.filter(
        (consumption) => consumption.operation === "AI_QA_REVIEW",
      ).length ?? 0;

    return (
      <div className={historical ? "batchProgress historicalBatch" : "batchProgress"}>
        <div className="batchHeading">
          <div>
            <p className="eyebrow">
              {historical ? (isChinese ? "历史批次" : "Historical batch") : ""}
            </p>
            <h3>
              {isChinese ? "批次" : "Batch"} {t(displayBatch.status)}
            </h3>
          </div>
          <time dateTime={displayBatch.createdAt}>{createdAt}</time>
        </div>
        <p>
          {isChinese ? "包含分镜：" : "Shots: "}
          {displayBatch.jobs
            .map((job) => job.generationBatchTarget.ordinal)
            .sort((left, right) => left - right)
            .map((ordinal) => (isChinese ? "分镜 " + ordinal : "Shot " + ordinal))
            .join(isChinese ? "、" : ", ")}
        </p>
        <p>
          {isChinese ? "视频生成调用已消耗：" : "Video generation calls consumed: "}
          {generatedCalls}/{displayBatch.authorization?.maximumGenerationCalls ?? 0}
          {isChinese ? "；AI 质检调用已消耗：" : "; AI QA calls consumed: "}
          {aiQaCalls}/{displayBatch.authorization?.maximumAiQaCalls ?? 0}
        </p>
        <p>
          {isChinese ? "执行配置：" : "Execution profile: "}
          {displayBatch.providerProfileId === "minimax-h3-4s-v1"
            ? "MiniMax H3 · LIVE"
            : "Fake · $0"}
        </p>
        {displayBatch.jobs.map((job) => (
          <article key={job.id} className="executionShot">
            <h3>
              {isChinese ? "分镜" : "Shot"} {job.generationBatchTarget.ordinal} · {t(job.status)}
            </h3>
            <p>{job.safeResultCode}</p>
            {!historical && (
              <div className="storyboardActions">
                {["QUEUED", "RUNNING", "SUBMITTED"].includes(job.status) && (
                  <button className="panelButton" onClick={() => void controlJob(job.id, "cancel")}>
                    {isChinese ? "取消此任务" : "Cancel this job"}
                  </button>
                )}
                {job.status === "AMBIGUOUS" && (
                  <button
                    className="panelButton"
                    onClick={() => void controlJob(job.id, "reconcile")}
                  >
                    {isChinese ? "核对原始任务" : "Reconcile original task"}
                  </button>
                )}
                {["TECHNICAL_FAILED", "QA_FAIL", "CANCELLED"].includes(job.status) && (
                  <button className="panelButton" onClick={() => void prepareNewAttempt(job)}>
                    {job.safeResultCode === "CANCELLED_BEFORE_START"
                      ? isChinese
                        ? "准备重新授权"
                        : "Prepare new authorization"
                      : isChinese
                        ? "准备新的尝试"
                        : "Prepare a new attempt"}
                  </button>
                )}
              </div>
            )}
            {historical && job.status === "QA_FAIL" && (
              <div className="storyboardActions">
                <button
                  className="panelButton"
                  onClick={() => void prepareNewAttempt(job, displayBatch.createdAt)}
                >
                  {isChinese ? "以此历史视频为重试基线" : "Use as retry baseline"}
                </button>
              </div>
            )}
            {job.artifacts.map((artifact) => (
              <div key={artifact.id}>
                <video
                  controls
                  preload="metadata"
                  src={"/api/generated-artifacts/" + artifact.id + "/content"}
                  onEnded={(event) => {
                    event.currentTarget.currentTime = 0;
                  }}
                />
                <div className="referenceStrip">
                  {artifact.reviewFrames.map((frame) => (
                    <figure key={frame.role}>
                      <img
                        src={
                          "/api/generated-artifacts/" + artifact.id + "/review-frames/" + frame.role
                        }
                        alt={isChinese ? t(frame.role) + "质检帧" : frame.role + " review frame"}
                      />
                      <figcaption>{t(frame.role)}</figcaption>
                    </figure>
                  ))}
                </div>
                {artifact.aiQaRuns[0]?.result && (
                  <p>
                    AI QA: {artifact.aiQaRuns[0].result.overallStatus} ·{" "}
                    {artifact.aiQaRuns[0].result.summary}
                  </p>
                )}
                {!historical && artifact.humanQaDecisions.length === 0 && (
                  <div>
                    <label>
                      {isChinese
                        ? "失败原因与重试要求（选择不通过时必填）"
                        : "Failure reason and retry requirements (required for FAIL)"}
                      <textarea
                        value={reviewNotes[artifact.id] ?? ""}
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [artifact.id]: event.target.value,
                          }))
                        }
                        placeholder={
                          isChinese
                            ? "写明错误判断、需要保留的内容，以及下一次生成必须调整的内容。"
                            : "Record false positives, content to preserve, and changes required for the next generation."
                        }
                        rows={4}
                      />
                    </label>
                    <div className="storyboardActions">
                      <button
                        className="primaryButton"
                        onClick={() => void decideArtifact(artifact.id, "PASS")}
                      >
                        {isChinese ? "负责人通过" : "Owner PASS"}
                      </button>
                      <button
                        className="dangerTextButton"
                        onClick={() => void decideArtifact(artifact.id, "FAIL")}
                      >
                        {isChinese ? "负责人不通过" : "Owner FAIL"}
                      </button>
                    </div>
                  </div>
                )}
                {historical && artifact.humanQaDecisions.length === 0 && (
                  <p className="noticePanel">
                    {isChinese ? "该视频尚无负责人决定。" : "This video has no owner decision."}
                  </p>
                )}
                {artifact.humanQaDecisions.map((decision, decisionIndex) => (
                  <div className="noticePanel" key={artifact.id + "-" + decisionIndex}>
                    <strong>
                      {isChinese ? "负责人决定" : "Owner decision"}: {decision.decision}
                    </strong>
                    {decision.notes && <p>{decision.notes}</p>}
                  </div>
                ))}
              </div>
            ))}
            <details>
              <summary>{isChinese ? "技术证据" : "Technical evidence"}</summary>
              <p>
                {isChinese ? "任务" : "Job"} {job.id}
              </p>
            </details>
          </article>
        ))}
      </div>
    );
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
      <a
        className="backLink"
        href={`/projects/${projectId}/storyboards/${storyboardId}/continuity`}
      >
        全片一致性设置
      </a>
      <header className="storyboardHero">
        <div>
          <p className="eyebrow">GenerationSpec v1 · deterministic planner · external calls 0</p>
          <h1>Shot Plan</h1>
          <p>
            Storyboard approval: confirmed · Shot Plan approval:{" "}
            {plan.approvedVersionId ? "confirmed" : "pending"}
          </p>
          <p>{specs.length} source shots · one GenerationSpec per shot</p>
        </div>
      </header>
      <p className="noticePanel">
        {batch && activeBatchStatuses.has(batch.status) ? (
          <>
            <strong>
              {isChinese
                ? `当前批次已授权：${t(batch.status)}。`
                : `Current batch: ${batch.status}.`}
            </strong>{" "}
            {isChinese
              ? "该授权只覆盖当前批次；新的生成批次仍需重新执行零调用预览并明确确认。"
              : "That authorization covers only the current batch; a new batch still requires a fresh zero-call preview and explicit confirmation."}
          </>
        ) : (
          <>
            <strong>{isChinese ? "新的生成批次尚未授权。" : "No new batch is authorized."}</strong>{" "}
            {isChinese
              ? "当前页面仅准备可检查的规格；零调用预览不会调用 H3。"
              : "This page only prepares reviewable specifications; a zero-call preview does not call H3."}
          </>
        )}
      </p>
      {message && <p className="successPanel">{message}</p>}
      {error && <p className="formError">{error}</p>}
      {plan.approvedVersionId && engineMode === "workflow-agent-v1" && (
        <WorkflowPlanningPanel
          generationPlanVersionId={plan.approvedVersionId}
          generationPlanRowVersion={plan.rowVersion}
          shots={specs.map((spec) => ({ shotKey: spec.shotKey, ordinal: spec.ordinal }))}
          isChinese={isChinese}
        />
      )}
      <section className="shotGrid">
        {specs.map((spec, index) => (
          <article className="shotCard" key={spec.shotKey}>
            <div className="shotCardHeader">
              <span>Shot {spec.ordinal}</span>
              <span>v{plan.headVersion.versionNumber}</span>
            </div>
            <label>
              {isChinese ? "实际 H3 镜头提示词" : "Actual H3 shot prompt"}
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
            <p className="fieldHint">
              {isChinese
                ? "这里的文本会进入真实 H3 编译提示词。保存会创建新的不可变版本，生成前必须重新预检并批准。当前工作流没有独立的 negative prompt；请把必要的排除条件简洁地写在这里。"
                : "This text enters the real compiled H3 prompt. Saving creates a new immutable version that must be preflighted and approved before generation. This workflow has no separate negative prompt; include essential exclusions concisely here."}
            </p>
            <p>
              <strong>
                {isChinese
                  ? "结构化连续性基线（只读）"
                  : "Structured continuity baseline (read-only)"}
              </strong>
              <br />
              {spec.continuityRequirements.join(" · ") || (isChinese ? "无" : "None")}
            </p>
            <p className="fieldHint">
              {isChinese
                ? "这是已批准分镜生成的结构化证据，不是第二个提示词输入框。要补充本次 H3 的人物比例、构图或排除要求，请编辑上方“实际 H3 镜头提示词”；要改变这份基线，请回到 Storyboard 创建并批准新版本。"
                : "This is structured evidence frozen from the approved storyboard, not a second prompt field. Add H3-specific proportion, framing, or exclusion requirements in the Actual H3 shot prompt above; change this baseline by creating and approving a new Storyboard version."}
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
      <section className="storyboardPanel generationWorkspace">
        <div>
          <p className="eyebrow">{isChinese ? "生成与质检" : "Generate & QA"}</p>
          <h2>{isChinese ? "生成已批准的分镜" : "Generate approved shots"}</h2>
          <p>
            {isChinese
              ? "选择兼容的分镜，检查确切提示词和五张参考图，然后授权有界后台任务。AI 质检仅供参考，只有你的通过决定才是最终结果。"
              : "Choose compatible shots, inspect the exact prompt and five references, then authorize the bounded background run. AI QA is advisory; only your PASS is final."}
          </p>
        </div>
        {!plan.approvedVersionId ? (
          <p className="noticePanel">
            {isChinese
              ? "请先批准当前这个确切的分镜计划版本，再开始生成。"
              : "Approve this exact Shot Plan before generation."}
          </p>
        ) : engineMode === "legacy-v1" ? (
          <>
            <label>
              {isChinese ? "已注册的执行配置" : "Registered execution profile"}
              <select
                value={providerProfile}
                disabled={batchBlocksNewConfirmation(batch)}
                onChange={(event) => {
                  setProviderProfile(event.target.value as typeof providerProfile);
                  setExecutionPreview(null);
                }}
              >
                <option value="fake-video-v1">
                  {isChinese ? "Fake · 自动验收 · $0" : "Fake · automated acceptance · $0"}
                </option>
                <option value="minimax-h3-4s-v1">
                  {isChinese ? "MiniMax H3 · LIVE 有界执行" : "MiniMax H3 · bounded LIVE execution"}
                </option>
              </select>
            </label>
            {providerProfile === "minimax-h3-4s-v1" && (
              <p className="fieldHint">
                {batch &&
                activeBatchStatuses.has(batch.status) &&
                batch.providerProfileId === "minimax-h3-4s-v1"
                  ? isChinese
                    ? "当前活动批次正在使用 MiniMax H3；LIVE 门控已在该批次授权前通过核对。"
                    : "The active batch is using MiniMax H3; its LIVE gate was verified before authorization."
                  : executionPreview
                    ? executionPreview.shots.some((shot) => shot.blockers.includes("LIVE_DISABLED"))
                      ? isChinese
                        ? "LIVE 门控未开启：当前服务进程拒绝 H3 执行。"
                        : "LIVE gate is disabled: the current service process refuses H3 execution."
                      : isChinese
                        ? "LIVE 门控已通过零调用预览核对；这仍未授权或提交任何生成任务。"
                        : "The zero-call preview confirms that the LIVE gate is enabled; no generation has been authorized or submitted."
                    : isChinese
                      ? "点击“准备零调用预览”核对当前服务进程的 LIVE 门控、参考图和工作流；此操作不会调用 H3。"
                      : "Prepare a zero-call preview to verify the current process's LIVE gate, references, and workflow; this does not call H3."}
              </p>
            )}
            <p className="fieldHint">
              {batchBlocksNewConfirmation(batch)
                ? isChinese
                  ? "当前批次的执行配置与分镜范围已经锁定；下方勾选显示的是该批次真实范围，不能在执行中途改写。"
                  : "The current batch's profile and shot scope are locked. The selections below show its actual immutable scope."
                : isChinese
                  ? "下方勾选是下一次零调用预览与新批次的范围；修改勾选后必须重新预览。"
                  : "The selections below define the next zero-call preview and new batch; changing them requires a new preview."}
            </p>
            <div className="generationShotPicker">
              {specs.map((spec) => {
                const reviewed = executionPreview?.shots.find(
                  (shot) => shot.generationSpecId === spec.id,
                );
                return (
                  <label
                    key={spec.id}
                    className={reviewed && !reviewed.compatible ? "blockedShot" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={selectedForGeneration.includes(spec.id)}
                      disabled={reviewed?.compatible === false || batchBlocksNewConfirmation(batch)}
                      onChange={(event) => {
                        setExecutionPreview(null);
                        setSelectedForGeneration((current) =>
                          event.target.checked
                            ? [...current, spec.id]
                            : current.filter((id) => id !== spec.id),
                        );
                      }}
                    />
                    {isChinese ? "分镜" : "Shot"} {spec.ordinal}
                    {reviewed && !reviewed.compatible
                      ? isChinese
                        ? ` · 已阻止：${reviewed.blockers.map(t).join("、")}`
                        : ` · blocked: ${reviewed.blockers.join(", ")}`
                      : ""}
                  </label>
                );
              })}
            </div>
            {retryOfJobId && (
              <div className="noticePanel" ref={retryPanelRef}>
                <label>
                  {isChinese
                    ? "失败原因与本次重试要求"
                    : "Failure reason and requirements for this retry"}
                  <textarea
                    value={retryRequirements}
                    onChange={(event) => {
                      setRetryRequirements(event.target.value);
                      setExecutionPreview(null);
                    }}
                    placeholder={
                      isChinese
                        ? "例如：场景参考图原有的书和灯笼属于允许物体；分镜 1 结尾仍应手持酒杯；缩小人物在画面中的占比，避免显得过高。"
                        : "Example: books and lanterns already in the approved scene are allowed; Shot 1 should still end with the glass in hand; reduce the character's apparent height and frame occupancy."
                    }
                    rows={5}
                  />
                </label>
                <p>
                  {isChinese
                    ? "这些要求会写入新的不可变提示词并绑定到零调用预览。系统不会自动重试，也不会复用旧授权。"
                    : "These requirements become part of the new immutable prompt and zero-call preview. The system will not auto-retry or reuse the old authorization."}
                </p>
                <p>
                  {isChinese
                    ? "人物比例属于跨分镜连续性要求：后续分镜若重新生成，应沿用同一人物与环境尺度；允许景别和坐姿变化，不要求人物在每帧中占据相同像素高度。"
                    : "Character proportion is a cross-shot continuity requirement. Any later regenerated shot should preserve the same character-to-environment scale while allowing shot-size and seated-pose changes; identical pixel height is not required."}
                </p>
                <button
                  className="panelButton"
                  onClick={() => {
                    setRetryOfJobId(null);
                    setRetryRequirements("");
                    setExecutionPreview(null);
                    setSelectedForGeneration(specs.map((spec) => spec.id));
                  }}
                >
                  {isChinese ? "退出重试模式" : "Exit retry mode"}
                </button>
              </div>
            )}
            <div className="storyboardActions">
              <button
                className="panelButton"
                disabled={
                  busy || selectedForGeneration.length === 0 || batchBlocksNewConfirmation(batch)
                }
                onClick={() => void previewExecution()}
              >
                {retryOfJobId
                  ? isChinese
                    ? "准备重试零调用预览"
                    : "Prepare retry zero-call preview"
                  : isChinese
                    ? "准备零调用预览"
                    : "Prepare zero-call preview"}
              </button>
              <button
                className="primaryButton"
                disabled={busy || !executionPreview?.ready || batchBlocksNewConfirmation(batch)}
                onClick={() => void authorizeBatch()}
              >
                {batchBlocksNewConfirmation(batch)
                  ? isChinese
                    ? "已有活动批次"
                    : "Active batch exists"
                  : isChinese
                    ? "确认有界执行"
                    : "Confirm bounded execution"}
              </button>
              {batch && (
                <button className="panelButton" onClick={() => void refreshBatch()}>
                  {isChinese ? "刷新进度" : "Refresh progress"}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="noticePanel">
            {isChinese
              ? "当前使用 Workflow Agent。请在上方完成零调用规划并确认一次确切的视频批次；Fake 配置不会出现在新流程中。"
              : "Workflow Agent is active. Complete the zero-call plan above and confirm one exact video batch; Fake is not offered in the new flow."}
          </p>
        )}
        {engineMode === "legacy-v1" && executionPreview && (
          <div className="executionPreview">
            <p>
              <strong>
                {executionPreview.shots.length} {isChinese ? "个分镜" : "shots"}
              </strong>{" "}
              ·{" "}
              {isChinese
                ? `最多 ${executionPreview.maximumGenerationCalls} 次视频生成；生成成功后最多 ${executionPreview.maximumAiQaCalls} 次 AI 质检（不是 ${executionPreview.maximumGenerationCalls + executionPreview.maximumAiQaCalls} 次视频生成）`
                : `up to ${executionPreview.maximumGenerationCalls} video generations, then up to ${executionPreview.maximumAiQaCalls} AI QA reviews (not ${executionPreview.maximumGenerationCalls + executionPreview.maximumAiQaCalls} video generations)`}
            </p>
            <p>
              {isChinese ? "H3 预估费用上限：" : "Estimated H3 ceiling: "}
              {executionPreview.provider.costEstimateUsd === null
                ? isChinese
                  ? "暂不可用"
                  : "not available"
                : `$${(
                    executionPreview.provider.costEstimateUsd *
                    executionPreview.maximumGenerationCalls
                  ).toFixed(4)}`}
              {isChinese
                ? "。CodexManager：每个分镜最多一次外部 AI 调用；本应用无法核实价格。"
                : ". CodexManager: at most one external AI call per shot; price cannot be verified by this app."}
            </p>
            <p>
              <strong>
                {executionPreview.provider.videoControlTier === "ORDINARY_REFERENCE"
                  ? isChinese
                    ? "普通参考"
                    : "Ordinary reference"
                  : executionPreview.provider.videoControlTier === "LOCKED_START"
                    ? isChinese
                      ? "锁定首帧"
                      : "Locked start frame"
                    : isChinese
                      ? "锁定首尾帧"
                      : "Locked start and end frames"}
              </strong>
              {executionPreview.keyframePlanVersionId
                ? isChinese
                  ? " · 已绑定批准的关键帧方案。H3 使用起始关键帧作为场景参考，目标结束帧仅由 AI QA 对比，不能保证逐像素到达。"
                  : " · An approved keyframe plan is bound. H3 uses the start frame as its scene reference; the target end frame is only checked by AI QA and is not pixel-locked."
                : isChinese
                  ? " · 未绑定关键帧方案，本次只能沿用普通素材参考。"
                  : " · No keyframe plan is bound; this run can only use ordinary asset references."}
            </p>
            {executionPreview.shots.map((shot) => (
              <article key={shot.generationSpecId} className="executionShot">
                <h3>
                  {isChinese ? "分镜" : "Shot"} {shot.ordinal} ·{" "}
                  {shot.compatible
                    ? isChinese
                      ? "兼容"
                      : "compatible"
                    : isChinese
                      ? "已阻止"
                      : "blocked"}
                </h3>
                {shot.blockers.length > 0 && (
                  <p className="formError">{shot.blockers.map(t).join(" · ")}</p>
                )}
                <div className="referenceStrip">
                  {shot.slots.map((slot) => (
                    <figure key={slot.role}>
                      <img
                        src={
                          slot.sourceKind === "KEYFRAME_ARTIFACT" && slot.keyframeArtifactId
                            ? `/api/keyframe-artifacts/${slot.keyframeArtifactId}/content`
                            : `/api/assets/${slot.projectAssetId}/content`
                        }
                        alt={slot.displayName}
                      />
                      <figcaption>{t(slot.role)}</figcaption>
                    </figure>
                  ))}
                </div>
                {shot.continuity && (
                  <div className="noticeStack">
                    <p>
                      {isChinese ? "起始画面：" : "Start frame: "}K{shot.ordinal - 1} ·{" "}
                      {isChinese ? "结束目标：" : "End target: "}K{shot.ordinal}
                    </p>
                    {shot.continuity.warnings.map((warning) => (
                      <p key={warning} className="formWarning">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
                <details>
                  <summary>{isChinese ? "高级信息" : "Advanced information"}</summary>
                  <p>{shot.promptSummary}</p>
                  <p>
                    {isChinese ? "工作流" : "Workflow"} {executionPreview.provider.workflowId} v
                    {executionPreview.provider.workflowVersion}
                  </p>
                  <p>SHA-256 {executionPreview.provider.workflowSha256}</p>
                </details>
              </article>
            ))}
          </div>
        )}
        {batch?.engineVersion === "WORKFLOW_AGENT_V1" && (
          <>
            <GenerationBatchPanel
              batch={batch}
              isChinese={isChinese}
              onRefresh={() => void refreshBatch()}
            />
            <FinalOwnerReviewPanel
              batch={batch}
              isChinese={isChinese}
              onDecision={async (artifactId, decision, notes) => {
                await decideArtifact(artifactId, decision, notes);
              }}
            />
          </>
        )}
        {batch && batch.engineVersion !== "WORKFLOW_AGENT_V1" && (
          <div className="batchProgress">
            <h3>
              {isChinese ? "批次" : "Batch"} {t(batch.status)}
            </h3>
            <p>
              {isChinese ? "视频生成调用已消耗：" : "Video generation calls consumed: "}
              {batch.authorization?.consumptions.filter(
                (consumption) => consumption.operation === "GENERATION_SUBMIT",
              ).length ?? 0}
              /{batch.authorization?.maximumGenerationCalls ?? 0}
              {isChinese ? "；AI 质检调用已消耗：" : "; AI QA calls consumed: "}
              {batch.authorization?.consumptions.filter(
                (consumption) => consumption.operation === "AI_QA_REVIEW",
              ).length ?? 0}
              /{batch.authorization?.maximumAiQaCalls ?? 0}
            </p>
            <p>
              {isChinese ? "执行配置：" : "Execution profile: "}
              {batch.providerProfileId === "minimax-h3-4s-v1" ? "MiniMax H3 · LIVE" : "Fake · $0"}
            </p>
            {batch.jobs.map((job) => (
              <article key={job.id} className="executionShot">
                <h3>
                  {isChinese ? "分镜" : "Shot"} {job.generationBatchTarget.ordinal} ·{" "}
                  {t(job.status)}
                </h3>
                <p>{job.safeResultCode}</p>
                <div className="storyboardActions">
                  {["QUEUED", "RUNNING", "SUBMITTED"].includes(job.status) && (
                    <button
                      className="panelButton"
                      onClick={() => void controlJob(job.id, "cancel")}
                    >
                      {isChinese ? "取消此任务" : "Cancel this job"}
                    </button>
                  )}
                  {job.status === "AMBIGUOUS" && (
                    <button
                      className="panelButton"
                      onClick={() => void controlJob(job.id, "reconcile")}
                    >
                      {isChinese ? "核对原始任务" : "Reconcile original task"}
                    </button>
                  )}
                  {["TECHNICAL_FAILED", "QA_FAIL", "CANCELLED"].includes(job.status) && (
                    <button className="panelButton" onClick={() => void prepareNewAttempt(job)}>
                      {job.safeResultCode === "CANCELLED_BEFORE_START"
                        ? isChinese
                          ? "准备重新授权"
                          : "Prepare new authorization"
                        : isChinese
                          ? "准备新的尝试"
                          : "Prepare a new attempt"}
                    </button>
                  )}
                </div>
                {job.artifacts.map((artifact) => (
                  <div key={artifact.id}>
                    <video
                      controls
                      preload="metadata"
                      src={`/api/generated-artifacts/${artifact.id}/content`}
                      onEnded={(event) => {
                        event.currentTarget.currentTime = 0;
                      }}
                    />
                    <div className="referenceStrip">
                      {artifact.reviewFrames.map((frame) => (
                        <figure key={frame.role}>
                          <img
                            src={`/api/generated-artifacts/${artifact.id}/review-frames/${frame.role}`}
                            alt={
                              isChinese ? `${t(frame.role)}质检帧` : `${frame.role} review frame`
                            }
                          />
                          <figcaption>{t(frame.role)}</figcaption>
                        </figure>
                      ))}
                    </div>
                    {artifact.aiQaRuns[0]?.result && (
                      <p>
                        AI QA: {artifact.aiQaRuns[0].result.overallStatus} ·{" "}
                        {artifact.aiQaRuns[0].result.summary}
                      </p>
                    )}
                    {artifact.humanQaDecisions.length === 0 && (
                      <div>
                        <label>
                          {isChinese
                            ? "失败原因与重试要求（选择不通过时必填）"
                            : "Failure reason and retry requirements (required for FAIL)"}
                          <textarea
                            value={reviewNotes[artifact.id] ?? ""}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [artifact.id]: event.target.value,
                              }))
                            }
                            placeholder={
                              isChinese
                                ? "写明错误判断、需要保留的内容，以及下一次生成必须调整的内容。"
                                : "Record false positives, content to preserve, and changes required for the next generation."
                            }
                            rows={4}
                          />
                        </label>
                        <div className="storyboardActions">
                          <button
                            className="primaryButton"
                            onClick={() => void decideArtifact(artifact.id, "PASS")}
                          >
                            {isChinese ? "负责人通过" : "Owner PASS"}
                          </button>
                          <button
                            className="dangerTextButton"
                            onClick={() => void decideArtifact(artifact.id, "FAIL")}
                          >
                            {isChinese ? "负责人不通过" : "Owner FAIL"}
                          </button>
                        </div>
                      </div>
                    )}
                    {artifact.humanQaDecisions.map((decision, decisionIndex) => (
                      <div className="noticePanel" key={`${artifact.id}-${decisionIndex}`}>
                        <strong>
                          {isChinese ? "负责人决定" : "Owner decision"}: {decision.decision}
                        </strong>
                        {decision.notes && <p>{decision.notes}</p>}
                      </div>
                    ))}
                  </div>
                ))}
                <details>
                  <summary>{isChinese ? "技术证据" : "Technical evidence"}</summary>
                  <p>
                    {isChinese ? "任务" : "Job"} {job.id}
                  </p>
                </details>
              </article>
            ))}
          </div>
        )}
        {batchHistory.some((item) => item.id !== batch?.id) && (
          <section
            className="batchHistory"
            aria-label={isChinese ? "历史生成批次" : "Generation history"}
          >
            <div>
              <p className="eyebrow">{isChinese ? "历史记录" : "History"}</p>
              <h3>{isChinese ? "历史生成批次" : "Generation history"}</h3>
              <p>
                {isChinese
                  ? "历史视频与负责人审核决定会永久保留；新的重试不会覆盖旧结果。"
                  : "Historical videos and owner decisions remain available; a new attempt never replaces an earlier result."}
              </p>
            </div>
            {batchHistory
              .filter((item) => item.id !== batch?.id)
              .map((historicalBatch) => (
                <div key={historicalBatch.id}>{renderBatchPanel(historicalBatch, true)}</div>
              ))}
          </section>
        )}
        {plan.approvedVersionId && (
          <section className="assemblyWorkspace draftWorkspace" aria-label="带告警的整片草稿">
            <div>
              <p className="eyebrow">本地草稿 · 不是最终成片</p>
              <h3>带告警的整片草稿</h3>
              <p>
                只要每个 Shot
                都有可播放、技术有效的结果，就能先按顺序整体观看。视觉偏差和未通过状态会保留为告警；不会自动重试，也不会自动变成人工
                PASS。
              </p>
            </div>
            {!draftState ? (
              <p className="noticePanel">正在检查可播放结果…</p>
            ) : !draftState.eligible ? (
              <p className="noticePanel">
                还缺少 {draftState.missingOrdinals.map((ordinal) => `Shot ${ordinal}`).join("、")}{" "}
                的可播放结果。
              </p>
            ) : (
              <>
                {draftState.warnings.length > 0 && (
                  <div className="warningPanel">
                    <strong>草稿将带以下告警</strong>
                    <ul>
                      {draftState.warnings.map((warning, index) => (
                        <li key={`${warning.ordinal}-${index}`}>
                          Shot {warning.ordinal}：{warning.warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!draftState.currentDraft && (
                  <button
                    className="primaryButton"
                    disabled={drafting}
                    onClick={() => void createDraft()}
                  >
                    {drafting ? "正在本地生成草稿…" : "生成带告警的整片草稿"}
                  </button>
                )}
              </>
            )}
            {draftState?.currentDraft && (
              <article className="assemblyCard currentAssembly draftCard">
                <div className="batchHeading">
                  <div>
                    <p className="eyebrow">DRAFT · 不可自动转正</p>
                    <h3>当前整片草稿</h3>
                  </div>
                  <time dateTime={draftState.currentDraft.createdAt}>
                    {new Date(draftState.currentDraft.createdAt).toLocaleString()}
                  </time>
                </div>
                <video controls preload="metadata" src={draftState.currentDraft.contentUrl} />
                <a className="panelButton" href={draftState.currentDraft.downloadUrl}>
                  下载草稿
                </a>
                <p className="fieldHint">
                  {draftState.currentDraft.width}×{draftState.currentDraft.height} ·{" "}
                  {draftState.currentDraft.fps.toFixed(2)} fps · 明确非最终成片
                </p>
              </article>
            )}
          </section>
        )}
        {plan.approvedVersionId && (
          <section
            className="assemblyWorkspace"
            aria-label={isChinese ? "合成预览" : "Assembly preview"}
          >
            <div>
              <p className="eyebrow">{isChinese ? "本地合成" : "Local assembly"}</p>
              <h3>{isChinese ? "最终分镜合成预览" : "Final shot assembly preview"}</h3>
              <p>
                {isChinese
                  ? "只使用每个分镜最新的负责人 PASS 视频，按分镜顺序在本地拼接并保存；不会调用 H3、ComfyUI 或 AI 质检。"
                  : "Uses only the latest owner-PASS video per shot, concatenates locally in shot order, and saves the result without H3, ComfyUI, or AI QA."}
              </p>
            </div>
            {!assemblyState ? (
              <p className="noticePanel">
                {isChinese ? "正在核对负责人通过状态…" : "Checking owner PASS status…"}
              </p>
            ) : !assemblyState.eligible ? (
              <div className="noticePanel assemblyReadiness">
                <strong>{isChinese ? "暂不能合成" : "Not ready to assemble"}</strong>
                <p>
                  {isChinese
                    ? `还差 ${assemblyState.missingOrdinals.map((ordinal) => `分镜 ${ordinal}`).join("、")} 的负责人通过。`
                    : `Owner PASS is still required for ${assemblyState.missingOrdinals.map((ordinal) => `Shot ${ordinal}`).join(", ")}.`}
                </p>
                <button className="primaryButton" disabled>
                  {isChinese ? "生成合成预览" : "Create assembly preview"}
                </button>
              </div>
            ) : (
              <div className="assemblyReadiness">
                <p>
                  <strong>{isChinese ? "已就绪：" : "Ready: "}</strong>
                  {assemblyState.sources
                    .map((source) =>
                      isChinese ? `分镜 ${source.ordinal}` : `Shot ${source.ordinal}`,
                    )
                    .join(isChinese ? " → " : " → ")}
                </p>
                {!assemblyState.currentAssembly && (
                  <button
                    className="primaryButton"
                    disabled={assembling}
                    onClick={() => void createAssembly()}
                  >
                    {assembling
                      ? isChinese
                        ? "正在本地合成…"
                        : "Assembling locally…"
                      : isChinese
                        ? "生成合成预览"
                        : "Create assembly preview"}
                  </button>
                )}
              </div>
            )}
            {assemblyState?.currentAssembly && (
              <article className="assemblyCard currentAssembly">
                <div className="batchHeading">
                  <div>
                    <p className="eyebrow">{isChinese ? "当前来源版本" : "Current sources"}</p>
                    <h3>{isChinese ? "已保存的合成预览" : "Saved assembly preview"}</h3>
                  </div>
                  <time dateTime={assemblyState.currentAssembly.createdAt}>
                    {new Intl.DateTimeFormat(isChinese ? "zh-CN" : "en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(assemblyState.currentAssembly.createdAt))}
                  </time>
                </div>
                <video controls preload="metadata" src={assemblyState.currentAssembly.contentUrl} />
                <div className="storyboardActions">
                  <a className="panelButton" href={assemblyState.currentAssembly.downloadUrl}>
                    {isChinese ? "下载合成视频" : "Download combined video"}
                  </a>
                </div>
                <p className="fieldHint">
                  {assemblyState.currentAssembly.width}×{assemblyState.currentAssembly.height} ·{" "}
                  {assemblyState.currentAssembly.fps.toFixed(2)} fps ·{" "}
                  {assemblyState.currentAssembly.durationSeconds.toFixed(2)}s ·{" "}
                  {isChinese ? "无音频" : "silent"}
                </p>
                <details>
                  <summary>{isChinese ? "来源与哈希" : "Sources and hashes"}</summary>
                  {assemblyState.currentAssembly.sources.map((source) => (
                    <p key={source.artifactId}>
                      {isChinese ? "分镜" : "Shot"} {source.ordinal} · {source.artifactId} ·{" "}
                      {source.sha256}
                    </p>
                  ))}
                </details>
              </article>
            )}
            {assemblyState && assemblyState.assemblies.some((assembly) => assembly.stale) && (
              <details className="assemblyHistory">
                <summary>{isChinese ? "历史合成版本" : "Historical assemblies"}</summary>
                {assemblyState.assemblies
                  .filter((assembly) => assembly.stale)
                  .map((assembly) => (
                    <article className="assemblyCard historicalAssembly" key={assembly.id}>
                      <h3>{isChinese ? "历史合成预览" : "Historical assembly preview"}</h3>
                      <time dateTime={assembly.createdAt}>
                        {new Intl.DateTimeFormat(isChinese ? "zh-CN" : "en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(assembly.createdAt))}
                      </time>
                      <video controls preload="metadata" src={assembly.contentUrl} />
                      <a className="panelButton" href={assembly.downloadUrl}>
                        {isChinese ? "下载此历史版本" : "Download this version"}
                      </a>
                    </article>
                  ))}
              </details>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
