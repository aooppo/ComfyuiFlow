import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildGenerationSpecs,
  DETERMINISTIC_SHOT_PLANNER_VERSION,
  type PlannerReference,
} from "@comfyuiflow/project-core";

function input() {
  return {
    projectId: randomUUID(),
    targetAspectRatio: "PORTRAIT_9_16" as const,
    storyboardId: randomUUID(),
    storyboardVersionId: randomUUID(),
    manifestId: randomUUID(),
    shots: [1, 2, 3].map((ordinal) => ({
      id: randomUUID(),
      shotKey: randomUUID(),
      ordinal,
      startState: `Start ${ordinal}`,
      action: `Action ${ordinal}`,
      endState: `End ${ordinal}`,
      camera: "Locked medium shot",
      composition: "Subject and product remain legible",
      continuityRequirements: ["Preserve identity", "Preserve wardrobe"],
      durationSeconds: 2 + ordinal,
      requirements: [] as Array<{ id: string }>,
    })),
    references: [] as PlannerReference[],
  };
}

describe("GenerationSpec v1 deterministic planner", () => {
  it("produces the same exact three specs and hashes for the same input", () => {
    const source = input();
    const first = buildGenerationSpecs(source);
    const second = buildGenerationSpecs(structuredClone(source));
    expect(second).toEqual(first);
    expect(first.map((spec) => spec.ordinal)).toEqual([1, 2, 3]);
    expect(first.every((spec) => spec.plannerVersion === DETERMINISTIC_SHOT_PLANNER_VERSION)).toBe(
      true,
    );
    expect(new Set(first.map((spec) => spec.outputHash)).size).toBe(3);
  });

  it("keeps references ordered and contains no provider or workflow parameters", () => {
    const source = input();
    const requirementId = randomUUID();
    source.shots[0]!.requirements = [{ id: requirementId }];
    source.references = [
      {
        requirementId,
        productionAssetVersionId: randomUUID(),
        characterStateVersionId: null,
        assetVersionFileId: randomUUID(),
        projectAssetId: randomUUID(),
        sha256: "a".repeat(64),
        referenceUsage: "IDENTITY" as const,
      },
    ];
    const specs = buildGenerationSpecs(source);
    expect(specs[0]!.references).toEqual(source.references);
    const serialized = JSON.stringify(specs).toLowerCase();
    for (const forbidden of [
      "providerid",
      "modelid",
      "workflowid",
      "comfyui",
      "nodeid",
      "sampler",
      "cfgscale",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
