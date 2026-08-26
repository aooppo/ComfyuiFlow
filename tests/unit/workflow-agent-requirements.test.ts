import { describe, expect, it } from "vitest";
import { ShotRequirementSpecV2Schema } from "@comfyuiflow/contracts";
import {
  analyzeShotRequirements,
  computeShotRequirementHash,
} from "../../packages/project-core/src/workflow-agent/requirement-analyzer.js";

const ids = {
  projectId: "00000000-0000-4000-8000-000000000001",
  storyboardId: "00000000-0000-4000-8000-000000000002",
  storyboardVersionId: "00000000-0000-4000-8000-000000000003",
  generationPlanVersionId: "00000000-0000-4000-8000-000000000004",
  storyboardShotId: "00000000-0000-4000-8000-000000000005",
  shotKey: "00000000-0000-4000-8000-000000000006",
  sourceShotKey: "00000000-0000-4000-8000-000000000007",
  assetVersionFileId: "00000000-0000-4000-8000-000000000008",
};

function fixture() {
  const unhashed = {
    schemaVersion: "shot-requirement-spec-v2" as const,
    projectId: ids.projectId,
    storyboardId: ids.storyboardId,
    storyboardVersionId: ids.storyboardVersionId,
    generationPlanVersionId: ids.generationPlanVersionId,
    storyboardShotId: ids.storyboardShotId,
    shotKey: ids.shotKey,
    ordinal: 2,
    startState: "产品静止在桌面",
    action: "角色拿起产品",
    endState: "产品保持完整并位于手中",
    camera: "中景固定机位",
    composition: "角色与产品居中",
    durationSeconds: 4,
    aspectRatio: "PORTRAIT_9_16" as const,
    references: [
      {
        assetVersionFileId: ids.assetVersionFileId,
        sha256: "a".repeat(64),
        semanticRole: "product",
      },
    ],
    dependencies: [
      {
        sourceShotKey: ids.sourceShotKey,
        targetShotKey: ids.shotKey,
        type: "PREVIOUS_SHOT_FINAL_FRAME" as const,
        importance: "HARD" as const,
        requiredInputSlot: "first_frame",
      },
    ],
    modelSelection: { mode: "AUTO" as const },
  };
  return ShotRequirementSpecV2Schema.parse({
    ...unhashed,
    requirementHash: computeShotRequirementHash(unhashed),
  });
}

describe("Workflow Agent requirement analyzer", () => {
  it("derives provider-neutral capabilities and stable input slots", () => {
    const requirements = analyzeShotRequirements(fixture());
    expect(requirements.requiredCapabilities).toEqual([
      { capability: "FIRST_FRAME_TO_VIDEO", importance: "HARD" },
      { capability: "PREVIOUS_FINAL_FRAME_TO_VIDEO", importance: "HARD" },
      { capability: "REFERENCE_TO_VIDEO", importance: "HARD" },
    ]);
    expect(requirements.requiredInputSlots).toEqual(["first_frame", "product"]);
    expect(requirements.blockers).toEqual([]);
    expect(requirements.requirementsHash).toHaveLength(64);
  });

  it("produces identical hashes for semantically identical normalized input", () => {
    const first = fixture();
    const second = { ...first, requirementHash: "f".repeat(64) };
    expect(computeShotRequirementHash(first)).toBe(computeShotRequirementHash(second));
    expect(analyzeShotRequirements(first)).toEqual(analyzeShotRequirements(first));
  });
});
