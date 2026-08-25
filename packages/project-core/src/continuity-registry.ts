import type {
  ContinuityPreflightV1,
  ContinuitySubjectInputV1,
  CreateContinuityVersionV1,
} from "@comfyuiflow/contracts";
import { ContinuityPreflightV1Schema } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";

export const CONTINUITY_REGISTRY_VERSION = "continuity-subject-registry-v1";

export const continuitySubjectRegistry = {
  ENVIRONMENT: { label: "场景环境", defaultPolicy: "WHOLE_FILM_HOLD", defaultImportance: "HARD" },
  CHARACTER: { label: "人物", defaultPolicy: "WHOLE_FILM_HOLD", defaultImportance: "HARD" },
  PRODUCT: { label: "产品", defaultPolicy: "WHOLE_FILM_HOLD", defaultImportance: "HARD" },
  PROP: { label: "道具", defaultPolicy: "WHOLE_FILM_HOLD", defaultImportance: "HARD" },
  CAMERA: { label: "摄影", defaultPolicy: "SHOT_CHANGE", defaultImportance: "SOFT" },
  VISUAL_STYLE: { label: "视觉风格", defaultPolicy: "WHOLE_FILM_HOLD", defaultImportance: "SOFT" },
} as const;

export interface ContinuitySeedAsset {
  subjectKey: string;
  kind: keyof typeof continuitySubjectRegistry;
  label: string;
  productionAssetVersionId?: string | null;
  assetVersionFileId?: string | null;
  sourceSha256?: string | null;
  defaultPolicy?: "WHOLE_FILM_HOLD" | "SHOT_CHANGE" | "UNIMPORTANT";
  facts: Record<string, unknown>;
}

export interface ContinuitySeedShot {
  id: string;
  ordinal: number;
  title: string;
  startState: string;
  endState: string;
  camera: string;
  composition: string;
}

function subjectRule(subject: ContinuitySeedAsset): ContinuitySubjectInputV1["rules"][number] {
  const registered = continuitySubjectRegistry[subject.kind];
  return {
    propertyKey: "canonical_state",
    policy: subject.defaultPolicy ?? registered.defaultPolicy,
    importance: registered.defaultImportance,
    expectedValue: subject.sourceSha256 ?? subject.facts,
    explanation: `${registered.label}默认由全片统一设置管理`,
  };
}

export function buildContinuitySuggestion(input: {
  assets: ContinuitySeedAsset[];
  shots: ContinuitySeedShot[];
}): Omit<CreateContinuityVersionV1, "expectedRowVersion" | "idempotencyKey" | "parentVersionId"> {
  const assets = [...input.assets].sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
  const camera: ContinuitySeedAsset = {
    subjectKey: "camera:whole-film",
    kind: "CAMERA",
    label: "摄影与构图",
    facts: { source: "storyboard" },
  };
  const style: ContinuitySeedAsset = {
    subjectKey: "style:whole-film",
    kind: "VISUAL_STYLE",
    label: "全片视觉风格",
    facts: { aspectRatio: "PORTRAIT_9_16", continuity: "consistent" },
  };
  const seeds = [...assets, camera, style];
  const subjects: ContinuitySubjectInputV1[] = seeds.map((subject) => ({
    subjectKey: subject.subjectKey,
    kind: subject.kind,
    label: subject.label,
    productionAssetVersionId: subject.productionAssetVersionId ?? null,
    assetVersionFileId: subject.assetVersionFileId ?? null,
    sourceSha256: subject.sourceSha256 ?? null,
    facts: subject.facts,
    rules: [subjectRule(subject)],
  }));

  const stableAssets = assets.filter((subject) => subject.defaultPolicy !== "SHOT_CHANGE");
  const dynamicAssets = assets.filter((subject) => subject.defaultPolicy === "SHOT_CHANGE");
  const stableState = Object.fromEntries(
    stableAssets.map((subject) => [subject.subjectKey, subject.sourceSha256 ?? subject.facts]),
  );
  const boundaries = Array.from({ length: input.shots.length + 1 }, (_, boundaryIndex) => {
    const prior = input.shots[Math.max(0, boundaryIndex - 1)];
    const next = input.shots[Math.min(boundaryIndex, input.shots.length - 1)];
    return {
      boundaryIndex,
      label:
        boundaryIndex === 0
          ? "全片开始"
          : boundaryIndex === input.shots.length
            ? "全片结束"
            : `Shot ${boundaryIndex} → ${boundaryIndex + 1}`,
      state: {
        ...stableState,
        ...Object.fromEntries(
          dynamicAssets.map((subject) => [
            subject.subjectKey,
            {
              identitySha256: subject.sourceSha256 ?? null,
              previousEndState: boundaryIndex === 0 ? null : (prior?.endState ?? null),
              nextStartState:
                boundaryIndex === input.shots.length ? null : (next?.startState ?? null),
            },
          ]),
        ),
        "camera:whole-film": {
          previous: prior?.camera ?? "",
          next: next?.camera ?? "",
          composition: next?.composition ?? prior?.composition ?? "",
        },
        "style:whole-film": { aspectRatio: "PORTRAIT_9_16", continuity: "consistent" },
      },
    };
  });
  const shots = input.shots.map((shot, index) => ({
    storyboardShotId: shot.id,
    ordinal: shot.ordinal,
    startBoundaryIndex: index,
    endBoundaryIndex: index + 1,
    declaredChanges: {
      "camera:whole-film": { camera: shot.camera, composition: shot.composition },
      ...Object.fromEntries(
        dynamicAssets.map((subject) => [
          subject.subjectKey,
          { startState: shot.startState, endState: shot.endState },
        ]),
      ),
      narrative: { startState: shot.startState, endState: shot.endState },
    },
  }));
  return { subjects, boundaries, shots };
}

