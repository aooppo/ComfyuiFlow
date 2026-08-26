import { describe, expect, it } from "vitest";
import {
  createPlanningInputSnapshotV3,
  gatherPlanningInputCandidates,
} from "@comfyuiflow/project-core";

const hash = (value: string) => value.repeat(64);
const ref = (id: string, version = "1") => ({ id, version });

describe("Planning Input Snapshot V3", () => {
  it("filters by semantic identity and readiness rather than filename or path", () => {
    const candidates = gatherPlanningInputCandidates({
      requiredPurposes: ["PRODUCT"],
      candidates: [
        {
          id: "a-file",
          semanticIdentityRef: ref("asset.product"),
          purpose: "PRODUCT",
          sourceKind: "SEMANTIC_ASSET_VERSION",
          sourceRef: ref("asset.product"),
          sha256: hash("a"),
          modality: "IMAGE",
          displayFilename: "random-environment-name.png",
          approved: true,
          ready: true,
          hashVerified: true,
        },
        {
          id: "b-file",
          semanticIdentityRef: ref("asset.other"),
          purpose: "ENVIRONMENT",
          sourceKind: "SEMANTIC_ASSET_VERSION",
          sourceRef: ref("asset.other"),
          sha256: hash("b"),
          modality: "IMAGE",
          displayFilename: "product-perfect.png",
          approved: true,
          ready: true,
          hashVerified: true,
        },
      ],
    });
    expect(candidates.map((item) => item.id)).toEqual(["a-file"]);
  });

  it("freezes deterministic modality order, exact refs, hashes, omissions, and unresolved reasons", () => {
    const bindings = [
      {
        id: "69ce3acd-c810-44ec-8f26-02d62190e028",
        purpose: "MOTION" as const,
        sourceKind: "PROJECT_FILE" as const,
        sourceRef: ref("file.motion"),
        sha256: hash("b"),
        modality: "VIDEO" as const,
        roleLabel: "Motion reference",
        necessity: "OPTIONAL" as const,
      },
      {
        id: "8fd62386-445f-4d9f-a337-087cbc201575",
        purpose: "PRODUCT" as const,
        sourceKind: "SEMANTIC_ASSET_VERSION" as const,
        sourceRef: ref("asset.product"),
        sha256: hash("a"),
        modality: "IMAGE" as const,
        roleLabel: "Product identity",
        necessity: "REQUIRED" as const,
      },
    ];
    const make = () =>
      createPlanningInputSnapshotV3({
        snapshotId: "c73107b0-dad7-4b2c-a531-5bc9ac0d338a",
        version: "1",
        requirementSpecRef: ref("requirement.spec"),
        implementationRef: ref("implementation.reference"),
        compilerRef: ref("compiler.reference"),
        bindings,
        omittedRequirementCodes: ["NO_EXPLICIT_CHARACTER_NEED"],
        unresolvedRequirementCodes: ["AUDIO_REFERENCE_MISSING"],
      });
    const first = make();
    expect(first.bindings.map((item) => [item.modality, item.order])).toEqual([
      ["IMAGE", 0],
      ["VIDEO", 0],
    ]);
    expect(new Set(Array.from({ length: 100 }, () => make().snapshotHash)).size).toBe(1);
    expect(JSON.stringify(first)).not.toMatch(/displayFilename|storedPath|originalPath/);
  });
});
