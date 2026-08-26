import { describe, expect, it } from "vitest";
import { createPlanningInputSnapshotV3 } from "@comfyuiflow/project-core";

const ref = (id: string) => ({ id, version: "1.0.0" });

describe("frame-controlled input ordering", () => {
  it("places required bindings before optional bindings and preserves upstream frame lineage", () => {
    const snapshot = createPlanningInputSnapshotV3({
      snapshotId: "00000000-0000-4000-8000-000000000001",
      version: "1",
      requirementSpecRef: ref("requirement.frame"),
      implementationRef: ref("implementation.frame"),
      compilerRef: ref("compiler.frame"),
      bindings: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          purpose: "STYLE",
          sourceKind: "PROJECT_FILE",
          sourceRef: ref("asset.optional"),
          sha256: "b".repeat(64),
          modality: "IMAGE",
          roleLabel: "style",
          necessity: "OPTIONAL",
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          purpose: "CONTINUITY",
          sourceKind: "UPSTREAM_FINAL_FRAME",
          sourceRef: { id: "artifact.final-frame", version: "plan-7:artifact-3:frame-120" },
          sha256: "a".repeat(64),
          modality: "IMAGE",
          roleLabel: "first-frame",
          necessity: "REQUIRED",
        },
      ],
      omittedRequirementCodes: [],
      unresolvedRequirementCodes: [],
    });
    expect(snapshot.bindings.map((binding) => binding.sourceRef.id)).toEqual([
      "artifact.final-frame",
      "asset.optional",
    ]);
    expect(snapshot.bindings[0]).toMatchObject({
      sourceKind: "UPSTREAM_FINAL_FRAME",
      sourceRef: { version: "plan-7:artifact-3:frame-120" },
      sha256: "a".repeat(64),
    });
  });
});