function stableValue(value: unknown) {
  return canonicalSha256(value);
}

export function preflightContinuityData(
  continuityProfileVersionId: string,
  data: Pick<CreateContinuityVersionV1, "subjects" | "boundaries" | "shots">,
): ContinuityPreflightV1 {
  const issues: ContinuityPreflightV1["blockers"] = [];
  const boundaryByIndex = new Map(
    data.boundaries.map((boundary) => [boundary.boundaryIndex, boundary]),
  );
  if (data.boundaries.length !== data.shots.length + 1)
    issues.push({
      severity: "BLOCKER",
      code: "BOUNDARY_COUNT_INVALID",
      subjectKey: null,
      shotOrdinal: null,
      boundaryIndex: null,
      message: `${data.shots.length} 个 Shot 必须有 ${data.shots.length + 1} 个共享边界`,
      actions: ["INHERIT_PREVIOUS"],
    });
  data.shots.forEach((shot, index) => {
    if (
      shot.ordinal !== index + 1 ||
      shot.startBoundaryIndex !== index ||
      shot.endBoundaryIndex !== index + 1 ||
      !boundaryByIndex.has(index) ||
      !boundaryByIndex.has(index + 1)
    )
      issues.push({
        severity: "BLOCKER",
        code: "SHOT_BOUNDARY_NOT_SHARED",
        subjectKey: null,
        shotOrdinal: shot.ordinal,
        boundaryIndex: shot.startBoundaryIndex,
        message: `Shot ${shot.ordinal} 没有连接到同一个相邻边界`,
        actions: ["INHERIT_PREVIOUS"],
      });
  });

  for (const subject of data.subjects) {
    const rule = subject.rules.find((item) => item.propertyKey === "canonical_state");
    if (!rule) continue;
    for (let index = 1; index < data.boundaries.length; index += 1) {
      const previous = data.boundaries[index - 1]?.state[subject.subjectKey];
      const current = data.boundaries[index]?.state[subject.subjectKey];
      if (stableValue(previous) === stableValue(current)) continue;
      const declared = data.shots[index - 1]?.declaredChanges[subject.subjectKey];
      if (rule.policy === "WHOLE_FILM_HOLD")
        issues.push({
          severity: rule.importance === "HARD" ? "BLOCKER" : "WARNING",
          code: "WHOLE_FILM_HOLD_CONFLICT",
          subjectKey: subject.subjectKey,
          shotOrdinal: index,
          boundaryIndex: index,
          message: `${subject.label} 被设置为全片保持，但 Shot ${index} 前后状态不一致`,
          actions: ["INHERIT_PREVIOUS", "DECLARE_SHOT_CHANGE", "SELECT_APPROVED_REFERENCE"],
        });
      else if (rule.policy === "SHOT_CHANGE" && declared === undefined)
        issues.push({
          severity: "BLOCKER",
          code: "SHOT_CHANGE_UNDECLARED",
          subjectKey: subject.subjectKey,
          shotOrdinal: index,
          boundaryIndex: index,
          message: `${subject.label} 发生了变化，但尚未说明变化后的状态`,
          actions: ["INHERIT_PREVIOUS", "DECLARE_SHOT_CHANGE"],
        });
      else if (rule.policy === "UNIMPORTANT")
        issues.push({
          severity: "WARNING",
          code: "UNIMPORTANT_STATE_CHANGED",
          subjectKey: subject.subjectKey,
          shotOrdinal: index,
          boundaryIndex: index,
          message: `${subject.label} 可能变化，模型只会尽量参考`,
          actions: ["INHERIT_PREVIOUS", "DECLARE_SHOT_CHANGE"],
        });
    }
  }
  const blockers = issues.filter((issue) => issue.severity === "BLOCKER");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  const core = {
    schemaVersion: "continuity-preflight-v1" as const,
    continuityProfileVersionId,
    ready: blockers.length === 0,
    blockers,
    warnings,
    externalCalls: 0 as const,
  };
  return ContinuityPreflightV1Schema.parse({ ...core, preflightHash: canonicalSha256(core) });
}
